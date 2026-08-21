-- ============================================================
-- Fase 5: Roles y permisos (admin_negocio vs cajero)
-- ============================================================

-- ============================================================
-- 1. Agregar columna rol a branch_accounts
-- ============================================================
ALTER TABLE public.branch_accounts
ADD COLUMN IF NOT EXISTS rol TEXT NOT NULL DEFAULT 'cajero'
CHECK (rol IN ('admin_negocio', 'cajero'));

-- Asignar admin_negocio a los propietarios de tenant
UPDATE public.branch_accounts ba
SET rol = 'admin_negocio'
FROM public.tenants t
WHERE ba.tenant_id = t.id AND ba.user_id = t.auth_user_id;

-- ============================================================
-- 2. RPC para obtener el rol del usuario en su tenant
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT ba.rol FROM public.branch_accounts ba
         WHERE ba.user_id = auth.uid() AND ba.activo = true
         LIMIT 1),
        'cajero'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;

-- ============================================================
-- 3. RPC: es_admin_negocio() para RLS y guards
-- ============================================================
CREATE OR REPLACE FUNCTION public.es_admin_negocio()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.branch_accounts
        WHERE user_id = auth.uid() AND rol = 'admin_negocio' AND activo = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.es_admin_negocio TO authenticated;

-- ============================================================
-- 4. RLS: solo admin_negocio puede modificar inventario
-- ============================================================
CREATE POLICY "Solo admin modifica inventario" ON public.inventario_sucursal
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.branch_accounts ba
        JOIN public.sucursales s ON s.id = ba.sucursal_id
        JOIN public.inventario_sucursal inv ON inv.sucursal_id = s.id
        WHERE ba.user_id = auth.uid() AND ba.rol = 'admin_negocio' AND ba.activo = true
    )
);

-- ============================================================
-- 5. RLS en branch_accounts: cada quien ve sus datos
-- ============================================================
DROP POLICY IF EXISTS "Usuarios ven sus propias branch_accounts" ON public.branch_accounts;
CREATE POLICY "Usuarios ven sus propias branch_accounts" ON public.branch_accounts
FOR SELECT
USING (user_id = auth.uid() OR es_admin_negocio());
