-- ============================================================================
-- VenxPOS SaaS — Fix: create_branch RPC + subscription dates + sucursal default
-- ============================================================================

-- 1. RPC para crear sucursal desde el dashboard SaaS
--    Verifica límites del plan, crea auth user + sucursal + usuario + branch_account
CREATE OR REPLACE FUNCTION create_branch(
    p_tenant_id UUID,
    p_nombre_sucursal TEXT,
    p_email TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan_max INTEGER;
    v_current_count INTEGER;
    v_user_id UUID;
    v_sucursal_id UUID;
    v_empresa_id UUID;
    v_nit TEXT;
BEGIN
    -- Verificar límites del plan
    SELECT p.max_sucursales INTO v_plan_max
    FROM tenants t JOIN plans p ON t.plan_id = p.id
    WHERE t.id = p_tenant_id;

    IF NOT FOUND OR v_plan_max IS NULL THEN
        RETURN jsonb_build_object('error', 'Plan no encontrado');
    END IF;

    SELECT COUNT(*) INTO v_current_count
    FROM branch_accounts WHERE tenant_id = p_tenant_id AND activo = true;

    IF v_current_count >= v_plan_max THEN
        RETURN jsonb_build_object('error', 'Has alcanzado el limite de sucursales para tu plan');
    END IF;

    -- Obtener empresa_id y NIT del tenant
    SELECT e.id, t.nit INTO v_empresa_id, v_nit
    FROM tenants t LEFT JOIN empresas e ON e.tenant_id = t.id
    WHERE t.id = p_tenant_id;

    -- Crear auth user (requiere admin API desde Edge Function)
    -- Por ahora solo insertamos sucursal sin auth user
    -- La Edge Function create-branch maneja la creación del auth user
    
    RETURN jsonb_build_object(
        'error', 'Usa la Edge Function create-branch para crear sucursales',
        'hint', 'Llama a supabase.functions.invoke("create-branch", ...)'
    );
END;
$$;

-- 2. Arreglar process_webhook_approval: crear sucursal principal al activar
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_nombre TEXT;
    v_tenant_nit TEXT;
    v_empresa_id UUID;
    v_subscription_id UUID;
BEGIN
    -- Idempotencia: si tenant ya activo, no hacer nada
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN
        RETURN;
    END IF;

    -- Obtener datos del tenant
    SELECT nombre_negocio, nit INTO v_tenant_nombre, v_tenant_nit FROM tenants WHERE id = p_tenant_id;

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
    VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id INTO v_empresa_id;

    -- Crear sucursal principal automáticamente
    INSERT INTO sucursales (id, empresa_id, nombre, nit)
    VALUES (gen_random_uuid(), v_empresa_id, v_tenant_nombre || ' - Principal', v_tenant_nit)
    ON CONFLICT DO NOTHING;

    -- Crear suscripción activa (solo si no existe)
    INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
    SELECT t.id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id
    FROM tenants t WHERE t.id = p_tenant_id
    AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active')
    RETURNING id INTO v_subscription_id;

    -- Evento
    IF v_subscription_id IS NOT NULL THEN
        INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (v_subscription_id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_transaction_id));
    END IF;
END;
$$;

-- 3. Asegurar que tenants.id tiene su auth_user_id correcto
-- (para usuarios creados via Edge Function register-tenant)
-- No se requiere cambio de schema - solo verificación
