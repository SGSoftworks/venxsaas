-- VenxPos Supabase Schema
-- Production schema migrated to Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Base tables
CREATE TABLE sucursales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    nit             TEXT NOT NULL,
    direccion       TEXT,
    telefono        TEXT,
    resolucion_dian TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    rol             TEXT NOT NULL CHECK (rol IN ('cajero', 'admin')),
    nombre          TEXT NOT NULL,
    pin_acceso      TEXT NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categorias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    parent_id       UUID REFERENCES categorias(id) ON DELETE SET NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Functions
CREATE OR REPLACE FUNCTION get_user_sucursal()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sucursal_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT rol = 'admin' FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Operational tables
CREATE TABLE productos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id         UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo_barras       TEXT NOT NULL,
    descripcion         TEXT NOT NULL,
    precio_venta        DECIMAL(12,2) NOT NULL CHECK (precio_venta >= 0),
    costo               DECIMAL(12,2) NOT NULL CHECK (costo >= 0),
    requiere_peso       BOOLEAN NOT NULL DEFAULT false,
    tarifa_iva          DECIMAL(5,3) NOT NULL DEFAULT 0.19 CHECK (tarifa_iva IN (0, 0.05, 0.19)),
    tarifa_impoconsumo  DECIMAL(5,4) NOT NULL DEFAULT 0 CHECK (tarifa_impoconsumo IN (0, 0.08, 0.16)),
    activo              BOOLEAN NOT NULL DEFAULT true,
    categoria_id        UUID REFERENCES categorias(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, codigo_barras)
);

CREATE TABLE inventario_sucursal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    stock_actual    DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    version         INTEGER NOT NULL DEFAULT 1,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, producto_id)
);

CREATE TABLE aperturas_caja (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    usuario_id        UUID NOT NULL REFERENCES usuarios(id),
    fondo_inicial     DECIMAL(12,2) NOT NULL CHECK (fondo_inicial >= 0),
    efectivo_esperado DECIMAL(12,2),
    fecha_apertura    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre      TIMESTAMPTZ,
    estado            TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ventas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id         UUID NOT NULL REFERENCES usuarios(id),
    subtotal          DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    impuestos         DECIMAL(12,2) NOT NULL CHECK (impuestos >= 0),
    total             DECIMAL(12,2) NOT NULL CHECK (total >= 0),
    metodo_pago       TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'BILLETERA', 'MIXTO')),
    monto_recibido    DECIMAL(12,2) NOT NULL CHECK (monto_recibido >= 0),
    cambio_entregado  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cambio_entregado >= 0),
    hash              TEXT,
    ticket_number     BIGINT,
    conflicto_stock   BOOLEAN NOT NULL DEFAULT false,
    fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, ticket_number)
);

