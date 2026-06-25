-- VenxPos — Migration 0004: Fix decrementar_inventario overload
-- La migracion anterior (0003) creo una segunda version sobrecargada
-- en vez de reemplazar la original de 4 params. Aqui limpiamos.

DROP FUNCTION IF EXISTS decrementar_inventario(UUID, UUID, DECIMAL, UUID);
DROP FUNCTION IF EXISTS decrementar_inventario(UUID, UUID, DECIMAL, UUID, UUID);

CREATE OR REPLACE FUNCTION decrementar_inventario(
    p_sucursal_id UUID,
    p_producto_id UUID,
    p_cantidad DECIMAL(12,3),
    p_venta_id UUID DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_usuario_id UUID;
BEGIN
    SELECT version, stock_actual INTO v_current_version, v_current_stock
    FROM inventario_sucursal
    WHERE sucursal_id = p_sucursal_id AND producto_id = p_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado en inventario de sucursal %', p_producto_id, p_sucursal_id;
    END IF;

    UPDATE inventario_sucursal
    SET stock_actual = v_current_stock - p_cantidad,
        version = v_current_version + 1,
        last_updated = NOW()
    WHERE sucursal_id = p_sucursal_id
      AND producto_id = p_producto_id
      AND version = v_current_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', p_producto_id, v_current_version;
    END IF;

    v_usuario_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');

    INSERT INTO movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_producto_id, 'venta', -p_cantidad, v_current_stock - p_cantidad, p_venta_id, 'venta', v_usuario_id, NOW());
END;
$$;
