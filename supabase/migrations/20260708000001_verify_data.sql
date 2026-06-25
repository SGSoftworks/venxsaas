-- Verify test data exists and is accessible
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_sucursal_id UUID;
    v_branch_count INTEGER;
    v_sale_count INTEGER;
    v_product_count INTEGER;
    v_usuario_count INTEGER;
BEGIN
    SELECT id, auth_user_id INTO v_tenant_id, v_user_id
    FROM public.tenants
    WHERE email_propietario = 'juandavidgomezruidiaz2004@gmail.com';

    RAISE NOTICE 'Tenant: %, User: %', v_tenant_id, v_user_id;

    -- Check branch_accounts
    SELECT COUNT(*) INTO v_branch_count
    FROM public.branch_accounts
    WHERE tenant_id = v_tenant_id AND activo = true AND sucursal_id IS NOT NULL;

    RAISE NOTICE 'Branch accounts activas: %', v_branch_count;

    -- Get sucursal
    SELECT sucursal_id INTO v_sucursal_id
    FROM public.branch_accounts
    WHERE tenant_id = v_tenant_id AND activo = true AND sucursal_id IS NOT NULL
    LIMIT 1;

    RAISE NOTICE 'Sucursal ID: %', v_sucursal_id;

    -- Count sales
    IF v_sucursal_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_sale_count
        FROM public.ventas
        WHERE sucursal_id = v_sucursal_id;

        RAISE NOTICE 'Ventas para sucursal: %', v_sale_count;

        SELECT COUNT(*) INTO v_product_count
        FROM public.productos
        WHERE sucursal_id = v_sucursal_id;

        RAISE NOTICE 'Productos para sucursal: %', v_product_count;

        -- Check usuario exists for auth user
        SELECT COUNT(*) INTO v_usuario_count
        FROM public.usuarios
        WHERE user_id = v_user_id;

        RAISE NOTICE 'Usuarios con auth.user_id: %', v_usuario_count;

        -- If no usuario, create one
        IF v_usuario_count = 0 THEN
            INSERT INTO public.usuarios (id, sucursal_id, user_id, nombre, rol, pin_acceso, estado)
            VALUES (gen_random_uuid(), v_sucursal_id, v_user_id, 'Admin Principal', 'admin', '1234', 'activo');
            RAISE NOTICE 'Usuario creado para RLS';
        END IF;
    END IF;
END $$;
