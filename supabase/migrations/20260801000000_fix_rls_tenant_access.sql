-- ============================================================================
-- VenxPOS SaaS — Fix RLS Policies for Tenant Owner Access
--
-- PROBLEMA
--   Las tablas POS (ventas, venta_detalles, productos, etc.) usan RLS con
--   la función get_user_sucursal(), que busca auth.uid() en la tabla
--   "usuarios" (cajeros/admin POS). Los dueños de tenant NO están en
--   "usuarios", por lo que get_user_sucursal() retorna NULL y el SaaS
--   no puede leer ventas, productos, etc.
--
--   Inventario bajo SÍ funciona porque get_low_stock_products() es
--   SECURITY DEFINER y bypasses RLS.
--
-- SOLUCIÓN
--   Agregar políticas adicionales (PostgreSQL OR combina múltiples
--   políticas SELECT) que permitan a los dueños de tenant leer datos
--   de sus sucursales a través de branch_accounts.
-- ============================================================================

-- 1. VENTAS
-- ============================================================================
DROP POLICY IF EXISTS "Leer ventas tenant" ON public.ventas;
CREATE POLICY "Leer ventas tenant" ON public.ventas
    FOR SELECT
    TO authenticated
    USING (
        -- Dueño del tenant: busca sucursales via branch_accounts
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        -- Superadmin
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 2. VENTA_DETALLES
-- ============================================================================
DROP POLICY IF EXISTS "Leer detalles tenant" ON public.venta_detalles;
CREATE POLICY "Leer detalles tenant" ON public.venta_detalles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.ventas v
            WHERE v.id = venta_id
              AND (
                  -- Dueño del tenant
                  v.sucursal_id IN (
                      SELECT ba.sucursal_id
                      FROM public.branch_accounts ba
                      WHERE ba.tenant_id IN (
                          SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
                      )
                        AND ba.activo = true
                        AND ba.sucursal_id IS NOT NULL
                  )
                  OR
                  -- Superadmin
                  EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
              )
        )
    );

-- 3. PRODUCTOS
-- ============================================================================
DROP POLICY IF EXISTS "Leer productos tenant" ON public.productos;
CREATE POLICY "Leer productos tenant" ON public.productos
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 4. INVENTARIO_SUCURSAL
-- ============================================================================
DROP POLICY IF EXISTS "Leer inventario tenant" ON public.inventario_sucursal;
CREATE POLICY "Leer inventario tenant" ON public.inventario_sucursal
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 5. SUCURSALES
-- ============================================================================
-- La política existente "Leer propia sucursal" solo deja ver sucursales
-- donde id = get_user_sucursal(). Agregamos una para dueños de tenant.
DROP POLICY IF EXISTS "Leer sucursales tenant" ON public.sucursales;
CREATE POLICY "Leer sucursales tenant" ON public.sucursales
    FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 6. MOVIMIENTOS_INVENTARIO
-- ============================================================================
DROP POLICY IF EXISTS "Leer movimientos tenant" ON public.movimientos_inventario;
CREATE POLICY "Leer movimientos tenant" ON public.movimientos_inventario
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 7. APERTURAS_CAJA
-- ============================================================================
DROP POLICY IF EXISTS "Leer aperturas tenant" ON public.aperturas_caja;
CREATE POLICY "Leer aperturas tenant" ON public.aperturas_caja
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 8. CIERRES_CAJA
-- ============================================================================
DROP POLICY IF EXISTS "Leer cierres tenant" ON public.cierres_caja;
CREATE POLICY "Leer cierres tenant" ON public.cierres_caja
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 9. CATEGORIAS
-- ============================================================================
DROP POLICY IF EXISTS "Leer categorias tenant" ON public.categorias;
CREATE POLICY "Leer categorias tenant" ON public.categorias
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 10. CONFIGURACION_FISCAL
-- ============================================================================
DROP POLICY IF EXISTS "Leer config fiscal tenant" ON public.configuracion_fiscal;
CREATE POLICY "Leer config fiscal tenant" ON public.configuracion_fiscal
    FOR SELECT
    TO authenticated
    USING (
        sucursal_id IN (
            SELECT ba.sucursal_id
            FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (
                SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid()
            )
              AND ba.activo = true
              AND ba.sucursal_id IS NOT NULL
        )
        OR
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );
