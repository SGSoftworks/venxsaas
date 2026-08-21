-- ============================================================
-- Fase 10: Multitenancy — auditoria y fortalecimiento RLS
-- ============================================================

-- ============================================================
-- 1. Verificar RLS activo en todas las tablas del schema public
-- ============================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename NOT IN ('spatial_ref_sys')
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = tbl AND rowsecurity = true
        ) THEN
            RAISE WARNING 'Tabla sin RLS: %', tbl;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================
-- 2. Reforzar RLS en payments: solo superadmin o propio tenant
-- ============================================================
DROP POLICY IF EXISTS "Superadmin ve todos los pagos" ON public.payments;
CREATE POLICY "Superadmin ve todos los pagos" ON public.payments
FOR ALL
USING (
    is_superadmin() OR
    tenant_id = get_tenant_id()
);

-- ============================================================
-- 3. Reforzar RLS en facturas_saas
-- ============================================================
DROP POLICY IF EXISTS "Superadmin ve todas las facturas" ON public.facturas_saas;
CREATE POLICY "Superadmin ve todas las facturas" ON public.facturas_saas
FOR ALL
USING (
    is_superadmin() OR
    tenant_id = get_tenant_id()
);

-- ============================================================
-- 4. Reforzar RLS en subscriptions
-- ============================================================
DROP POLICY IF EXISTS "Superadmin ve todas las suscripciones" ON public.subscriptions;
CREATE POLICY "Superadmin ve todas las suscripciones" ON public.subscriptions
FOR ALL
USING (
    is_superadmin() OR
    tenant_id = get_tenant_id()
);

-- ============================================================
-- 5. Reforzar RLS en subscription_events
-- ============================================================
DROP POLICY IF EXISTS "Superadmin ve todos los eventos" ON public.subscription_events;
CREATE POLICY "Superadmin ve todos los eventos" ON public.subscription_events
FOR ALL
USING (
    is_superadmin() OR
    tenant_id = get_tenant_id()
);

-- ============================================================
-- 6. Reforzar RLS en subscription_requests
-- ============================================================
DROP POLICY IF EXISTS "Superadmin ve todas las solicitudes" ON public.subscription_requests;
CREATE POLICY "Superadmin ve todas las solicitudes" ON public.subscription_requests
FOR ALL
USING (
    is_superadmin() OR
    tenant_id = get_tenant_id()
);
