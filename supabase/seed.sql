-- =============================================
-- SEED: VenxPOS Demo Data
-- =============================================
-- Crea datos demo para la cuenta "VenxPOS Demo"
-- Preserva cuentas de gerencia y planes oficiales existentes
-- =============================================
-- INSTRUCCIONES PREVIAS (ejecutar UNA SOLA VEZ):
-- 1. Crear usuario auth:
--    supabase auth create-user --email demo@venxpos.com --password Demo2026!
--    O desde Supabase Dashboard > Authentication > Users > Invite user
-- 2. Anotar el UUID del usuario creado
-- 3. Reemplazar 'AUTH_USER_ID_AQUI' en este archivo con el UUID real
-- 4. Ejecutar este seed: supabase db reset
-- =============================================

-- =============================================
-- LIMPIEZA IDEMPOTENTE
-- =============================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_sucursal_id UUID;
  v_usuario_id UUID;
  v_plan_id UUID;
  v_auth_user_id UUID;
  v_producto RECORD;
  v_venta_id UUID;
  v_venta_date TIMESTAMPTZ;
  v_day_offset INT;
  v_sale_count INT;
  v_qty DECIMAL(12,3);
  v_subtotal DECIMAL(12,2);
  v_impuestos DECIMAL(12,2);
  v_total DECIMAL(12,2);
  v_metodo_pago TEXT;
  v_cajero_id UUID;
BEGIN

-- === 1. PLANES ===
SELECT id INTO v_plan_id FROM plans WHERE nombre = 'Basico' LIMIT 1;
IF v_plan_id IS NULL THEN
  RAISE WARNING '⚠ Plan Basico no encontrado. Creando planes basicos...';
  INSERT INTO plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado) VALUES
    ('Basico', 1, 1, 1490000, 110900, '["1 sucursal", "1 administrador", "Hasta 1.000 productos", "Soporte email"]'::jsonb, true, false),
    ('Estandar', 4, 4, 1690000, 229900, '["4 sucursales", "4 administradores", "Hasta 5.000 productos", "Soporte preferente"]'::jsonb, true, true),
    ('Pro', 10, 10, 1990000, 449900, '["10 sucursales", "10 administradores", "Productos ilimitados", "Soporte VIP", "API dedicada"]'::jsonb, true, false);
  SELECT id INTO v_plan_id FROM plans WHERE nombre = 'Basico' LIMIT 1;
END IF;

