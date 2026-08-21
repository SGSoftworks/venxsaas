# Manual de Gerente — VenxPOS SaaS

Panel administrativo general de la plataforma VenxPOS.

## Acceso

1. Ir a la URL del panel de administracion
2. Iniciar sesion con credenciales de superadmin
3. Solo usuarios registrados en `superadmins` tienen acceso

## Secciones

### Dashboard General
Resumen de metricas clave: tenants activos, ingresos del mes, solicitudes pendientes.

### Clientes
Gestion de todos los tenants registrados:
- Ver lista completa con busqueda y filtros
- Ver detalle de cada cliente (plan, sucursales, pagos, facturas)
- Editar informacion del tenant
- Registrar pagos manuales con factura automatica (activacion o renovacion; el monto se autocompleta segun el plan)

Nota: suspension/reactivacion manual y cambio de plan estan deshabilitados en el MVP (proximamente).

### Pagos
Registro manual de pagos:
- Crear pagos (metodo, referencia, monto, tenant)
- Ver historial completo de pagos
- Exportar a CSV

### Solicitudes
Aprobacion de nuevas cuentas:
- Ver solicitudes pendientes de activacion
- Aprobar o rechazar con un clic
- Registrar ID de transaccion de referencia
- Ver historial completo

Nota: renovaciones y cambios de plan via solicitudes estan deshabilitados en el MVP (proximamente).

### Facturacion
Gestion de facturas:
- Ver todas las facturas emitidas
- Regenerar PDF si es necesario
- Filtrar por tenant, fecha, estado

### Analitica
Reportes graficos del negocio:
- Ingresos por mes
- Distribucion de planes
- Tenants nuevos vs renovaciones
- Tasa de conversion de solicitudes

## Gestion de Planes
Los planes se configuran directamente en la base de datos (tabla `plans`).
Contactar al equipo de desarrollo para crear/modificar planes.
