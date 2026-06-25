-- =============================================================================
-- VenxPOS SaaS Core Migration
-- Date: 2026-06-19
-- Description: Adds multi-tenant SaaS tables, functions, RLS policies, and
--              seed data to the existing VenxPOS database.
-- Impact:      0 modifications to existing POS tables except one safe addition:
--              ALTER TABLE empresas ADD COLUMN tenant_id (nullable).
-- =============================================================================

-- 0. Extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- 1.1 plans: Subscription plans available on the platform
-- =============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    max_sucursales INTEGER NOT NULL,
    max_administradores INTEGER NOT NULL,
    precio_inicial DECIMAL(12,2) NOT NULL,
    precio_mensual DECIMAL(12,2) NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    activo BOOLEAN DEFAULT true,
    destacado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 tenants: Multi-tenant business accounts
-- =============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_negocio TEXT NOT NULL,
    nit TEXT NOT NULL,
    email_propietario TEXT NOT NULL UNIQUE,
    telefono TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (estado IN ('pending_payment','active','suspended','cancelled')),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 subscriptions: Active plan subscriptions per tenant
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    estado TEXT NOT NULL DEFAULT 'pending'
        CHECK (estado IN ('pending','active','past_due','cancelled','expired')),
    fecha_inicio DATE,
    fecha_renovacion DATE,
    proximo_cobro DATE,
    payment_source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 subscription_events: Audit log for subscription lifecycle
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'created','activated','renewed','cancelled','expired',
        'plan_changed','suspended','reactivated','payment_failed'
    )),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 payments: Payment records for subscriptions
-- =============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    wompi_transaction_id TEXT,
    wompi_reference TEXT UNIQUE,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'COP',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','approved','declined','voided','error')),
    payment_method_type TEXT,
    tipo TEXT NOT NULL DEFAULT 'initial'
        CHECK (tipo IN ('initial','recurring','manual','retry')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 branch_accounts: Maps branch (sucursal) users to their tenant
-- =============================================================================
CREATE TABLE IF NOT EXISTS branch_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_sucursal TEXT NOT NULL,
    email TEXT NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 superadmins: Platform-level administrators with full access
-- =============================================================================
CREATE TABLE IF NOT EXISTS superadmins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nombre TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- 2. ALTER EXISTING TABLE (safe, additive only)
-- =============================================================================
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;


-- =============================================================================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER where needed)
-- =============================================================================

-- 3.1 get_tenant_id: Returns the tenant UUID for the currently authenticated
--     user. Checks tenants (owner) first, then branch_accounts (staff).
--     Used by existing POS RLS policies to scope data per tenant.
-- =============================================================================
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Check if the user is a tenant owner
    SELECT t.id INTO v_tenant_id
    FROM tenants t
    WHERE t.auth_user_id = auth.uid()
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
        RETURN v_tenant_id;
    END IF;

    -- Check if the user belongs to a branch account
    SELECT ba.tenant_id INTO v_tenant_id
    FROM branch_accounts ba
    WHERE ba.user_id = auth.uid()
      AND ba.activo = true
    LIMIT 1;

    RETURN v_tenant_id;
END;
$$;

-- 3.2 is_superadmin: Returns true if the authenticated user is a superadmin
-- =============================================================================
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM superadmins WHERE user_id = auth.uid()
    );
END;
$$;

-- 3.3 count_branches_for_tenant: Returns the number of active branch accounts
--     for a given tenant. Used to enforce plan limits.
-- =============================================================================
CREATE OR REPLACE FUNCTION count_branches_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM branch_accounts
    WHERE tenant_id = p_tenant_id
      AND activo = true;

    RETURN v_count;
END;
$$;


-- =============================================================================
-- 4. BUSINESS LOGIC FUNCTIONS (SECURITY DEFINER)
-- =============================================================================

