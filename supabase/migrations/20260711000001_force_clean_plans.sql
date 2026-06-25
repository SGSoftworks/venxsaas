-- Force exactly 3 plans: delete ALL, then insert clean ones
DELETE FROM public.plans;

INSERT INTO public.plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES 
    ('Basico', 2, 2, 150000, 80000, '["2 sucursales","2 administradores","Reportes","Inventario","Soporte basico"]', true, false),
    ('Estandar', 5, 5, 250000, 150000, '["5 sucursales","5 administradores","Reportes avanzados","Inventario multi-sucursal","Soporte prioritario"]', true, true),
    ('Pro', 10, 10, 400000, 250000, '["10 sucursales","10 administradores","Sin limite de productos","Reportes personalizados","API de acceso","Soporte 24/7"]', true, false);
