-- Clean old aperturas and ensure POS can open/close shifts
DELETE FROM public.aperturas_caja;

-- Create a fresh apertura for today linked to the correct usuario
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_sucursal_id UUID;
BEGIN
    SELECT id, auth_user_id INTO v_tenant_id, v_user_id
    FROM public.tenants
    WHERE email_propietario = 'juandavidgomezruidiaz2004@gmail.com';

    SELECT sucursal_id INTO v_sucursal_id
    FROM public.branch_accounts
    WHERE tenant_id = v_tenant_id AND activo = true AND sucursal_id IS NOT NULL
    LIMIT 1;

    INSERT INTO public.aperturas_caja (id, sucursal_id, usuario_id, fondo_inicial, fecha_apertura, estado)
    SELECT gen_random_uuid(), v_sucursal_id, u.id, 200000,
           '2026-06-22 07:00:00-05'::TIMESTAMPTZ, 'abierta'
    FROM public.usuarios u
    WHERE u.user_id = v_user_id AND u.sucursal_id = v_sucursal_id
    LIMIT 1;

    RAISE NOTICE 'Apertura creada para sucursal %', v_sucursal_id;
END $$;
