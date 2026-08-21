-- Restore sucursal creation in process_webhook_approval (regression from 20260630000000)
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_estado TEXT;
    v_nombre_negocio TEXT;
    v_tenant_nit TEXT;
    v_empresa_id UUID;
BEGIN
    SELECT estado, nombre_negocio, nit INTO v_tenant_estado, v_nombre_negocio, v_tenant_nit
    FROM public.tenants WHERE id = p_tenant_id;

    IF v_tenant_estado = 'active' THEN RETURN; END IF;

    UPDATE public.payments
    SET status = 'approved',
        gateway_transaction_id = p_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';

    UPDATE public.tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id;

    INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
    VALUES (v_nombre_negocio, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id INTO v_empresa_id;

    -- Create sucursal principal for the tenant
    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.sucursales (id, nombre, nit, empresa_id)
        VALUES (gen_random_uuid(), v_nombre_negocio || ' - Principal', v_tenant_nit, v_empresa_id)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro)
    SELECT p_tenant_id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days'
    FROM public.tenants t WHERE t.id = p_tenant_id
    AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active');

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT s.id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_transaction_id)
    FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.subscription_events e WHERE e.tenant_id = p_tenant_id AND e.tipo = 'activated');
END;
$$;
