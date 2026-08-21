-- Repara el vinculo entre propietarios de tenants y sus sucursales.
-- Sin user_id, get_my_role() y get_user_sucursal() no resuelven y el
-- login no encuentra la sucursal del usuario.
UPDATE public.branch_accounts ba
SET user_id = t.auth_user_id,
    rol = 'admin_negocio'
FROM public.tenants t
WHERE ba.tenant_id = t.id
  AND ba.user_id IS NULL
  AND t.auth_user_id IS NOT NULL
  AND ba.email = t.email_propietario;