-- === 2. ELIMINAR DATOS DEMO PREVIOS ===
DELETE FROM subscription_requests WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM payment_proofs WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM audit_logs WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM facturas_saas WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM payments WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM subscription_events WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM subscriptions WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM branch_accounts WHERE nombre_sucursal = 'Principal' AND email = 'demo@venxpos.com';
DELETE FROM movimientos_inventario WHERE producto_id IN (SELECT pr.id FROM productos pr JOIN sucursales s ON s.id = pr.sucursal_id WHERE s.nombre = 'Principal' AND s.nit = '900123456-7');
DELETE FROM venta_detalles WHERE venta_id IN (SELECT v.id FROM ventas v JOIN sucursales s ON s.id = v.sucursal_id WHERE s.nombre = 'Principal' AND s.nit = '900123456-7');
DELETE FROM ventas WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM cierres_caja WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM aperturas_caja WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM eventos_auditoria WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM configuracion_fiscal WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM inventario_sucursal WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM productos WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM categorias WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM usuarios WHERE sucursal_id IN (SELECT id FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7');
DELETE FROM empresas WHERE tenant_id IN (SELECT id FROM tenants WHERE email_propietario = 'demo@venxpos.com');
DELETE FROM sucursales WHERE nombre = 'Principal' AND nit = '900123456-7';
DELETE FROM tenants WHERE email_propietario = 'demo@venxpos.com';

-- === 3. TENANT DEMO ===
INSERT INTO tenants (id, nombre_negocio, nit, email_propietario, telefono, estado, plan_id, created_at, updated_at)
VALUES (gen_random_uuid(), 'VenxPOS Demo', '900123456-7', 'demo@venxpos.com', '3001234567', 'active', v_plan_id, '2026-01-15 08:00:00-05', NOW())
RETURNING id INTO v_tenant_id;

-- === 4. AUTH USER ===
-- REEMPLAZA este UUID con el generado por: supabase auth create-user --email demo@venxpos.com --password Demo2026!
v_auth_user_id := '00000000-0000-0000-0000-000000000001'::UUID;
UPDATE tenants SET auth_user_id = v_auth_user_id WHERE id = v_tenant_id;

-- === 5. SUCURSAL ===
INSERT INTO sucursales (id, nombre, nit, direccion, telefono, created_at, updated_at)
VALUES (gen_random_uuid(), 'Principal', '900123456-7', 'Cra 15 # 88-26, Bogota', '3001234567', '2026-01-15 08:30:00-05', NOW())
RETURNING id INTO v_sucursal_id;

-- === 6. EMPRESA ===
INSERT INTO empresas (nombre, nit, email, telefono, plan, estado, tenant_id)
VALUES ('VenxPOS Demo', '900123456-7', 'demo@venxpos.com', '3001234567', 'basico', 'activo', v_tenant_id);

-- === 7. BRANCH ACCOUNT ===
INSERT INTO branch_accounts (tenant_id, sucursal_id, nombre_sucursal, email, activo)
VALUES (v_tenant_id, v_sucursal_id, 'Principal', 'demo@venxpos.com', true);

-- === 8. USUARIO POS ===
INSERT INTO usuarios (id, user_id, sucursal_id, rol, nombre, pin_acceso, estado)
VALUES (gen_random_uuid(), v_auth_user_id, v_sucursal_id, 'admin', 'Admin VenxPOS', '1234', 'activo')
RETURNING id INTO v_cajero_id;

-- === 9. SUSCRIPCION ===
INSERT INTO subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro)
VALUES (v_tenant_id, v_plan_id, 'active', '2026-01-15', '2027-01-15', '2026-06-27');

INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
SELECT s.id, s.tenant_id, 'activated', '{"seed": true, "plan": "Basico"}'
FROM subscriptions s WHERE s.tenant_id = v_tenant_id;

-- === 10. CONFIGURACION FISCAL ===
INSERT INTO configuracion_fiscal (sucursal_id, regimen_tributario, tarifa_iva_default)
VALUES (v_sucursal_id, 'comun', 0.19);

-- === 11. CATEGORIAS ===
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Lacteos', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Panaderia', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Bebidas', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Aseo', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Granos', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Enlatados', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Confiteria', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Carnicos', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Frutas y Verduras', true;
INSERT INTO categorias (id, sucursal_id, nombre, activo) SELECT gen_random_uuid(), v_sucursal_id, 'Congelados', true;

