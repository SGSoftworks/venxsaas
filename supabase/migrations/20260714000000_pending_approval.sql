-- Add pending_approval state to tenants
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_estado_check;
ALTER TABLE public.tenants ADD CONSTRAINT tenants_estado_check
  CHECK (estado IN ('pending_payment', 'pending_approval', 'active', 'suspended', 'cancelled'));

-- RPC: Set tenant to pending_approval after payment is verified
-- Called by webhook/check-payment/reconcile when an initial payment is approved
CREATE OR REPLACE FUNCTION set_pending_approval(
    p_tenant_id UUID,
    p_payment_id UUID DEFAULT NULL,
    p_wompi_transaction_id TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    -- Mark payment as approved
    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'approved',
            wompi_transaction_id = COALESCE(p_wompi_transaction_id, wompi_transaction_id),
            updated_at = NOW()
        WHERE id = p_payment_id AND status != 'approved';
    END IF;

    -- Set tenant to pending_approval (idempotent)
    UPDATE public.tenants
    SET estado = 'pending_approval', updated_at = NOW()
    WHERE id = p_tenant_id AND estado IN ('pending_payment');

    -- Log event
    INSERT INTO public.subscription_events (tenant_id, tipo, metadata)
    SELECT p_tenant_id, 'pending_approval',
           jsonb_build_object(
               'payment_id', p_payment_id,
               'transaction_id', p_wompi_transaction_id,
               'fecha', CURRENT_DATE
           )
    FROM public.tenants WHERE id = p_tenant_id AND estado = 'pending_approval';
END;
$$;

-- RPC: SuperAdmin approves a tenant manually
-- Creates empresa, sucursal, subscription, invoice
CREATE OR REPLACE FUNCTION approve_tenant(
    p_tenant_id UUID,
    p_admin_user_id UUID DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_nombre_negocio TEXT;
    v_tenant_nit TEXT;
    v_plan_id UUID;
    v_empresa_id UUID;
    v_subscription_id UUID;
    v_payment_id UUID;
BEGIN
    -- Get tenant data
    SELECT nombre_negocio, nit, plan_id INTO v_nombre_negocio, v_tenant_nit, v_plan_id
    FROM public.tenants WHERE id = p_tenant_id;

    -- Only process if pending_approval
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND estado = 'pending_approval') THEN
        RETURN;
    END IF;

    -- Activate tenant
    UPDATE public.tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id;

    -- Create empresa
    INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
    VALUES (v_nombre_negocio, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id INTO v_empresa_id;

    -- Create sucursal principal
    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.sucursales (id, nombre, nit, empresa_id)
        VALUES (gen_random_uuid(), v_nombre_negocio || ' - Principal', v_tenant_nit, v_empresa_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Create active subscription
    INSERT INTO public.subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro)
    VALUES (p_tenant_id, v_plan_id, 'active', CURRENT_DATE,
            CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_subscription_id;

    -- Log activation event
    IF v_subscription_id IS NOT NULL THEN
        INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (v_subscription_id, p_tenant_id, 'activated',
                jsonb_build_object('admin_user_id', p_admin_user_id, 'fecha', CURRENT_DATE));
    END IF;

    -- Generate invoice from most recent approved payment
    SELECT id INTO v_payment_id
    FROM public.payments
    WHERE tenant_id = p_tenant_id AND status = 'approved' AND tipo = 'initial'
    ORDER BY created_at DESC LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
        PERFORM public.generar_factura_desde_pago(v_payment_id);
    END IF;
END;
$$;
