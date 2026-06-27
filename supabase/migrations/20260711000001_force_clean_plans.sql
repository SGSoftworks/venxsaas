-- Force exactly 3 plans: delete ALL, then insert clean ones
DELETE FROM public.plans;

INSERT INTO public.plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES 
    ('Basico', 1, 1, 1490000, 110900, '["1 sucursal con administracion","Hasta 1.000 productos","Reportes generales","Inventario integrado","Soporte presencial segun disponibilidad","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false),
    ('Estandar', 4, 4, 1590000, 229900, '["4 sucursales con administracion","Hasta 5.000 productos","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, true),
    ('Pro', 10, 10, 1680000, 449900, '["10 sucursales","Productos ilimitados","Reportes generales","Inventario integrado","Soporte presencial","Soporte WhatsApp","Horario L-V 7AM a 7PM"]', true, false);
