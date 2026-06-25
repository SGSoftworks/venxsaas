-- Remove duplicate plans keeping one row per nombre
DELETE FROM public.plans a
USING public.plans b
WHERE a.nombre = b.nombre AND a.created_at > b.created_at;

-- Ensure exactly 3 plans with correct data
INSERT INTO public.plans (id, nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES 
    (gen_random_uuid(), 'Basico', 2, 2, 150000, 80000, '["2 sucursales","2 administradores","Reportes","Inventario","Soporte basico"]', true, false),
    (gen_random_uuid(), 'Estandar', 5, 5, 250000, 150000, '["5 sucursales","5 administradores","Reportes avanzados","Inventario multi-sucursal","Soporte prioritario"]', true, true),
    (gen_random_uuid(), 'Pro', 10, 10, 400000, 250000, '["10 sucursales","10 administradores","Sin limite de productos","Reportes personalizados","API de acceso","Soporte 24/7"]', true, false)
ON CONFLICT (nombre) DO UPDATE SET 
    activo = true,
    destacado = EXCLUDED.destacado,
    max_sucursales = EXCLUDED.max_sucursales,
    max_administradores = EXCLUDED.max_administradores,
    precio_inicial = EXCLUDED.precio_inicial,
    precio_mensual = EXCLUDED.precio_mensual,
    features = EXCLUDED.features;
