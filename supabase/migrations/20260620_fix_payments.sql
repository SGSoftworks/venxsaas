-- ============================================================================
-- VenxPOS SaaS — Fix Payments: Idempotencia + Constraints + RPCs
-- ============================================================================

-- 1. Unique constraint para evitar empresas duplicadas en activación doble
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_empresas_tenant') THEN
    ALTER TABLE empresas ADD CONSTRAINT uq_empresas_tenant UNIQUE (tenant_id);
  END IF;
END $$;

-- 2. Idempotencia en activate_tenant: no insertar si ya está activo
CREATE OR REPLACE FUNCTION activate_tenant(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_email TEXT;
    v_tenant_nombre TEXT;
    v_tenant_plan_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Idempotencia: si ya activo, no hacer nada
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN
        RETURN;
    END IF;

    -- Actualizar pago
    UPDATE payments SET
        status = 'approved',
        wompi_transaction_id = p_wompi_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id;

    -- Activar tenant
    UPDATE tenants SET
        estado = 'active',
        updated_at = NOW()
    WHERE id = p_tenant_id
    RETURNING email_propietario, nombre_negocio, plan_id
    INTO v_tenant_email, v_tenant_nombre, v_tenant_plan_id;

    -- Crear empresa (compatible con POS)
    INSERT INTO empresas (nombre, plan, estado, tenant_id)
    VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Crear suscripción activa (solo si no tiene una ya)
    IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active') THEN
        INSERT INTO subscriptions (
            tenant_id, plan_id, estado,
            fecha_inicio, fecha_renovacion, proximo_cobro,
            payment_source_id
        )
        VALUES (
            p_tenant_id, v_tenant_plan_id, 'active',
            CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
            CURRENT_DATE + INTERVAL '30 days',
            p_payment_source_id
        )
        RETURNING id INTO v_subscription_id;

        -- Evento de activación
        INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (
            v_subscription_id, p_tenant_id, 'activated',
            jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_wompi_transaction_id)
        );
    END IF;
END;
$$;

-- 3. Nuevo RPC atómico para webhook (combina UPDATE + activación en una llamada)
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Idempotencia: si tenant ya activo, no hacer nada
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN
        RETURN;
    END IF;

    -- Actualizar pago (solo si no estaba ya aprobado)
    UPDATE payments
    SET status = 'approved',
        wompi_transaction_id = p_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';

    -- Activar tenant
    UPDATE tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id;

    -- Crear empresa
    INSERT INTO empresas (nombre, plan, estado, tenant_id)
    SELECT nombre_negocio, 'basico', 'activo', id
    FROM tenants WHERE id = p_tenant_id
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Crear suscripción activa (solo si no existe)
    INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
    SELECT t.id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id
    FROM tenants t WHERE t.id = p_tenant_id
    AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active');

    -- Evento
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT s.id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_transaction_id)
    FROM subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active';
END;
$$;

-- 4. RPC para cambio de plan
CREATE OR REPLACE FUNCTION change_subscription_plan(
    p_tenant_id UUID,
    p_new_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object('new_plan_id', p_new_plan_id)
    FROM subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- 5. RPC para cancelar suscripción
CREATE OR REPLACE FUNCTION cancel_subscription(
    p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE tenants SET estado = 'cancelled', updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE subscriptions SET estado = 'cancelled', updated_at = NOW() WHERE tenant_id = p_tenant_id;
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'cancelled', '{}'
    FROM subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- 6. RLS fix: tenants no pueden cambiar su propio estado
DROP POLICY IF EXISTS "update_own_tenant" ON tenants;
CREATE POLICY "update_own_tenant" ON tenants
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid() OR is_superadmin())
    WITH CHECK (
        is_superadmin()
        OR (auth_user_id = auth.uid() AND estado IS NOT DISTINCT FROM (
            SELECT estado FROM tenants WHERE id = (SELECT get_tenant_id())
        ))
    );