-- 4.1 activate_tenant: Activates a tenant after successful initial payment.
--     Performs the full activation transaction:
--       1. Marks the payment as approved
--       2. Creates the empresa record linked to the tenant
--       3. Creates an active subscription with billing dates
--       4. Logs the activation event
--       5. Updates the tenant estado to 'active'
-- =============================================================================
CREATE OR REPLACE FUNCTION activate_tenant(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT,
    p_payment_source_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_plan_id UUID;
    v_subscription_id UUID;
    v_tenant RECORD;
BEGIN
    -- Fetch tenant data for empresa creation
    SELECT * INTO v_tenant FROM tenants WHERE id = p_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % not found', p_tenant_id;
    END IF;

    -- 1. Update payment record
    UPDATE payments
    SET status = 'approved',
        wompi_transaction_id = p_wompi_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id
      AND tenant_id = p_tenant_id;

    -- 2. Create empresa record linked to tenant
    INSERT INTO empresas (tenant_id, nombre, nit, email, telefono, created_at)
    VALUES (
        p_tenant_id,
        v_tenant.nombre_negocio,
        v_tenant.nit,
        v_tenant.email_propietario,
        v_tenant.telefono,
        NOW()
    );

    -- 3. Create active subscription
    INSERT INTO subscriptions (
        tenant_id,
        plan_id,
        estado,
        fecha_inicio,
        fecha_renovacion,
        proximo_cobro,
        payment_source_id
    )
    VALUES (
        p_tenant_id,
        v_tenant.plan_id,
        'active',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '1 month',
        CURRENT_DATE + INTERVAL '1 month',
        p_payment_source_id
    )
    RETURNING id INTO v_subscription_id;

    -- 4. Log subscription event
    INSERT INTO subscription_events (
        subscription_id,
        tenant_id,
        tipo,
        metadata
    )
    VALUES (
        v_subscription_id,
        p_tenant_id,
        'activated',
        jsonb_build_object(
            'plan_id', v_tenant.plan_id,
            'payment_id', p_payment_id,
            'wompi_transaction_id', p_wompi_transaction_id
        )
    );

    -- 5. Update tenant estado
    UPDATE tenants
    SET estado = 'active',
        updated_at = NOW()
    WHERE id = p_tenant_id;
END;
$$;

-- 4.2 process_renewal: Processes a monthly subscription renewal payment.
--     1. Marks the payment as approved
--     2. Advances subscription billing dates
--     3. Logs the renewal event
-- =============================================================================
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_subscription RECORD;
BEGIN
    -- 1. Update payment record
    UPDATE payments
    SET status = 'approved',
        wompi_transaction_id = p_wompi_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id
      AND tenant_id = p_tenant_id;

    -- 2. Fetch active subscription
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE tenant_id = p_tenant_id
      AND estado = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active subscription found for tenant %', p_tenant_id;
    END IF;

    -- 3. Advance billing dates
    UPDATE subscriptions
    SET fecha_renovacion = CURRENT_DATE,
        proximo_cobro = CURRENT_DATE + INTERVAL '1 month',
        updated_at = NOW()
    WHERE id = v_subscription.id;

    -- 4. Log renewal event
    INSERT INTO subscription_events (
        subscription_id,
        tenant_id,
        tipo,
        metadata
    )
    VALUES (
        v_subscription.id,
        p_tenant_id,
        'renewed',
        jsonb_build_object(
            'previous_renewal', v_subscription.fecha_renovacion,
            'previous_next_billing', v_subscription.proximo_cobro,
            'payment_id', p_payment_id,
            'wompi_transaction_id', p_wompi_transaction_id
        )
    );
END;
$$;


-- =============================================================================
-- 5. TRIGGER FUNCTION (auto-update updated_at)
-- =============================================================================

-- 5.1 trigger_set_updated_at_saas: Sets updated_at = NOW() before UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at_saas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS set_updated_at_tenants ON tenants;
CREATE TRIGGER set_updated_at_tenants
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_saas();

DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON subscriptions;
CREATE TRIGGER set_updated_at_subscriptions
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_saas();

DROP TRIGGER IF EXISTS set_updated_at_payments ON payments;
CREATE TRIGGER set_updated_at_payments
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at_saas();


-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
--    All policies are compatible with existing POS RLS (no conflicts).
--    "service_role" operations do not need explicit policies because
--    Supabase service_role bypasses RLS entirely.
-- =============================================================================

-- 6.1 plans
-- =============================================================================
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read plans
CREATE POLICY "select_plans_auth" ON plans
    FOR SELECT TO authenticated
    USING (true);

-- Only superadmins can insert/update/delete
CREATE POLICY "superadmin_insert_plans" ON plans
    FOR INSERT TO authenticated
    WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_update_plans" ON plans
    FOR UPDATE TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_delete_plans" ON plans
    FOR DELETE TO authenticated
    USING (is_superadmin());


-- 6.2 tenants
-- =============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Users can see their own tenant; superadmins can see all
CREATE POLICY "select_own_tenant" ON tenants
    FOR SELECT TO authenticated
    USING (auth_user_id = auth.uid() OR is_superadmin());

-- Authenticated users can insert during registration (self-service signup)
CREATE POLICY "insert_tenant_auth" ON tenants
    FOR INSERT TO authenticated
    WITH CHECK (auth_user_id = auth.uid());

-- Users can update their own tenant; superadmins can update any
CREATE POLICY "update_own_tenant" ON tenants
    FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid() OR is_superadmin())
    WITH CHECK (auth_user_id = auth.uid() OR is_superadmin());

-- Only superadmins can delete tenants
CREATE POLICY "superadmin_delete_tenants" ON tenants
    FOR DELETE TO authenticated
    USING (is_superadmin());


