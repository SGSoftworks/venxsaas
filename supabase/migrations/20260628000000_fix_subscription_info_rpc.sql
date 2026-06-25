-- =============================================================================
-- Migration: Fix get_subscription_info — RETURNS JSONB en lugar de TABLE
-- =============================================================================
-- El RPC anterior usaba RETURNS TABLE lo que hace que Supabase devuelva un
-- array, causando que el POS siempre vea undefined.subscription_status y
-- bloquee el acceso aunque la suscripción esté activa.
--
-- Ahora retorna JSONB (objeto único) en vez de TABLE (array de filas).
-- =============================================================================

DROP FUNCTION IF EXISTS get_subscription_info() CASCADE;

CREATE FUNCTION get_subscription_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_id UUID;
    v_sucursal_nombre TEXT;
    v_plan_nombre TEXT;
    v_max_sucursales INTEGER;
    v_proximo_cobro DATE;
    v_subscription_status TEXT;
    v_subscription RECORD;
    v_plan RECORD;
    v_user_id UUID;
BEGIN
    -- Obtener el usuario autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Buscar tenant del usuario
    -- 1. Directo: el usuario es el propietario del tenant
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    -- 2. Por cadena sucursal: el usuario es un cajero de una sucursal
    IF v_tenant_id IS NULL THEN
        SELECT e.tenant_id INTO v_tenant_id
        FROM usuarios u
        JOIN sucursales s ON s.id = u.sucursal_id
        JOIN empresas e ON e.id = s.empresa_id
        WHERE u.user_id = v_user_id
        LIMIT 1;
    END IF;

    -- 3. Por branch_accounts: respaldo directo
    IF v_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM branch_accounts
        WHERE user_id = v_user_id
        LIMIT 1;
    END IF;

    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Obtener suscripción activa (o la más reciente)
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_subscription.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Obtener plan
    SELECT * INTO v_plan
    FROM plans
    WHERE id = v_subscription.plan_id;

    -- Construir status dinámico
    v_sucursal_nombre := (SELECT nombre_negocio FROM tenants WHERE id = v_tenant_id);
    v_plan_nombre := v_plan.nombre;
    v_max_sucursales := v_plan.max_sucursales;
    v_proximo_cobro := v_subscription.proximo_cobro;

    v_subscription_status := CASE
        WHEN v_subscription.estado = 'cancelled' THEN 'expired'
        WHEN v_subscription.estado = 'suspended' THEN 'suspended'
        WHEN v_subscription.estado = 'active' AND v_subscription.proximo_cobro IS NOT NULL AND v_subscription.proximo_cobro < CURRENT_DATE THEN 'past_due'
        WHEN v_subscription.estado = 'active' THEN 'active'
        ELSE v_subscription.estado
    END;

    RETURN jsonb_build_object(
        'sucursal_nombre', v_sucursal_nombre,
        'plan', v_plan_nombre,
        'subscription_status', v_subscription_status,
        'proximo_cobro', v_proximo_cobro,
        'max_sucursales', v_max_sucursales
    );
END;
$$;
