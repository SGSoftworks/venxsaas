-- Clean database: keep only tenant juandavidgomezruidiaz2004@gmail.com + superadmin + plans
-- Insert test sales data for June 22, 2026

DO $$
DECLARE
    v_tenant_id UUID;
    v_tenant_user_id UUID;
    v_sucursal_id UUID;
    v_superadmin_email TEXT := 'juan.dev1809@gmail.com';
    v_plan_basico_id UUID;
    v_plan_estandar_id UUID;
    v_plan_pro_id UUID;
    v_venta_id UUID;
    v_producto_id UUID;
    v_categoria_id UUID;
    v_apertura_id UUID;
    v_i INTEGER;
    v_j INTEGER;
    v_hora TIME;
    v_total DECIMAL(12,2);
    v_metodo TEXT;
    v_productos JSONB;
    v_producto JSONB;
    v_stock DECIMAL(12,3);
BEGIN
    RAISE NOTICE '=== INICIANDO LIMPIEZA DE BASE DE DATOS ===';

    -- 1. FIND THE TARGET TENANT
    SELECT id, auth_user_id INTO v_tenant_id, v_tenant_user_id
    FROM public.tenants
    WHERE email_propietario = 'juandavidgomezruidiaz2004@gmail.com';

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant con email juandavidgomezruidiaz2004@gmail.com no encontrado';
    END IF;

    RAISE NOTICE 'Tenant encontrado: % (user: %)', v_tenant_id, v_tenant_user_id;

    -- 2. ENSURE ALL 3 PLANS EXIST
    INSERT INTO public.plans (id, nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
    VALUES 
        (gen_random_uuid(), 'Basico', 1, 1, 1490000, 110900, '["1 sucursal con administracion","Hasta 1.000 productos","Reportes generales","Inventario integrado","Soporte presencial segun disponibilidad","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false),
        (gen_random_uuid(), 'Estandar', 4, 4, 1590000, 229900, '["4 sucursales con administracion","Hasta 5.000 productos","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, true),
        (gen_random_uuid(), 'Pro', 10, 10, 1680000, 449900, '["10 sucursales","Productos ilimitados","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false)
    ON CONFLICT (nombre) DO UPDATE SET activo = true, destacado = EXCLUDED.destacado, max_sucursales = EXCLUDED.max_sucursales, max_administradores = EXCLUDED.max_administradores, precio_inicial = EXCLUDED.precio_inicial, precio_mensual = EXCLUDED.precio_mensual;

    SELECT id INTO v_plan_basico_id FROM public.plans WHERE nombre = 'Basico' LIMIT 1;
    SELECT id INTO v_plan_estandar_id FROM public.plans WHERE nombre = 'Estandar' LIMIT 1;
    SELECT id INTO v_plan_pro_id FROM public.plans WHERE nombre = 'Pro' LIMIT 1;

    RAISE NOTICE 'Planes: Basico=%, Estandar=%, Pro=%', v_plan_basico_id, v_plan_estandar_id, v_plan_pro_id;

    -- 3. CLEAN POS DATA (ventas, detalles, inventario, cierres, etc.)
    RAISE NOTICE 'Limpiando datos POS...';
    DELETE FROM public.ventas_conflicto;
    DELETE FROM public.devolucion_detalles;
    DELETE FROM public.devoluciones;
    DELETE FROM public.movimientos_inventario;
    DELETE FROM public.cierres_caja;
    DELETE FROM public.aperturas_caja;
    DELETE FROM public.venta_detalles;
    DELETE FROM public.ventas;
    DELETE FROM public.eventos_auditoria WHERE sucursal_id NOT IN (
        SELECT sucursal_id FROM public.branch_accounts WHERE tenant_id = v_tenant_id
    );

    RAISE NOTICE 'Datos POS limpiados';

    -- 4. CLEAN SaaS DATA (keep only target tenant)
    RAISE NOTICE 'Limpiando datos SaaS...';
    DELETE FROM public.audit_logs WHERE tenant_id != v_tenant_id;
    DELETE FROM public.facturas_saas WHERE tenant_id != v_tenant_id;
    DELETE FROM public.subscription_events WHERE tenant_id != v_tenant_id;
    DELETE FROM public.payments WHERE tenant_id != v_tenant_id;
    DELETE FROM public.subscriptions WHERE tenant_id != v_tenant_id;
    DELETE FROM public.branch_accounts WHERE tenant_id != v_tenant_id;
    DELETE FROM public.tenants WHERE id != v_tenant_id;
    DELETE FROM public.empresas WHERE tenant_id IS NOT NULL AND tenant_id != v_tenant_id;

    RAISE NOTICE 'Datos SaaS limpiados';

    -- 5. UPDATE TARGET TENANT TO ACTIVE WITH PRO PLAN
    UPDATE public.tenants
    SET estado = 'active', plan_id = v_plan_pro_id, updated_at = NOW()
    WHERE id = v_tenant_id;

    -- Ensure active subscription exists
    INSERT INTO public.subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro)
    VALUES (v_tenant_id, v_plan_pro_id, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days')
    ON CONFLICT DO NOTHING;

    UPDATE public.subscriptions
    SET plan_id = v_plan_pro_id, estado = 'active',
        fecha_inicio = COALESCE(fecha_inicio, CURRENT_DATE),
        fecha_renovacion = CURRENT_DATE + INTERVAL '30 days',
        proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id;

    RAISE NOTICE 'Tenant actualizado a Pro activo';

    -- 6. FIND OR CREATE BRANCH/SUCURSAL
    SELECT sucursal_id INTO v_sucursal_id
    FROM public.branch_accounts
    WHERE tenant_id = v_tenant_id AND activo = true AND sucursal_id IS NOT NULL
    LIMIT 1;

    IF v_sucursal_id IS NULL THEN
        -- Create sucursal if none exists
        INSERT INTO public.sucursales (id, nombre, nit, direccion, telefono)
        VALUES (gen_random_uuid(), 'Sucursal Principal', '1030528858', 'KR 39 #13-42', '3228372341')
        RETURNING id INTO v_sucursal_id;

        INSERT INTO public.branch_accounts (tenant_id, sucursal_id, user_id, nombre_sucursal, email, activo)
        VALUES (v_tenant_id, v_sucursal_id, v_tenant_user_id, 'Sucursal Principal', 'juandavidgomezruidiaz2004@gmail.com', true);

        RAISE NOTICE 'Sucursal creada: %', v_sucursal_id;
    ELSE
        RAISE NOTICE 'Sucursal existente: %', v_sucursal_id;
    END IF;

    -- Ensure empresa exists
    INSERT INTO public.empresas (id, nombre, tenant_id, plan, estado)
    VALUES (gen_random_uuid(), 'VenxPOS Demo', v_tenant_id, 'Pro', 'activo')
    ON CONFLICT DO NOTHING;

    -- 7. CREATE CATEGORIES
    DELETE FROM public.categorias WHERE sucursal_id != v_sucursal_id;
    
    INSERT INTO public.categorias (id, sucursal_id, nombre) VALUES
        (gen_random_uuid(), v_sucursal_id, 'Bebidas'),
        (gen_random_uuid(), v_sucursal_id, 'Alimentos'),
        (gen_random_uuid(), v_sucursal_id, 'Lacteos'),
        (gen_random_uuid(), v_sucursal_id, 'Aseo'),
        (gen_random_uuid(), v_sucursal_id, 'Snacks')
    ON CONFLICT DO NOTHING;

    -- 8. CREATE TEST PRODUCTS (10 products)
    RAISE NOTICE 'Creando productos de prueba...';
    
    DELETE FROM public.inventario_sucursal WHERE sucursal_id = v_sucursal_id;
    DELETE FROM public.productos WHERE sucursal_id = v_sucursal_id;

    v_productos := '[
        {"codigo":"7701234000011","nombre":"Coca-Cola 350ml","precio":3500,"costo":2000,"stock":50,"categoria":"Bebidas"},
        {"codigo":"7701234000022","nombre":"Papas Margarita 150g","precio":4500,"costo":2800,"stock":30,"categoria":"Snacks"},
        {"codigo":"7701234000033","nombre":"Arroz Diana 1kg","precio":5200,"costo":3800,"stock":25,"categoria":"Alimentos"},
        {"codigo":"7701234000044","nombre":"Leche Alqueria 1L","precio":4200,"costo":2800,"stock":20,"categoria":"Lacteos"},
        {"codigo":"7701234000055","nombre":"Jabon Protex 120g","precio":3800,"costo":2200,"stock":15,"categoria":"Aseo"},
        {"codigo":"7701234000066","nombre":"Agua Cristal 500ml","precio":2000,"costo":800,"stock":60,"categoria":"Bebidas"},
        {"codigo":"7701234000077","nombre":"Chocolatina Jet 30g","precio":1500,"costo":800,"stock":40,"categoria":"Snacks"},
        {"codigo":"7701234000088","nombre":"Aceite Gourmet 1L","precio":8500,"costo":6000,"stock":12,"categoria":"Alimentos"},
        {"codigo":"7701234000099","nombre":"Yogurt Alpina 200ml","precio":3200,"costo":1800,"stock":18,"categoria":"Lacteos"},
        {"codigo":"7701234000100","nombre":"Detergente Ariel 500g","precio":6500,"costo":4200,"stock":8,"categoria":"Aseo"}
    ]'::JSONB;

    FOR i IN 0..9 LOOP
        v_producto := v_productos->i;
        
        INSERT INTO public.productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, activo, stock_minimo, tarifa_iva, tarifa_impoconsumo, categoria_id)
        VALUES (
            gen_random_uuid(), v_sucursal_id,
            v_producto->>'codigo',
            v_producto->>'nombre',
            (v_producto->>'precio')::DECIMAL(12,2),
            (v_producto->>'costo')::DECIMAL(12,2),
            true, 10, 0.19, 0,
            (SELECT id FROM public.categorias WHERE sucursal_id = v_sucursal_id AND nombre = v_producto->>'categoria' LIMIT 1)
        )
        RETURNING id INTO v_producto_id;

        INSERT INTO public.inventario_sucursal (sucursal_id, producto_id, stock_actual, version, last_updated)
        VALUES (v_sucursal_id, v_producto_id, (v_producto->>'stock')::DECIMAL(12,3), 1, NOW());
    END LOOP;

    RAISE NOTICE '10 productos creados';

    -- 9. APERTURA DE CAJA PARA HOY (find usuario_id from usuarios table)
    INSERT INTO public.aperturas_caja (id, sucursal_id, usuario_id, fondo_inicial, fecha_apertura, estado)
    SELECT
        gen_random_uuid(), v_sucursal_id, u.id, 200000,
        '2026-06-22 07:00:00-05'::TIMESTAMPTZ, 'abierta'
    FROM public.usuarios u
    WHERE u.sucursal_id = v_sucursal_id
    LIMIT 1
    RETURNING id INTO v_apertura_id;

    IF v_apertura_id IS NULL THEN
        -- No usuario found, create one
        INSERT INTO public.usuarios (id, sucursal_id, user_id, nombre, rol, pin_acceso, estado)
        VALUES (gen_random_uuid(), v_sucursal_id, v_tenant_user_id, 'Admin Principal', 'admin', '1234', 'activo')
        RETURNING id INTO v_apertura_id;

        -- Retry apertura
        INSERT INTO public.aperturas_caja (id, sucursal_id, usuario_id, fondo_inicial, fecha_apertura, estado)
        SELECT
            gen_random_uuid(), v_sucursal_id, u.id, 200000,
            '2026-06-22 07:00:00-05'::TIMESTAMPTZ, 'abierta'
        FROM public.usuarios u
        WHERE u.sucursal_id = v_sucursal_id
        LIMIT 1
        RETURNING id INTO v_apertura_id;
    END IF;

    RAISE NOTICE 'Apertura de caja creada: %', v_apertura_id;

    -- 10. GENERATE 25 SALES FOR JUNE 22, 2026
    RAISE NOTICE 'Generando 25 ventas de prueba...';
    
    FOR i IN 1..25 LOOP
        v_hora := MAKE_TIME(7 + FLOOR(RANDOM() * 14)::INT, FLOOR(RANDOM() * 59)::INT, FLOOR(RANDOM() * 59)::INT);
        
        v_metodo := CASE FLOOR(RANDOM() * 3)::INT
            WHEN 0 THEN 'EFECTIVO'
            WHEN 1 THEN 'TARJETA'
            ELSE 'BILLETERA'
        END;

        INSERT INTO public.ventas (id, sucursal_id, cajero_id, total, subtotal, impuestos, metodo_pago, fecha_hora, ticket_number, monto_recibido, cambio_entregado)
        SELECT
            gen_random_uuid(), v_sucursal_id, u.id,
            0, 0, 0, v_metodo,
            ('2026-06-22 ' || v_hora || '-05')::TIMESTAMPTZ,
            i, 0, 0
        FROM public.usuarios u
        WHERE u.sucursal_id = v_sucursal_id
        LIMIT 1
        RETURNING id INTO v_venta_id;

        v_total := 0;
        
        FOR j IN 1..(1 + (RANDOM() * 3)::INT) LOOP
            v_producto := v_productos->((RANDOM() * 9)::INT);
            
            INSERT INTO public.venta_detalles (venta_id, producto_id, cantidad_o_peso, precio_unitario, subtotal, tarifa_iva_aplicada, tarifa_impoconsumo_aplicada, costo_aplicado, descuento)
            SELECT
                v_venta_id,
                p.id,
                1 + (RANDOM() * 2)::INT,
                p.precio_venta,
                p.precio_venta * (1 + (RANDOM() * 2)::INT),
                p.tarifa_iva,
                p.tarifa_impoconsumo,
                p.costo * (1 + (RANDOM() * 2)::INT),
                0
            FROM public.productos p
            WHERE p.sucursal_id = v_sucursal_id
              AND p.codigo_barras = v_producto->>'codigo'
            LIMIT 1;

            v_total := v_total + (v_producto->>'precio')::DECIMAL * (1 + (RANDOM() * 2)::INT);
        END LOOP;

        -- Update sale totals
        UPDATE public.ventas
        SET total = v_total,
            subtotal = ROUND(v_total / 1.19, 2),
            impuestos = ROUND(v_total - (v_total / 1.19), 2),
            monto_recibido = CASE WHEN v_metodo = 'EFECTIVO' THEN ROUND(v_total / 1000)::INT * 1000 + 2000 ELSE v_total END,
            cambio_entregado = CASE WHEN v_metodo = 'EFECTIVO' THEN (ROUND(v_total / 1000)::INT * 1000 + 2000) - v_total ELSE 0 END
        WHERE id = v_venta_id;
    END LOOP;

    -- 11. ADD A FEW PAYMENTS FOR THE TENANT (so InvoicesPage shows data)
    RAISE NOTICE 'Creando pagos de prueba...';
    
    INSERT INTO public.payments (id, tenant_id, gateway_transaction_id, gateway_reference, amount, currency, status, payment_method_type, tipo, created_at)
    VALUES
        (gen_random_uuid(), v_tenant_id, 'tx_test_001', 'PAY-20260601-001', 400000, 'COP', 'approved', 'CARD', 'initial', '2026-06-01 10:00:00-05'::TIMESTAMPTZ),
        (gen_random_uuid(), v_tenant_id, 'tx_test_002', 'PAY-20260622-001', 250000, 'COP', 'approved', 'CARD', 'recurring', '2026-06-22 08:00:00-05'::TIMESTAMPTZ);

    -- Generate invoice for today's payment
    INSERT INTO public.facturas_saas (id, tenant_id, payment_id, gateway_transaction_id, numero_factura, concepto, subtotal, iva, total, moneda, estado, created_at)
    SELECT
        gen_random_uuid(), v_tenant_id, p.id, p.gateway_transaction_id,
        'VENX-2026-000001', 'Renovacion mensual - Plan Pro',
        ROUND(250000 / 1.19, 2), ROUND(250000 - (250000/1.19), 2), 250000,
        'COP', 'pagada', '2026-06-22 08:05:00-05'::TIMESTAMPTZ
    FROM public.payments p
    WHERE p.gateway_reference = 'PAY-20260622-001'
    LIMIT 1;

    RAISE NOTICE '=== BASE DE DATOS LISTA ===';
    RAISE NOTICE 'Resumen:';
    RAISE NOTICE '  - Tenant: juandavidgomezruidiaz2004@gmail.com (Pro, activo)';
    RAISE NOTICE '  - Sucursal: %', v_sucursal_id;
    RAISE NOTICE '  - Productos: 10';
    RAISE NOTICE '  - Ventas hoy: 25';
    RAISE NOTICE '  - Pagos: 2';
    RAISE NOTICE '  - Facturas: 1';
END $$;