CREATE TABLE venta_detalles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id                    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id                 UUID NOT NULL REFERENCES productos(id),
    cantidad_o_peso             DECIMAL(12,3) NOT NULL CHECK (cantidad_o_peso > 0),
    precio_unitario             DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal                    DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    tarifa_iva_aplicada         DECIMAL(5,3) NOT NULL,
    tarifa_impoconsumo_aplicada DECIMAL(5,3) NOT NULL DEFAULT 0,
    descuento                   DECIMAL(12,2) NOT NULL DEFAULT 0,
    costo_aplicado              DECIMAL(12,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cierres_caja (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id         UUID NOT NULL REFERENCES usuarios(id),
    apertura_caja_id  UUID REFERENCES aperturas_caja(id) ON DELETE SET NULL,
    fecha_apertura    TIMESTAMPTZ NOT NULL,
    fecha_cierre      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_sistema     DECIMAL(12,2) NOT NULL CHECK (total_sistema >= 0),
    total_fisico      DECIMAL(12,2) NOT NULL CHECK (total_fisico >= 0),
    diferencia        DECIMAL(12,2) NOT NULL,
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ventas_conflicto (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id        UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('stock_insuficiente', 'colision_concurrente')),
    producto_id     UUID NOT NULL REFERENCES productos(id),
    cantidad_solicitada DECIMAL(12,3) NOT NULL,
    stock_disponible    DECIMAL(12,3) NOT NULL,
    version_conflicto   INTEGER,
    detalle         TEXT,
    resuelto        BOOLEAN NOT NULL DEFAULT false,
    resuelto_por    UUID REFERENCES usuarios(id),
    resuelto_en     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE eventos_auditoria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    tipo            TEXT NOT NULL CHECK (tipo IN ('apertura_cajon','inicio_sesion','cierre_sesion','admin_override','reimpresion_ticket','cierre_z','conflicto_resuelto','ajuste_inventario','apertura_caja')),
    descripcion     TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE movimientos_inventario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('venta','ajuste','entrada_manual','salida_manual','devolucion','inventario_inicial')),
    cantidad        DECIMAL(12,3) NOT NULL,
    stock_resultante DECIMAL(12,3) NOT NULL,
    costo_unitario  DECIMAL(12,2),
    referencia_id   TEXT,
    referencia_tipo TEXT,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    observacion     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE configuracion_fiscal (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id         UUID UNIQUE NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    regimen_tributario  TEXT NOT NULL DEFAULT 'comun' CHECK (regimen_tributario IN ('comun', 'simplificado')),
    tarifa_iva_default  DECIMAL(5,3) NOT NULL DEFAULT 0.19,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_productos_sucursal ON productos(sucursal_id);
CREATE INDEX idx_productos_barras ON productos(sucursal_id, codigo_barras);
CREATE INDEX idx_inventario_sucursal ON inventario_sucursal(sucursal_id, producto_id);
CREATE INDEX idx_ventas_sucursal ON ventas(sucursal_id);
CREATE INDEX idx_ventas_fecha ON ventas(fecha_hora DESC);
CREATE INDEX idx_ventas_cajero ON ventas(cajero_id);
CREATE INDEX idx_ventas_hash ON ventas(hash);
CREATE INDEX idx_ventas_ticket_sucursal ON ventas(sucursal_id, ticket_number DESC);
CREATE INDEX idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX idx_cierres_sucursal ON cierres_caja(sucursal_id);
CREATE INDEX idx_conflictos_venta ON ventas_conflicto(venta_id);
CREATE INDEX idx_eventos_sucursal ON eventos_auditoria(sucursal_id, created_at DESC);
CREATE INDEX idx_eventos_tipo ON eventos_auditoria(tipo);
CREATE INDEX idx_categorias_sucursal ON categorias(sucursal_id);
CREATE INDEX idx_aperturas_caja_sucursal ON aperturas_caja(sucursal_id, fecha_apertura DESC);
CREATE INDEX idx_movimientos_inventario_lookup ON movimientos_inventario(sucursal_id, producto_id, created_at DESC);
CREATE INDEX idx_movimientos_inventario_tipo ON movimientos_inventario(sucursal_id, tipo, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_sucursales
    BEFORE UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_usuarios
    BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_productos
    BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_ventas
    BEFORE UPDATE ON ventas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_cierres
    BEFORE UPDATE ON cierres_caja FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_categorias
    BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_config_fiscal
    BEFORE UPDATE ON configuracion_fiscal FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_aperturas
    BEFORE UPDATE ON aperturas_caja FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Row Level Security
ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_conflicto ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE aperturas_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leer propia sucursal" ON sucursales FOR SELECT USING (id = get_user_sucursal());
CREATE POLICY "Admin lee todas las sucursales" ON sucursales FOR SELECT USING (is_admin());
CREATE POLICY "Leer usuarios de sucursal" ON usuarios FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona usuarios" ON usuarios FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer productos de sucursal" ON productos FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona productos" ON productos FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer inventario de sucursal" ON inventario_sucursal FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona inventario" ON inventario_sucursal FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer ventas de sucursal" ON ventas FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar ventas" ON ventas FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer detalles de venta" ON venta_detalles FOR SELECT USING (venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Insertar detalles" ON venta_detalles FOR INSERT WITH CHECK (venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Leer cierres de sucursal" ON cierres_caja FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar cierres" ON cierres_caja FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer conflictos de sucursal" ON ventas_conflicto FOR SELECT USING (venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Admin gestiona conflictos" ON ventas_conflicto FOR ALL USING (venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()) AND is_admin());
CREATE POLICY "Leer eventos de sucursal" ON eventos_auditoria FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar eventos" ON eventos_auditoria FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer categorias sucursal" ON categorias FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona categorias" ON categorias FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer movimientos sucursal" ON movimientos_inventario FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar movimientos" ON movimientos_inventario FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer aperturas sucursal" ON aperturas_caja FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar aperturas" ON aperturas_caja FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona aperturas" ON aperturas_caja FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer config fiscal" ON configuracion_fiscal FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona config fiscal" ON configuracion_fiscal FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());

-- RPC: decrementar_inventario
CREATE OR REPLACE FUNCTION decrementar_inventario(
    p_sucursal_id UUID,
    p_producto_id UUID,
    p_cantidad DECIMAL(12,3),
    p_venta_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
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

    INSERT INTO movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_producto_id, 'venta', -p_cantidad, v_current_stock - p_cantidad, p_venta_id, 'venta', '00000000-0000-0000-0000-000000000000', NOW());
END;
$$;