-- 6.3 subscriptions
-- =============================================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenant owners can see their own subscriptions; superadmins can see all
CREATE POLICY "select_own_subscriptions" ON subscriptions
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Only backend (service_role) can insert subscriptions (bypasses RLS).
-- Superadmins can also insert from the client.
CREATE POLICY "superadmin_insert_subscriptions" ON subscriptions
    FOR INSERT TO authenticated
    WITH CHECK (is_superadmin());

-- Backend (service_role) and superadmins can update subscriptions
CREATE POLICY "superadmin_update_subscriptions" ON subscriptions
    FOR UPDATE TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());


-- 6.4 subscription_events
-- =============================================================================
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Tenant owners can see their own events; superadmins can see all
CREATE POLICY "select_own_events" ON subscription_events
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Only backend (service_role, bypasses RLS) can insert events.
-- No INSERT policy for authenticated users.


-- 6.5 payments
-- =============================================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Tenant owners can see their own payments; superadmins can see all
CREATE POLICY "select_own_payments" ON payments
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Superadmins can insert/update payments from the client
CREATE POLICY "superadmin_insert_payments" ON payments
    FOR INSERT TO authenticated
    WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_update_payments" ON payments
    FOR UPDATE TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());


-- 6.6 branch_accounts
-- =============================================================================
ALTER TABLE branch_accounts ENABLE ROW LEVEL SECURITY;

-- Branch users see their own account; tenant owners see their branches;
-- superadmins see all
CREATE POLICY "select_own_branch" ON branch_accounts
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Tenant owners and superadmins can create branch accounts
CREATE POLICY "insert_branch_accounts" ON branch_accounts
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Tenant owners and superadmins can update branch accounts
CREATE POLICY "update_branch_accounts" ON branch_accounts
    FOR UPDATE TO authenticated
    USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    )
    WITH CHECK (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );

-- Tenant owners and superadmins can delete branch accounts
CREATE POLICY "delete_branch_accounts" ON branch_accounts
    FOR DELETE TO authenticated
    USING (
        tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
        OR is_superadmin()
    );


-- 6.7 superadmins
-- =============================================================================
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;

-- All authenticated users can check if someone is a superadmin
-- (needed for is_superadmin() lookups by non-superadmins)
CREATE POLICY "select_superadmins_auth" ON superadmins
    FOR SELECT TO authenticated
    USING (true);

-- Only existing superadmins can insert/update/delete superadmin records
CREATE POLICY "superadmin_insert_superadmins" ON superadmins
    FOR INSERT TO authenticated
    WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_update_superadmins" ON superadmins
    FOR UPDATE TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

CREATE POLICY "superadmin_delete_superadmins" ON superadmins
    FOR DELETE TO authenticated
    USING (is_superadmin());


-- =============================================================================
-- 7. INDEXES (performance)
-- =============================================================================

-- tenants
CREATE INDEX IF NOT EXISTS idx_tenants_auth_user_id ON tenants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_estado ON tenants(estado);

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_estado ON subscriptions(estado);
CREATE INDEX IF NOT EXISTS idx_subscriptions_proximo_cobro ON subscriptions(proximo_cobro);

-- subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_id ON subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_wompi_transaction_id ON payments(wompi_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- branch_accounts
CREATE INDEX IF NOT EXISTS idx_branch_accounts_tenant_id ON branch_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_accounts_sucursal_id ON branch_accounts(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_branch_accounts_user_id ON branch_accounts(user_id);

-- superadmins
CREATE INDEX IF NOT EXISTS idx_superadmins_user_id ON superadmins(user_id);

-- empresas (support the new tenant_id FK)
CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id ON empresas(tenant_id);


-- =============================================================================
-- 8. SEED DATA
-- =============================================================================

INSERT INTO plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES
    (
        'Básico',
        2,
        2,
        150000,
        80000,
        '["2 sucursales","2 administradores","Reportes","Inventario","Soporte básico"]',
        true,
        false
    ),
    (
        'Estándar',
        5,
        5,
        250000,
        150000,
        '["5 sucursales","5 administradores","Reportes avanzados","Inventario multi-sucursal","Soporte prioritario"]',
        true,
        true
    ),
    (
        'Pro',
        10,
        10,
        400000,
        250000,
        '["10 sucursales","10 administradores","Reportes personalizados","API de acceso","Soporte 24/7"]',
        true,
        false
    ),
    (
        'Empresarial',
        999,
        999,
        0,
        0,
        '["Sucursales ilimitadas","Administradores ilimitados","Personalización total","SLA garantizado","Gerente de cuenta dedicado"]',
        true,
        false
    )
ON CONFLICT (nombre) DO NOTHING;
