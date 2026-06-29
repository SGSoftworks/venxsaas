-- ============================================================================
-- VenxPOS SaaS — Fix Security RLS Issues
--
-- Corrige:
--   1. pending_signups sin RLS (expone password_hash)
--   2. empresas sin RLS (datos comerciales expuestos)
--   3. storage.objects invoices sin aislamiento por tenant
--   4. audit_logs con INSERT policy demasiado permisiva
--   5. Faltan políticas tenant-owner para:
--      - ventas_conflicto
--      - eventos_auditoria
--      - devoluciones
--      - devolucion_detalles
-- ============================================================================

-- 1. PENDING_SIGNUPS — RLS
-- ============================================================================
-- ANTES: Sin RLS, cualquier authenticated podía leer password_hash
ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;

-- Solo superadmins pueden leer pending_signups
DROP POLICY IF EXISTS "select_pending_signups_superadmin" ON public.pending_signups;
CREATE POLICY "select_pending_signups_superadmin" ON public.pending_signups
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- Solo superadmins pueden actualizar pending_signups
DROP POLICY IF EXISTS "update_pending_signups_superadmin" ON public.pending_signups;
CREATE POLICY "update_pending_signups_superadmin" ON public.pending_signups
    FOR UPDATE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- Solo superadmins pueden eliminar pending_signups
DROP POLICY IF EXISTS "delete_pending_signups_superadmin" ON public.pending_signups;
CREATE POLICY "delete_pending_signups_superadmin" ON public.pending_signups
    FOR DELETE
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- NOTA: INSERT no necesita policy porque las Edge Functions usan
--       supabaseAdmin (service_role) que bypasses RLS.

-- 2. EMPRESAS — RLS
-- ============================================================================
-- ANTES: Sin RLS, cualquier authenticated podía leer/escribir empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Dueño del tenant puede leer su propia empresa
DROP POLICY IF EXISTS "select_own_empresa" ON public.empresas;
CREATE POLICY "select_own_empresa" ON public.empresas
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- Solo superadmins pueden insertar/actualizar/eliminar empresas
DROP POLICY IF EXISTS "superadmin_manage_empresas" ON public.empresas;
CREATE POLICY "superadmin_manage_empresas" ON public.empresas
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- 3. STORAGE.OBJECTS — Invoices con aislamiento por tenant
-- ============================================================================
-- ANTES: cualquier authenticated podía leer TODAS las facturas
DROP POLICY IF EXISTS "public_read_invoices" ON storage.objects;

CREATE POLICY "tenant_read_invoices" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'invoices'
        AND (
            -- El path de la factura es: {tenant_id}/{invoice_id}.pdf
            (storage.foldername(name))[1] IN (
                SELECT t.id::text
                FROM public.tenants t
                WHERE t.auth_user_id = auth.uid()
            )
            OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
        )
    );

-- 4. AUDIT_LOGS — Restringir INSERT
-- ============================================================================
-- ANTES: cualquier authenticated podía insertar audit logs
-- Las Edge Functions usan supabaseAdmin (service_role), no necesitan policy
DROP POLICY IF EXISTS "insert_audit_service" ON public.audit_logs;

-- Solo superadmins pueden insertar audit logs directamente
CREATE POLICY "insert_audit_superadmin" ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- 5. VENTAS_CONFLICTO — Policy tenant-owner faltante
-- ============================================================================
DROP POLICY IF EXISTS "Leer conflictos tenant" ON public.ventas_conflicto;
CREATE POLICY "Leer conflictos tenant" ON public.ventas_conflicto
    FOR SELECT
    TO authenticated
    USING (
        venta_id IN (
            SELECT v.id FROM public.ventas v
            WHERE v.sucursal_id IN (
                SELECT ba.sucursal_id
                FROM public.branch_accounts ba
                WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
                  AND ba.activo = true
                  AND ba.sucursal_id IS NOT NULL
            )
        )
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 6. EVENTOS_AUDITORIA — Policy tenant-owner faltante
-- ============================================================================
DROP POLICY IF EXISTS "Leer eventos tenant" ON public.eventos_auditoria;
CREATE POLICY "Leer eventos tenant" ON public.eventos_auditoria
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 7. DEVOLUCIONES — Policy tenant-owner faltante
-- ============================================================================
DROP POLICY IF EXISTS "Leer devoluciones tenant" ON public.devoluciones;
CREATE POLICY "Leer devoluciones tenant" ON public.devoluciones
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 8. DEVOLUCION_DETALLES — Policy tenant-owner faltante
-- ============================================================================
DROP POLICY IF EXISTS "Leer detalles devolucion tenant" ON public.devolucion_detalles;
CREATE POLICY "Leer detalles devolucion tenant" ON public.devolucion_detalles
    FOR SELECT
    TO authenticated
    USING (
        devolucion_id IN (
            SELECT d.id FROM public.devoluciones d
            WHERE d.sucursal_id IN (
                SELECT ba.sucursal_id
                FROM public.branch_accounts ba
                WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
                  AND ba.activo = true
                  AND ba.sucursal_id IS NOT NULL
            )
        )
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );
