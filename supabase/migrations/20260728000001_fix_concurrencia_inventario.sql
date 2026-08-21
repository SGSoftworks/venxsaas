-- ============================================================
-- Fase 4: Concurrencia inventario multi-cajero
-- FOR UPDATE + optimistic versioning + auditoria en todos los
-- RPCs de inventario. Nuevo RPC finalizar_venta transaccional.
-- ============================================================

-- ============================================================
-- 1. Fix adjust_tenant_product_stock con FOR UPDATE + auditoria
-- ============================================================
CREATE OR REPLACE FUNCTION public.adjust_tenant_product_stock(
    p_tenant_id UUID, p_producto_id UUID,
    p_tipo TEXT, p_cantidad DECIMAL(12,3),
    p_observacion TEXT DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sucursal_id UUID;
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_new_stock DECIMAL(12,3);
    v_usuario_id UUID;
BEGIN
    -- Validar pertenencia al tenant
    SELECT p.sucursal_id INTO v_sucursal_id
    FROM public.productos p
    JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
    WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true;

    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    -- Bloquear fila + leer version actual
    SELECT version, stock_actual INTO v_current_version, v_current_stock
    FROM public.inventario_sucursal
    WHERE sucursal_id = v_sucursal_id AND producto_id = p_producto_id
    FOR UPDATE;

    v_current_stock := COALESCE(v_current_stock, 0);

    IF p_tipo = 'entrada' THEN
        v_new_stock := v_current_stock + p_cantidad;
    ELSIF p_tipo = 'salida' THEN
        IF v_current_stock < p_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente: actual %s, requerido %s', v_current_stock, p_cantidad;
        END IF;
        v_new_stock := v_current_stock - p_cantidad;
    ELSE
        v_new_stock := p_cantidad;
    END IF;

    -- UPDATE con version check (optimistic lock)
    UPDATE public.inventario_sucursal
    SET stock_actual = v_new_stock,
        version = v_current_version + 1,
        last_updated = NOW()
    WHERE sucursal_id = v_sucursal_id
      AND producto_id = p_producto_id
      AND version = v_current_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', p_producto_id, v_current_version;
    END IF;

    -- Registrar auditoria
    v_usuario_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');
    INSERT INTO public.movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, observacion, usuario_id, created_at)
    VALUES (gen_random_uuid(), v_sucursal_id, p_producto_id, p_tipo, p_cantidad, v_new_stock, NULL, 'ajuste_manual', p_observacion, v_usuario_id, NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_tenant_product_stock TO authenticated;

-- ============================================================
-- 2. RPC finalizar_venta: transaccional, multiple productos
-- ============================================================
-- Procesa una venta desde el POS: descuenta inventario de cada
-- producto dentro de una sola transaccion, crea la venta y sus
-- detalles. Si falla algun producto, se revierte todo.
CREATE OR REPLACE FUNCTION public.finalizar_venta(
    p_sucursal_id UUID,
    p_cajero_id UUID,
    p_productos JSONB,  -- [{"id": UUID, "cantidad": DECIMAL, "precio": DECIMAL, "iva": DECIMAL}, ...]
    p_subtotal DECIMAL(12,2),
    p_impuestos DECIMAL(12,2),
    p_total DECIMAL(12,2),
    p_metodo_pago TEXT DEFAULT 'EFECTIVO',
    p_monto_recibido DECIMAL(12,2) DEFAULT 0,
    p_cambio_entregado DECIMAL(12,2) DEFAULT 0,
    p_cliente_nombre TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_observacion TEXT DEFAULT NULL
)
RETURNS UUID  -- venta_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_venta_id UUID;
    v_producto JSONB;
    v_producto_id UUID;
    v_cantidad DECIMAL(12,3);
    v_precio DECIMAL(12,2);
    v_iva DECIMAL(5,3);
    v_costo DECIMAL(12,2);
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_new_stock DECIMAL(12,3);
    v_ticket_number BIGINT;
BEGIN
    -- Generar ticket number secuencial por sucursal
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_ticket_number
    FROM public.ventas
    WHERE sucursal_id = p_sucursal_id;

    -- Crear la venta (cabecera)
    INSERT INTO public.ventas (id, sucursal_id, cajero_id, subtotal, impuestos, total, metodo_pago, monto_recibido, cambio_entregado, ticket_number, fecha_hora, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_cajero_id, p_subtotal, p_impuestos, p_total, p_metodo_pago, p_monto_recibido, p_cambio_entregado, v_ticket_number, NOW(), NOW())
    RETURNING id INTO v_venta_id;

    -- Procesar cada producto
    FOR v_producto IN SELECT * FROM jsonb_array_elements(p_productos)
    LOOP
        v_producto_id := (v_producto->>'id')::UUID;
        v_cantidad := (v_producto->>'cantidad')::DECIMAL(12,3);
        v_precio := (v_producto->>'precio')::DECIMAL(12,2);
        v_iva := COALESCE((v_producto->>'iva')::DECIMAL(5,3), 0.190);

        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad invalida para producto %', v_producto_id;
        END IF;

        -- Obtener costo del producto
        SELECT costo INTO v_costo
        FROM public.productos
        WHERE id = v_producto_id AND sucursal_id = p_sucursal_id;

        IF v_costo IS NULL THEN
            RAISE EXCEPTION 'Producto % no pertenece a sucursal %', v_producto_id, p_sucursal_id;
        END IF;

        -- Bloquear fila de inventario + leer version
        SELECT version, stock_actual INTO v_current_version, v_current_stock
        FROM public.inventario_sucursal
        WHERE sucursal_id = p_sucursal_id AND producto_id = v_producto_id
        FOR UPDATE;

        v_current_stock := COALESCE(v_current_stock, 0);

        IF v_current_stock < v_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %: actual %s, requerido %s',
                v_producto_id, v_current_stock, v_cantidad;
        END IF;

        v_new_stock := v_current_stock - v_cantidad;

        -- UPDATE con version check
        UPDATE public.inventario_sucursal
        SET stock_actual = v_new_stock,
            version = v_current_version + 1,
            last_updated = NOW()
        WHERE sucursal_id = p_sucursal_id
          AND producto_id = v_producto_id
          AND version = v_current_version;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', v_producto_id, v_current_version;
        END IF;

        -- Insertar detalle de venta
        INSERT INTO public.venta_detalles (id, venta_id, producto_id, cantidad_o_peso, precio_unitario, subtotal, tarifa_iva_aplicada, tarifa_impoconsumo_aplicada, costo_aplicado)
        VALUES (gen_random_uuid(), v_venta_id, v_producto_id, v_cantidad, v_precio, v_cantidad * v_precio, v_iva, 0, v_costo);

        -- Registrar movimiento de inventario
        INSERT INTO public.movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
        VALUES (gen_random_uuid(), p_sucursal_id, v_producto_id, 'venta', -v_cantidad, v_new_stock, v_venta_id, 'venta', p_cajero_id, NOW());
    END LOOP;

    RETURN v_venta_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalizar_venta TO authenticated;