-- === 12. PRODUCTOS (50) ===
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702004100010', 'Leche Entera Alpina 1L', 4900, 3800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Lacteos'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702004100027', 'Leche Deslactosada Alpina 1L', 5200, 4100, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Lacteos'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702010200034', 'Yogurt Griego Fresa Alpina 150g', 3800, 2800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Lacteos'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702010200041', 'Queso Campesino Alpina 250g', 8900, 6500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Lacteos'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702010200058', 'Mantequilla Rama 250g', 6500, 4800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Lacteos'), 10;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7701001000015', 'Pan Bimbo Artesano 500g', 7500, 5200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Panaderia'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7701001000022', 'Pan Integral Bimbo 500g', 8200, 5800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Panaderia'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7701001000039', 'Ponque Ramo 200g', 3500, 2400, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Panaderia'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7701001000046', 'Galletas Festival 150g', 2800, 1900, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Panaderia'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7701001000053', 'Tostadas Saltin 200g', 4200, 3100, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Panaderia'), 12;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000012', 'Coca-Cola 1.5L', 5800, 4200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 30;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000029', 'Coca-Cola Zero 1.5L', 5800, 4200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000036', 'Agua Cristal 500ml', 1800, 900, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 40;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000043', 'Jugo Hit Mango 250ml', 2500, 1600, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 25;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000050', 'Gatorade Naranja 500ml', 4500, 3200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000067', 'Cerveza Club Colombia 330ml', 3800, 2500, 0.19, 0.08, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 40;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7702005000074', 'Malta Pilsen 355ml', 3200, 2100, 0.19, 0.08, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Bebidas'), 30;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7703001000018', 'Papel Higienico Familia x4', 8900, 6200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Aseo'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7703001000025', 'Detergente Ariel 1kg', 12500, 8500, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Aseo'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7703001000032', 'Jabon Rey Lavaloza 400g', 4200, 2900, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Aseo'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7703001000049', 'Desinfectante Pino 1L', 5800, 3800, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Aseo'), 12;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7703001000056', 'Clorox 1L', 3500, 2200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Aseo'), 15;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000013', 'Arroz Diana 1kg', 4500, 3600, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 30;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000020', 'Frijol Cargamanto 500g', 5500, 3800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000037', 'Lenteja 500g', 4200, 2900, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000044', 'Aceite Vegetal Premier 900ml', 8500, 6200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000051', 'Sal Refisal 1kg', 2000, 1200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 25;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7704001000068', 'Azucar Manuelita 1kg', 4200, 3200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Granos'), 20;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7705001000011', 'Atun VanCamp 160g Aceite', 5800, 4200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Enlatados'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7705001000028', 'Atun VanCamp 160g Agua', 5500, 3900, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Enlatados'), 15;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7705001000035', 'Sardinas King Pacifico 155g', 4200, 2900, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Enlatados'), 12;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7705001000042', 'Maiz Dulce Hermoza 200g', 3800, 2500, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Enlatados'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7705001000059', 'Pasta de Tomate Doria 250g', 3200, 2100, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Enlatados'), 15;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7706001000010', 'Chocolatina Jet 40g', 2500, 1500, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Confiteria'), 30;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7706001000027', 'Chocolatina Milky Way 50g', 2800, 1700, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Confiteria'), 25;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7706001000034', 'Bombones Ambrosita 100g', 3500, 2400, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Confiteria'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7706001000041', 'Chicle Trident Menta 25g', 1800, 1000, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Confiteria'), 40;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7706001000058', 'M&Ms Mani 100g', 4500, 3200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Confiteria'), 15;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7707001000019', 'Pechuga de Pollo Congelada 1kg', 18900, 14500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Carnicos'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7707001000026', 'Carne Molida de Res 500g', 15000, 11000, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Carnicos'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7707001000033', 'Salchichas PIA 300g', 8500, 6200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Carnicos'), 12;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7707001000040', 'Tocino Cincho 200g', 9800, 7200, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Carnicos'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7707001000057', 'Huevos Tipo A x30', 16500, 12500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Carnicos'), 10;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7708001000018', 'Banano x500g', 2500, 1500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Frutas y Verduras'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7708001000025', 'Papa Criolla x1kg', 3800, 2500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Frutas y Verduras'), 25;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7708001000032', 'Tomate Chonto x1kg', 4500, 3000, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Frutas y Verduras'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7708001000049', 'Cebolla Cabezona x1kg', 4200, 2800, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Frutas y Verduras'), 20;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7708001000056', 'Aguacate Hass 500g', 6500, 4500, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Frutas y Verduras'), 10;

INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7709001000015', 'Helado Crem Vainilla 2L', 15900, 11000, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Congelados'), 6;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7709001000022', 'Helado Crem Chicle 2L', 15900, 11000, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Congelados'), 6;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7709001000039', 'Vegetales Mixtos Congelados 500g', 6500, 4200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Congelados'), 10;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7709001000046', 'Papas Fritas Congeladas 1kg', 11800, 8200, 0, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Congelados'), 8;
INSERT INTO productos (id, sucursal_id, codigo_barras, descripcion, precio_venta, costo, tarifa_iva, tarifa_impoconsumo, categoria_id, stock_minimo)
SELECT gen_random_uuid(), v_sucursal_id, '7709001000053', 'Empanadas Congeladas x8', 12500, 8500, 0.19, 0, (SELECT id FROM categorias WHERE sucursal_id = v_sucursal_id AND nombre = 'Congelados'), 8;
-- Total: 50 productos

