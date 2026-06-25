-- ============================================================
-- FIX 1: subscription_events CHECK constraint missing values
-- ============================================================
ALTER TABLE public.subscription_events DROP CONSTRAINT IF EXISTS subscription_events_tipo_check;
ALTER TABLE public.subscription_events ADD CONSTRAINT subscription_events_tipo_check
  CHECK (tipo IN ('created','activated','renewed','cancelled','expired',
                  'plan_changed','suspended','reactivated','payment_failed',
                  'past_due','pending_approval'));

-- ============================================================
-- FIX 2: facturas_saas CHECK constraint for estado
-- ============================================================
ALTER TABLE public.facturas_saas DROP CONSTRAINT IF EXISTS facturas_saas_estado_check;
ALTER TABLE public.facturas_saas ADD CONSTRAINT facturas_saas_estado_check
  CHECK (estado IN ('emitida','pagada','anulada','reembolsada'));

-- ============================================================
-- NEW: payment_proofs table — comprobantes de pago
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    wompi_reference TEXT,
    amount DECIMAL(12,2),
    payment_date DATE,
    proof_url TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review'
        CHECK (status IN ('pending_review','approved','rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_proofs_tenant ON public.payment_proofs(tenant_id);
CREATE INDEX idx_payment_proofs_status ON public.payment_proofs(status);

-- ============================================================
-- FIX 3: Update approve_tenant to use payment proof if available
-- ============================================================
CREATE OR REPLACE FUNCTION approve_tenant(
    p_tenant_id UUID,
    p_admin_user_id UUID DEFAULT NULL,
    p_payment_proof_id UUID DEFAULT NULL
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
    SELECT nombre_negocio, nit, plan_id INTO v_nombre_negocio, v_tenant_nit, v_plan_id
    FROM public.tenants WHERE id = p_tenant_id;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND estado = 'pending_approval') THEN
        RETURN;
    END IF;

    -- Approve payment proof if provided
    IF p_payment_proof_id IS NOT NULL THEN
        UPDATE public.payment_proofs
        SET status = 'approved', reviewed_by = p_admin_user_id, reviewed_at = NOW()
        WHERE id = p_payment_proof_id AND status = 'pending_review';
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

    -- Generate invoice
    SELECT id INTO v_payment_id
    FROM public.payments
    WHERE tenant_id = p_tenant_id AND status = 'approved' AND tipo = 'initial'
    ORDER BY created_at DESC LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
        PERFORM public.generar_factura_desde_pago(v_payment_id);
    END IF;
END;
$$;
