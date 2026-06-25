-- Simplify approve_tenant: make empresa/sucursal optional, focus on subscription activation
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
    v_nit TEXT;
    v_plan_id UUID;
    v_subscription_id UUID;
    v_payment_id UUID;
BEGIN
    SELECT nombre_negocio, nit, plan_id INTO v_nombre_negocio, v_nit, v_plan_id
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

    -- Create empresa (optional, continue on error)
    BEGIN
        INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
        VALUES (v_nombre_negocio, 'basico', 'activo', p_tenant_id)
        ON CONFLICT (tenant_id) DO NOTHING;

        INSERT INTO public.sucursales (id, nombre, nit, empresa_id)
        SELECT gen_random_uuid(), v_nombre_negocio || ' - Principal', v_nit, e.id
        FROM public.empresas e WHERE e.tenant_id = p_tenant_id
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Empresa/sucursal creation skipped: %', SQLERRM;
    END;

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
