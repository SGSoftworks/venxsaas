-- =============================================================================
-- Migration: RPC get_subscription_info — Info de suscripción para POS / SaaS
-- =============================================================================
-- Usado desde el POS desktop (Login.tsx, App.tsx) y el panel SaaS.
-- Devuelve subscription_status dinámico:
--   'active'    → estado='active' AND proximo_cobro >= today
--   'past_due'  → estado='active' AND proximo_cobro < today
--   'expired'   → estado='cancelled'
--   'suspended' → estado='suspended'
-- =============================================================================

DROP FUNCTION IF EXISTS get_subscription_info() CASCADE;

CREATE FUNCTION get_subscription_info()
RETURNS TABLE (
    sucursal_nombre TEXT,
    plan TEXT,
    subscription_status TEXT,
    proximo_cobro DATE,
    max_sucursales INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_id UUID;
    v_subscription RECORD;
    v_plan RECORD;
    v_user_id UUID;
BEGIN
    -- Obtener el usuario autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar tenant del usuario
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    -- Obtener suscripción activa (o la más reciente)
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE tenant_id = v_tenant_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_subscription.id IS NULL THEN
        RETURN;
    END IF;

    -- Obtener plan
    SELECT * INTO v_plan
    FROM plans
    WHERE id = v_subscription.plan_id;

    -- Construir status dinámico
    sucursal_nombre := (SELECT nombre_negocio FROM tenants WHERE id = v_tenant_id);
    plan := v_plan.nombre;
    max_sucursales := v_plan.max_sucursales;
    proximo_cobro := v_subscription.proximo_cobro;

    subscription_status := CASE
        WHEN v_subscription.estado = 'cancelled' THEN 'expired'
        WHEN v_subscription.estado = 'suspended' THEN 'suspended'
        WHEN v_subscription.estado = 'active' AND v_subscription.proximo_cobro IS NOT NULL AND v_subscription.proximo_cobro < CURRENT_DATE THEN 'past_due'
        WHEN v_subscription.estado = 'active' THEN 'active'
        ELSE v_subscription.estado
    END;

    RETURN NEXT;
END;
$$;