-- === 13. INVENTARIO INICIAL ===
INSERT INTO inventario_sucursal (sucursal_id, producto_id, stock_actual, version)
SELECT v_sucursal_id, p.id,
  CASE WHEN p.codigo_barras LIKE '7702%' THEN 30 + (random() * 40)::int
       ELSE 40 + (random() * 80)::int
  END,
  1
FROM productos p WHERE p.sucursal_id = v_sucursal_id;

-- === 14. MOVIMIENTO INICIAL ===
INSERT INTO movimientos_inventario (sucursal_id, producto_id, tipo, cantidad, stock_resultante, usuario_id, observacion, created_at)
SELECT v_sucursal_id, p.id, 'inventario_inicial', ins.stock_actual, ins.stock_actual, v_cajero_id, 'Inventario inicial', '2026-01-15 08:00:00-05'
FROM productos p
JOIN inventario_sucursal ins ON ins.producto_id = p.id AND ins.sucursal_id = v_sucursal_id
WHERE p.sucursal_id = v_sucursal_id;

-- === 15. VENTAS HISTORICAS (30 dias, ~5 ventas/dia) ===
FOR v_day_offset IN 0..29 LOOP
  v_sale_count := 3 + (random() * 5)::int;

  FOR i IN 1..v_sale_count LOOP
    v_venta_date := ('2026-01-15'::date + v_day_offset) + (8 + random() * 10) * interval '1 hour';
    v_metodo_pago := (ARRAY['EFECTIVO', 'TARJETA', 'BILLETERA'])[1 + (random() * 3)::int];

    INSERT INTO ventas (id, sucursal_id, cajero_id, subtotal, impuestos, total, metodo_pago, monto_recibido, cambio_entregado, fecha_hora)
    VALUES (gen_random_uuid(), v_sucursal_id, v_cajero_id, 0, 0, 0, v_metodo_pago, 0, 0, v_venta_date)
    RETURNING id INTO v_venta_id;

    v_subtotal := 0;
    v_impuestos := 0;

    FOR v_producto IN
      SELECT p.id, p.precio_venta, p.tarifa_iva, p.costo
      FROM productos p
      WHERE p.sucursal_id = v_sucursal_id
      ORDER BY random()
      LIMIT 1 + (random() * 4)::int
    LOOP
      v_qty := 1 + (random() * 5)::int;

      INSERT INTO venta_detalles (venta_id, producto_id, cantidad_o_peso, precio_unitario, subtotal, tarifa_iva_aplicada, tarifa_impoconsumo_aplicada, costo_aplicado)
      VALUES (v_venta_id, v_producto.id, v_qty, v_producto.precio_venta, v_producto.precio_venta * v_qty, v_producto.tarifa_iva, 0, v_producto.costo * v_qty);

      v_subtotal := v_subtotal + v_producto.precio_venta * v_qty;
      v_impuestos := v_impuestos + (v_producto.precio_venta * v_qty * v_producto.tarifa_iva);
    END LOOP;

    v_total := v_subtotal + v_impuestos;

    UPDATE ventas SET
      subtotal = v_subtotal,
      impuestos = v_impuestos,
      total = v_total,
      monto_recibido = CASE WHEN v_metodo_pago = 'EFECTIVO' THEN v_total + ceil(random() * 10000 / 100) * 100 ELSE v_total END,
      cambio_entregado = CASE WHEN v_metodo_pago = 'EFECTIVO' THEN (v_total + ceil(random() * 10000 / 100) * 100) - v_total ELSE 0 END,
      ticket_number = (SELECT COALESCE(MAX(ticket_number), 0) + 1 FROM ventas WHERE sucursal_id = v_sucursal_id)
    WHERE id = v_venta_id;

    -- Decrementar inventario
    UPDATE inventario_sucursal ins
    SET stock_actual = GREATEST(0, ins.stock_actual - vd.cantidad_o_peso), version = ins.version + 1
    FROM venta_detalles vd
    WHERE vd.venta_id = v_venta_id AND vd.producto_id = ins.producto_id AND ins.sucursal_id = v_sucursal_id;

    -- Movimiento de inventario
    INSERT INTO movimientos_inventario (sucursal_id, producto_id, tipo, cantidad, stock_resultante, usuario_id, referencia_id, referencia_tipo, created_at)
    SELECT v_sucursal_id, vd.producto_id, 'venta', -vd.cantidad_o_peso, ins.stock_actual, v_cajero_id, v_venta_id::text, 'venta', v_venta_date
    FROM venta_detalles vd
    JOIN inventario_sucursal ins ON ins.producto_id = vd.producto_id AND ins.sucursal_id = v_sucursal_id
    WHERE vd.venta_id = v_venta_id;
  END LOOP;
