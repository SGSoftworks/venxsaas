-- =============================================================================
-- Migration: RPC renew_subscription — Renovación manual de suscripción
-- =============================================================================
-- Crea un pago recurrente aprobado y extiende la suscripción 30 días.
-- Usado desde el dashboard del cliente y del superadmin.
-- =============================================================================

CREATE OR REPLACE FUNCTION renew_subscription(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_subscription_id UUID;
    v_plan_id UUID;
    v_amount NUMERIC;
    v_payment_id UUID;
BEGIN
    -- Obtener suscripción activa
    SELECT id, plan_id INTO v_subscription_id, v_plan_id
    FROM subscriptions
    WHERE tenant_id = p_tenant_id AND estado = 'active';

    IF NOT FOUND THEN
        -- Si no hay active, buscar cualquier suscripción y activarla
        SELECT id, plan_id INTO v_subscription_id, v_plan_id
        FROM subscriptions
        WHERE tenant_id = p_tenant_id
        ORDER BY created_at DESC LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('error', 'No hay suscripción para este tenant');
        END IF;
    END IF;

    -- Obtener monto del plan
    SELECT precio_mensual INTO v_amount FROM plans WHERE id = v_plan_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Plan no encontrado');
    END IF;

    -- Crear pago recurrente aprobado
    INSERT INTO payments (tenant_id, subscription_id, amount, currency, status, payment_method_type, tipo)
    VALUES (p_tenant_id, v_subscription_id, v_amount, 'COP', 'approved', 'RECURRING', 'recurring')
    RETURNING id INTO v_payment_id;

    -- Actualizar suscripción
    UPDATE subscriptions SET
        estado = 'active',
        plan_id = v_plan_id,
        fecha_renovacion = CURRENT_DATE + 30,
        proximo_cobro = CURRENT_DATE + 30,
        updated_at = NOW()
    WHERE id = v_subscription_id;

    -- Asegurar tenant activo
    UPDATE tenants SET estado = 'active', updated_at = NOW() WHERE id = p_tenant_id;

    -- Registrar evento
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    VALUES (v_subscription_id, p_tenant_id, 'renewed', jsonb_build_object(
        'payment_id', v_payment_id,
        'amount', v_amount,
        'date', CURRENT_DATE
    ));

    RETURN jsonb_build_object('ok', true, 'payment_id', v_payment_id, 'proximo_cobro', (CURRENT_DATE + 30)::TEXT);
END;
$$;
