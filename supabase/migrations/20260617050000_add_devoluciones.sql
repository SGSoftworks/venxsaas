-- VenxPos — Migration 0005: Devoluciones / Notas crédito

CREATE TABLE devoluciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id         UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id           UUID NOT NULL REFERENCES usuarios(id),
    venta_original_id   UUID NOT NULL REFERENCES ventas(id),
    ticket_original     BIGINT,
    subtotal            DECIMAL(12,2) NOT NULL CHECK (subtotal <= 0),
    impuestos           DECIMAL(12,2) NOT NULL CHECK (impuestos <= 0),
    total               DECIMAL(12,2) NOT NULL CHECK (total <= 0),
    metodo_pago         TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'BILLETERA', 'MIXTO')),
    fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo              TEXT,
    hash                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devolucion_detalles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devolucion_id               UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    producto_id                 UUID NOT NULL REFERENCES productos(id),
    cantidad                    DECIMAL(12,3) NOT NULL CHECK (cantidad < 0),
    precio_unitario             DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal                    DECIMAL(12,2) NOT NULL CHECK (subtotal <= 0),
    tarifa_iva_aplicada         DECIMAL(5,3) NOT NULL,
    tarifa_impoconsumo_aplicada DECIMAL(5,3) NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devoluciones_sucursal ON devoluciones(sucursal_id, fecha_hora DESC);
CREATE INDEX idx_devoluciones_original ON devoluciones(venta_original_id);
CREATE INDEX idx_devolucion_detalles_dev ON devolucion_detalles(devolucion_id);

-- RLS
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_detalles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leer devoluciones sucursal"
    ON devoluciones FOR SELECT USING (sucursal_id = get_user_sucursal());

CREATE POLICY "Insertar devoluciones"
    ON devoluciones FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());

CREATE POLICY "Leer detalles devolucion"
    ON devolucion_detalles FOR SELECT USING (
        devolucion_id IN (SELECT id FROM devoluciones WHERE sucursal_id = get_user_sucursal())
    );

CREATE POLICY "Insertar detalles devolucion"
    ON devolucion_detalles FOR INSERT WITH CHECK (
        devolucion_id IN (SELECT id FROM devoluciones WHERE sucursal_id = get_user_sucursal())
    );

-- RPC: incrementar_inventario (para devoluciones)
CREATE OR REPLACE FUNCTION incrementar_inventario(
    p_sucursal_id UUID,
    p_producto_id UUID,
    p_cantidad DECIMAL(12,3),
    p_devolucion_id UUID DEFAULT NULL,
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
    SET stock_actual = v_current_stock + p_cantidad,
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
    VALUES (gen_random_uuid(), p_sucursal_id, p_producto_id, 'devolucion', p_cantidad, v_current_stock + p_cantidad, p_devolucion_id, 'devolucion', v_usuario_id, NOW());
END;
$$;

-- Trigger updated_at
CREATE TRIGGER set_updated_at_devoluciones
    BEFORE UPDATE ON devoluciones FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
