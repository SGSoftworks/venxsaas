-- =============================================================================
-- Migration: Fix process_webhook_approval — UPDATE en vez de INSERT duplicado
-- =============================================================================
-- El problema: al activar un pago, INSERTaba una nueva fila en subscriptions
-- en vez de actualizar la existente, creando duplicados (pending + active).
-- La frontend usaba .maybeSingle() y fallaba por las múltiples filas.
-- =============================================================================

-- 1. Limpiar duplicados: por cada tenant, mantener SOLO la fila activa más reciente
--    (o la pending más reciente si no hay active)
DELETE FROM subscriptions a
USING subscriptions b
WHERE a.tenant_id = b.tenant_id
  AND (
    -- Si hay una active y otra no, borrar la no-active
    (b.estado = 'active' AND a.estado != 'active' AND a.created_at < b.created_at)
    OR
    -- Si ambas son del mismo estado, borrar la más vieja
    (a.estado = b.estado AND a.created_at < b.created_at AND a.id != b.id)
  );

-- 2. Reemplazar process_webhook_approval con UPSERT
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_nombre TEXT;
    v_tenant_nit TEXT;
    v_empresa_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Idempotencia: si ya está activo, salir
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN
        RETURN;
    END IF;

    SELECT nombre_negocio, nit INTO v_tenant_nombre, v_tenant_nit
    FROM tenants WHERE id = p_tenant_id;

    -- Actualizar pago
    UPDATE payments
    SET status = 'approved',
        gateway_transaction_id = p_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';

    -- Actualizar tenant
    UPDATE tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id;

    -- Crear empresa si no existe
    INSERT INTO empresas (nombre, plan, estado, tenant_id)
    VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id INTO v_empresa_id;

    -- Crear sucursal principal si no existe
    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO sucursales (id, empresa_id, nombre, nit)
        VALUES (gen_random_uuid(), v_empresa_id, v_tenant_nombre || ' - Principal', v_tenant_nit)
        ON CONFLICT DO NOTHING;
    END IF;

    -- UPSERT: actualizar subscription existente o insertar nueva
    UPDATE subscriptions SET
        plan_id = (SELECT plan_id FROM tenants WHERE id = p_tenant_id),
        estado = 'active',
        fecha_inicio = COALESCE(fecha_inicio, CURRENT_DATE),
        fecha_renovacion = CURRENT_DATE + 30,
        proximo_cobro = CURRENT_DATE + 30,
        payment_source_id = p_payment_source_id,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
        SELECT t.id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id
        FROM tenants t WHERE t.id = p_tenant_id
        RETURNING id INTO v_subscription_id;
    ELSE
        SELECT id INTO v_subscription_id FROM subscriptions WHERE tenant_id = p_tenant_id;
    END IF;

    -- Registrar evento
    IF v_subscription_id IS NOT NULL THEN
        INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (v_subscription_id, p_tenant_id, 'activated', jsonb_build_object(
            'payment_id', p_payment_id,
            'transaction_id', p_transaction_id
        ));
    END IF;
END;
$$;
