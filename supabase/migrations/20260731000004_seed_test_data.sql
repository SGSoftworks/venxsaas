-- ============================================================
-- Fase 11: Seed data de prueba para desarrollo local
-- Solo ejecuta si las tablas estan vacias
-- ============================================================

-- Planes por defecto
INSERT INTO public.plans (id, nombre, descripcion, precio_inicial, precio_mensual, caracteristicas, activo, created_at)
SELECT * FROM (VALUES
    ('plan_basico'::UUID, 'Basico', 'Para negocios pequenos', 0, 49000, '{"productos": 100, "sucursales": 1, "usuarios": 2}'::jsonb, true, NOW()),
    ('plan_pro'::UUID, 'Profesional', 'Para negocios en crecimiento', 0, 99000, '{"productos": 1000, "sucursales": 3, "usuarios": 10}'::jsonb, true, NOW()),
    ('plan_empresarial'::UUID, 'Empresarial', 'Para grandes operaciones', 0, 199000, '{"productos": 99999, "sucursales": 99, "usuarios": 99}'::jsonb, true, NOW())
) AS v(id, nombre, descripcion, precio_inicial, precio_mensual, caracteristicas, activo, created_at)
WHERE NOT EXISTS (SELECT 1 FROM public.plans LIMIT 1);

-- Superadmin por defecto (solo referencia, usuario auth debe crearse manualmente)
INSERT INTO public.superadmins (id, user_id, nombre, created_at)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Admin VenxPOS', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.superadmins LIMIT 1);
