-- ============================================================
-- Fase 11: Seed data de prueba para desarrollo local
-- Solo ejecuta si las tablas estan vacias
-- ============================================================

-- Planes por defecto (mismos precios que supabase/seed.sql)
INSERT INTO public.plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
SELECT v.nombre, v.max_sucursales, v.max_administradores, v.precio_inicial, v.precio_mensual, v.features, true, v.destacado
FROM (VALUES
    ('Basico'::TEXT, 1, 1, 1490000::DECIMAL(12,2), 110900::DECIMAL(12,2), '["1 sucursal", "1 administrador", "Hasta 1.000 productos", "Soporte email"]'::jsonb, false),
    ('Estandar'::TEXT, 4, 4, 1690000::DECIMAL(12,2), 229900::DECIMAL(12,2), '["4 sucursales", "4 administradores", "Hasta 5.000 productos", "Soporte preferente"]'::jsonb, true),
    ('Pro'::TEXT, 10, 10, 1990000::DECIMAL(12,2), 449900::DECIMAL(12,2), '["10 sucursales", "10 administradores", "Productos ilimitados", "Soporte VIP", "API dedicada"]'::jsonb, false)
) AS v(nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, destacado)
WHERE NOT EXISTS (SELECT 1 FROM public.plans LIMIT 1);

-- Superadmin por defecto (solo referencia, usuario auth debe crearse manualmente)
INSERT INTO public.superadmins (id, user_id, nombre, created_at)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Admin VenxPOS', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.superadmins LIMIT 1);
