-- Remove duplicate plans keeping one row per nombre
DELETE FROM public.plans a
USING public.plans b
WHERE a.nombre = b.nombre AND a.created_at > b.created_at;

-- Ensure exactly 3 plans with correct data
INSERT INTO public.plans (id, nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES 
    (gen_random_uuid(), 'Basico', 1, 1, 1490000, 110900, '["1 sucursal con administracion","Hasta 1.000 productos","Reportes generales","Inventario integrado","Soporte presencial segun disponibilidad","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false),
    (gen_random_uuid(), 'Estandar', 4, 4, 1590000, 229900, '["4 sucursales con administracion","Hasta 5.000 productos","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, true),
    (gen_random_uuid(), 'Pro', 10, 10, 1680000, 449900, '["10 sucursales","Productos ilimitados","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false)
ON CONFLICT (nombre) DO UPDATE SET 
    activo = true,
    destacado = EXCLUDED.destacado,
    max_sucursales = EXCLUDED.max_sucursales,
    max_administradores = EXCLUDED.max_administradores,
    precio_inicial = EXCLUDED.precio_inicial,
    precio_mensual = EXCLUDED.precio_mensual,
    features = EXCLUDED.features;