END LOOP;

-- === 16. APERTURAS Y CIERRES DIARIOS ===
FOR v_day_offset IN 0..29 LOOP
  PERFORM FROM ventas WHERE sucursal_id = v_sucursal_id AND fecha_hora::date = ('2026-01-15'::date + v_day_offset) LIMIT 1;
  IF FOUND THEN
    INSERT INTO aperturas_caja (sucursal_id, usuario_id, fondo_inicial, fecha_apertura, estado)
    VALUES (v_sucursal_id, v_cajero_id, 200000, ('2026-01-15'::date + v_day_offset) + '08:00:00'::interval, 'cerrada');

    INSERT INTO cierres_caja (sucursal_id, cajero_id, fecha_apertura, fecha_cierre, total_sistema, total_fisico, diferencia, observaciones)
    SELECT v_sucursal_id, v_cajero_id, ('2026-01-15'::date + v_day_offset) + '08:00:00'::interval, ('2026-01-15'::date + v_day_offset) + '20:00:00'::interval,
      COALESCE(SUM(total), 0), COALESCE(SUM(total), 0) + (random() * 10000 - 5000)::int, 0, 'Cierre automatico seed'
    FROM ventas
    WHERE sucursal_id = v_sucursal_id AND fecha_hora::date = ('2026-01-15'::date + v_day_offset);
  END IF;
END LOOP;

-- === 17. EVENTOS DE AUDITORIA ===
INSERT INTO eventos_auditoria (sucursal_id, usuario_id, tipo, descripcion, created_at)
SELECT DISTINCT ON (v.fecha_hora::date) v_sucursal_id, v_cajero_id, 'inicio_sesion', 'Inicio de sesion', v.fecha_hora
FROM ventas v
WHERE v.sucursal_id = v_sucursal_id;

INSERT INTO eventos_auditoria (sucursal_id, usuario_id, tipo, descripcion, created_at)
SELECT DISTINCT ON (v.fecha_hora::date) v_sucursal_id, v_cajero_id, 'cierre_sesion', 'Cierre de sesion', v.fecha_hora + interval '10 hours'
FROM ventas v
WHERE v.sucursal_id = v_sucursal_id;

-- === 18. FACTURAS SAAS ===
INSERT INTO facturas_saas (tenant_id, numero_factura, concepto, subtotal, iva, total, estado, created_at)
SELECT v_tenant_id, 'FAC-DEMO-001', 'Membresia Basico - Enero 2026', 97990, 12910, 110900, 'pagada', '2026-01-15 09:00:00-05'
WHERE NOT EXISTS (SELECT 1 FROM facturas_saas WHERE tenant_id = v_tenant_id AND numero_factura = 'FAC-DEMO-001');

INSERT INTO facturas_saas (tenant_id, numero_factura, concepto, subtotal, iva, total, estado, created_at)
SELECT v_tenant_id, 'FAC-DEMO-002', 'Membresia Basico - Febrero 2026', 97990, 12910, 110900, 'pagada', '2026-02-15 09:00:00-05'
WHERE NOT EXISTS (SELECT 1 FROM facturas_saas WHERE tenant_id = v_tenant_id AND numero_factura = 'FAC-DEMO-002');

