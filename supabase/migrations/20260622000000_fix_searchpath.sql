-- ============================================================================
-- VenxPOS SaaS — Fix: SET search_path = 'public' en todas las funciones
-- Todas las funciones tenían SET search_path = '' (vacío), lo que oculta las
-- tablas del schema public y causaba "relation does not exist" al ser
-- evaluadas por las RLS policies. Síntoma: 404 en TODAS las queries.
-- ============================================================================

-- 1. get_tenant_id
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT t.id INTO v_tenant_id FROM tenants t WHERE t.auth_user_id = auth.uid() LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;
    SELECT ba.tenant_id INTO v_tenant_id FROM branch_accounts ba WHERE ba.user_id = auth.uid() AND ba.activo = true LIMIT 1;
    RETURN v_tenant_id;
END;
$$;

-- 2. is_superadmin (LA MÁS CRÍTICA — usada en TODAS las RLS policies)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid());
END;
$$;

-- 3. count_branches_for_tenant
CREATE OR REPLACE FUNCTION count_branches_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM branch_accounts WHERE tenant_id = p_tenant_id AND activo = true;
    RETURN v_count;
END;
$$;

-- 4. activate_tenant (última versión con DEFAULT + idempotencia, de 20260620)
CREATE OR REPLACE FUNCTION activate_tenant(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_email TEXT; v_tenant_nombre TEXT; v_tenant_plan_id UUID; v_subscription_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN RETURN; END IF;
    UPDATE payments SET status = 'approved', wompi_transaction_id = p_wompi_transaction_id, updated_at = NOW() WHERE id = p_payment_id;
    UPDATE tenants SET estado = 'active', updated_at = NOW() WHERE id = p_tenant_id
    RETURNING email_propietario, nombre_negocio, plan_id INTO v_tenant_email, v_tenant_nombre, v_tenant_plan_id;
    INSERT INTO empresas (nombre, plan, estado, tenant_id) VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id) ON CONFLICT (tenant_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active') THEN
        INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
        VALUES (p_tenant_id, v_tenant_plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id)
        RETURNING id INTO v_subscription_id;
        INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (v_subscription_id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_wompi_transaction_id));
    END IF;
END;
$$;

-- 5. process_renewal
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_subscription RECORD;
BEGIN
    UPDATE payments SET status = 'approved', wompi_transaction_id = p_wompi_transaction_id, updated_at = NOW()
    WHERE id = p_payment_id AND tenant_id = p_tenant_id;
    SELECT * INTO v_subscription FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active' ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active subscription found for tenant %', p_tenant_id; END IF;
    UPDATE subscriptions SET fecha_renovacion = CURRENT_DATE, proximo_cobro = CURRENT_DATE + INTERVAL '1 month', updated_at = NOW()
    WHERE id = v_subscription.id;
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    VALUES (v_subscription.id, p_tenant_id, 'renewed', jsonb_build_object('payment_id', p_payment_id, 'wompi_transaction_id', p_wompi_transaction_id));
END;
$$;

-- 6. process_webhook_approval (versión más reciente con creación de sucursal, de 20260621)
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
    v_tenant_nombre TEXT; v_tenant_nit TEXT; v_empresa_id UUID; v_subscription_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id AND estado = 'active') THEN RETURN; END IF;
    SELECT nombre_negocio, nit INTO v_tenant_nombre, v_tenant_nit FROM tenants WHERE id = p_tenant_id;
    UPDATE payments SET status = 'approved', wompi_transaction_id = p_transaction_id, updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';
    UPDATE tenants SET estado = 'active', updated_at = NOW() WHERE id = p_tenant_id;
    INSERT INTO empresas (nombre, plan, estado, tenant_id) VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING RETURNING id INTO v_empresa_id;
    INSERT INTO sucursales (id, empresa_id, nombre, nit) VALUES (gen_random_uuid(), v_empresa_id, v_tenant_nombre || ' - Principal', v_tenant_nit) ON CONFLICT DO NOTHING;
    INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
    SELECT t.id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id
    FROM tenants t WHERE t.id = p_tenant_id AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active')
    RETURNING id INTO v_subscription_id;
    IF v_subscription_id IS NOT NULL THEN
        INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (v_subscription_id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_transaction_id));
    END IF;
END;
$$;

-- 7. change_subscription_plan
CREATE OR REPLACE FUNCTION change_subscription_plan(p_tenant_id UUID, p_new_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    UPDATE tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object('new_plan_id', p_new_plan_id) FROM subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- 8. cancel_subscription
CREATE OR REPLACE FUNCTION cancel_subscription(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    UPDATE tenants SET estado = 'cancelled', updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE subscriptions SET estado = 'cancelled', updated_at = NOW() WHERE tenant_id = p_tenant_id;
    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'cancelled', '{}' FROM subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- 9. create_branch
CREATE OR REPLACE FUNCTION create_branch(p_tenant_id UUID, p_nombre_sucursal TEXT, p_email TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_plan_max INTEGER; v_current_count INTEGER; v_empresa_id UUID; v_nit TEXT;
BEGIN
    SELECT p.max_sucursales INTO v_plan_max FROM tenants t JOIN plans p ON t.plan_id = p.id WHERE t.id = p_tenant_id;
    IF NOT FOUND OR v_plan_max IS NULL THEN RETURN jsonb_build_object('error', 'Plan no encontrado'); END IF;
    SELECT COUNT(*) INTO v_current_count FROM branch_accounts WHERE tenant_id = p_tenant_id AND activo = true;
    IF v_current_count >= v_plan_max THEN RETURN jsonb_build_object('error', 'Has alcanzado el limite de sucursales para tu plan'); END IF;
    SELECT e.id, t.nit INTO v_empresa_id, v_nit FROM tenants t LEFT JOIN empresas e ON e.tenant_id = t.id WHERE t.id = p_tenant_id;
    RETURN jsonb_build_object('error', 'Usa la Edge Function create-branch para crear sucursales', 'hint', 'Llama a supabase.functions.invoke("create-branch", ...)');
END;
$$;
