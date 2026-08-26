-- VenxPos — Fix infinite recursion in inventario_sucursal RLS
-- Problema: La policy "Solo admin modifica inventario" (20260729000001)
-- tiene un self-join: JOIN public.inventario_sucursal inv ON inv.sucursal_id = s.id
-- Esto causa recursion infinita cuando PostgreSQL evalua la policy para SELECT.
--
-- Solucion: Dropear la policy rota. Es redundante porque ya existen:
--   - "Leer inventario de sucursal" (SELECT via get_user_sucursal)
--   - "Admin gestiona inventario" (ALL via is_admin)
--   - "Leer inventario tenant" (SELECT via branch_accounts/tenants)

-- 1. Dropear la policy con self-join recursivo
DROP POLICY IF EXISTS "Solo admin modifica inventario" ON public.inventario_sucursal;

-- 2. Verificar que las policies correctas existen
DO $$
BEGIN
    -- SELECT policy (POS users)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventario_sucursal'
          AND policyname = 'Leer inventario de sucursal'
          AND cmd = 'SELECT'
    ) THEN
        CREATE POLICY "Leer inventario de sucursal" ON public.inventario_sucursal
            FOR SELECT USING (sucursal_id = get_user_sucursal());
    END IF;

    -- ALL policy (admin manage)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventario_sucursal'
          AND policyname = 'Admin gestiona inventario'
    ) THEN
        CREATE POLICY "Admin gestiona inventario" ON public.inventario_sucursal
            FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
    END IF;

    -- SELECT policy (tenant owners via SaaS)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventario_sucursal'
          AND policyname = 'Leer inventario tenant'
          AND cmd = 'SELECT'
    ) THEN
        CREATE POLICY "Leer inventario tenant" ON public.inventario_sucursal
            FOR SELECT TO authenticated
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
    END IF;
END $$;

-- 3. Listar policies finales para verificacion
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'inventario_sucursal'
ORDER BY policyname;