INSERT INTO facturas_saas (tenant_id, numero_factura, concepto, subtotal, iva, total, estado, created_at)
SELECT v_tenant_id, 'FAC-DEMO-003', 'Membresia Basico - Marzo 2026', 97990, 12910, 110900, 'pagada', '2026-03-15 09:00:00-05'
WHERE NOT EXISTS (SELECT 1 FROM facturas_saas WHERE tenant_id = v_tenant_id AND numero_factura = 'FAC-DEMO-003');

INSERT INTO facturas_saas (tenant_id, numero_factura, concepto, subtotal, iva, total, estado, created_at)
SELECT v_tenant_id, 'FAC-DEMO-004', 'Membresia Basico - Abril 2026', 97990, 12910, 110900, 'pagada', '2026-04-15 09:00:00-05'
WHERE NOT EXISTS (SELECT 1 FROM facturas_saas WHERE tenant_id = v_tenant_id AND numero_factura = 'FAC-DEMO-004');

INSERT INTO facturas_saas (tenant_id, numero_factura, concepto, subtotal, iva, total, estado, created_at)
SELECT v_tenant_id, 'FAC-DEMO-005', 'Membresia Basico - Mayo 2026', 97990, 12910, 110900, 'emitida', '2026-05-15 09:00:00-05'
WHERE NOT EXISTS (SELECT 1 FROM facturas_saas WHERE tenant_id = v_tenant_id AND numero_factura = 'FAC-DEMO-005');

-- === 19. PAGOS SAAS ===
INSERT INTO payments (tenant_id, amount, currency, status, tipo, created_at)
SELECT v_tenant_id, 110900, 'COP', 'approved', 'initial', '2026-01-15 09:05:00-05'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE tenant_id = v_tenant_id AND tipo = 'initial');

INSERT INTO payments (tenant_id, amount, currency, status, tipo, created_at)
SELECT v_tenant_id, 110900, 'COP', 'approved', 'recurring', '2026-02-15 09:05:00-05'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE tenant_id = v_tenant_id AND tipo = 'recurring' AND created_at::date = '2026-02-15');

INSERT INTO payments (tenant_id, amount, currency, status, tipo, created_at)
SELECT v_tenant_id, 110900, 'COP', 'approved', 'recurring', '2026-03-15 09:05:00-05'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE tenant_id = v_tenant_id AND tipo = 'recurring' AND created_at::date = '2026-03-15');

INSERT INTO payments (tenant_id, amount, currency, status, tipo, created_at)
SELECT v_tenant_id, 110900, 'COP', 'approved', 'recurring', '2026-04-15 09:05:00-05'
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE tenant_id = v_tenant_id AND tipo = 'recurring' AND created_at::date = '2026-04-15');

-- === 20. AUDIT LOGS ===
INSERT INTO audit_logs (tenant_id, accion, entidad, metadata, created_at)
VALUES
(v_tenant_id, 'tenant_created', 'tenants', '{"seed": true, "negocio": "VenxPOS Demo"}', '2026-01-15 08:00:00-05'),
(v_tenant_id, 'payment_approved', 'payments', '{"amount": 110900, "tipo": "initial"}', '2026-01-15 09:05:00-05'),
(v_tenant_id, 'subscription_activated', 'subscriptions', '{"plan": "Basico"}', '2026-01-15 09:10:00-05'),
(v_tenant_id, 'payment_approved', 'payments', '{"amount": 110900, "tipo": "recurring"}', '2026-02-15 09:05:00-05'),
(v_tenant_id, 'payment_approved', 'payments', '{"amount": 110900, "tipo": "recurring"}', '2026-03-15 09:05:00-05'),
(v_tenant_id, 'payment_approved', 'payments', '{"amount": 110900, "tipo": "recurring"}', '2026-04-15 09:05:00-05');

RAISE NOTICE '==================================================';
RAISE NOTICE 'Datos demo creados exitosamente!';
RAISE NOTICE 'Usuario: demo@venxpos.com / Demo2026!';
RAISE NOTICE 'Reemplaza el UUID en el seed con el del auth user creado';
RAISE NOTICE '==================================================';

END $$;
