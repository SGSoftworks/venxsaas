-- =============================================================================
-- Migration: RPC process_renewal — Procesa pago recurrente aprobado vía webhook
-- =============================================================================
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_subscription_id UUID;
    v_plan_id UUID;
    v_amount NUMERIC;
BEGIN
    -- Obtener la suscripción activa del tenant
    SELECT id, plan_id INTO v_subscription_id, v_plan_id
    FROM subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No subscription found for tenant %', p_tenant_id;
    END IF;

    SELECT precio_mensual INTO v_amount FROM plans WHERE id = v_plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan not found';
    END IF;

    -- Marcar pago como aprobado
    UPDATE payments SET
        status = 'approved',
        wompi_transaction_id = p_wompi_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Extender suscripción 30 días
    UPDATE subscriptions SET
        estado = 'active',
        fecha_renovacion = CURRENT_DATE + 30,
        proximo_cobro = CURRENT_DATE + 30,
        updated_at = NOW()
    WHERE id = v_subscription_id;

    -- Asegurar tenant activo
    UPDATE tenants SET estado = 'active', updated_at = NOW() WHERE id = p_tenant_id;

    -- Registrar evento
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    VALUES (v_subscription_id, p_tenant_id, 'renewed', jsonb_build_object(
        'payment_id', p_payment_id,
        'wompi_transaction_id', p_wompi_transaction_id,
        'amount', v_amount,
        'date', CURRENT_DATE
    ));
END;
$$;
