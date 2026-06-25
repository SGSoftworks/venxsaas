-- VenxPos — Migration 0003: Consolidated fixes for testing
-- 1. Expand eventos_auditoria.tipo CHECK to include all event types used by frontend
-- 2. Add next_ticket_number RPC
-- 3. Update decrementar_inventario RPC to accept p_usuario_id
-- 4. Add missing index idx_config_fiscal_sucursal

-- =============================================================================
-- 1. Expand eventos_auditoria.tipo CHECK constraint
-- =============================================================================
ALTER TABLE eventos_auditoria DROP CONSTRAINT IF EXISTS eventos_auditoria_tipo_check;
ALTER TABLE eventos_auditoria ADD CONSTRAINT eventos_auditoria_tipo_check
    CHECK (tipo IN (
        'apertura_cajon', 'inicio_sesion', 'inicio_sesion_fallido',
        'cierre_sesion', 'admin_override', 'reimpresion_ticket',
        'cierre_z', 'cierre_caja',
        'conflicto_resuelto', 'ajuste_inventario', 'apertura_caja'
    ));

-- =============================================================================
-- 2. next_ticket_number RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION next_ticket_number(p_sucursal_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    INSERT INTO ventas (id, sucursal_id, cajero_id, subtotal, impuestos, total, metodo_pago, monto_recibido, fecha_hora)
    VALUES (gen_random_uuid(), p_sucursal_id, '00000000-0000-0000-0000-000000000000', 0, 0, 0, 'EFECTIVO', 0, NOW() - INTERVAL '1 year')
    ON CONFLICT (sucursal_id, ticket_number) DO NOTHING
    RETURNING ticket_number INTO v_next;

    IF v_next IS NULL THEN
        SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_next
        FROM ventas
        WHERE sucursal_id = p_sucursal_id;
    END IF;

    DELETE FROM ventas WHERE ticket_number = v_next AND subtotal = 0 AND total = 0;

    RETURN v_next;
END;
$$;

-- =============================================================================
-- 3. Update decrementar_inventario to accept p_usuario_id (5-param version)
-- Drop overloaded 4-param version first, then create 5-param
-- =============================================================================
DROP FUNCTION IF EXISTS decrementar_inventario(UUID, UUID, DECIMAL, UUID);
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

-- =============================================================================
-- 4. Missing index for configuracion_fiscal
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_config_fiscal_sucursal ON configuracion_fiscal(sucursal_id);
