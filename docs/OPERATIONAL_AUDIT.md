# Auditoria Operacional — VenxPOS Ecosystem

**Fecha:** Julio 2026
**Alcance:** POS + SaaS Cliente + SaaS SuperAdmin — sincronizacion de datos, analiticas, facturacion y estado de produccion

---

## 1. Estado Actual

### Modulos Conectados (datos reales de DB)

| Modulo | Origen de datos | Estado |
|--------|----------------|--------|
| Ventas del dia/mes/año (DashboardHome) | `ventas` via `branch_accounts` | Conectado |
| Ventas del dia/mes/año (AnalyticsPage) | `ventas` via `branch_accounts` | Conectado |
| Ticket promedio | `ventas.total / ventas.count` | Conectado |
| Productos mas vendidos | `venta_detalles + productos` | Conectado |
| Stock bajo | RPC `get_low_stock_products` | Conectado |
| Metodos de pago (DashboardHome) | `ventas.metodo_pago` | Conectado |
| Metodos de pago (AnalyticsPage) | `ventas.metodo_pago` | Corregido |
| Ganancia/profit (DashboardHome) | `venta_detalles.costo_aplicado` | Corregido |
| Ganancia/profit (AnalyticsPage) | `venta_detalles.costo_aplicado` | Corregido |
| IVA recaudado | `venta_detalles.tarifa_iva_aplicada` | Corregido |
| Suscripcion activa | `subscriptions + plans` | Conectado |
| Historial de pagos | `payments` | Conectado |
| Facturas SaaS | `facturas_saas` | Conectado |
| MRR/Ingresos recurrentes | `get_mrr()` RPC | Conectado |
| Facturacion mensual/anual | `get_facturacion_*` RPCs | Conectado |
| Clientes activos/suspendidos | `tenants` | Conectado |
| Proximos a vencer | `subscriptions.proximo_cobro` | Agregado |
| Renovaciones del mes | `payments tipo=recurring` | Agregado |
| Facturas totales (AdminDashboard) | `facturas_saas` count | Corregido |

### Modulos No Conectados (datos invisibles en SaaS)

| Tabla POS | Datos disponibles | Razon |
|-----------|-------------------|-------|
| `aperturas_caja` | Turnos abiertos/cerrados, fondo inicial | No consultado por SaaS |
| `cierres_caja` | Arqueos, diferencias, descuadres | No consultado por SaaS |
| `devoluciones` | Notas credito, motivos | No consultado por SaaS |
| `eventos_auditoria` | Logs de operaciones POS | SaaS tiene su propio `audit_logs` |
| `movimientos_inventario` | Historial de stock | No consultado por SaaS |
| `ventas_conflicto` | Colisiones de stock | No consultado por SaaS |
| `configuracion_fiscal` | Regimen tributario por sucursal | IVA hardcodeado 19% |
| `categorias` | Jerarquia de productos | Top productos sin agrupacion |
| `usuarios` | Roles y estados POS | SaaS usa `branch_accounts` |

---

## 2. Bugs Corregidos (esta sesion)

| # | Bug | Archivo | Severidad |
|---|-----|---------|-----------|
| 1 | `ganancia` siempre $0 en AnalyticsPage y DashboardHome | `AnalyticsPage.tsx`, `DashboardHome.tsx` | Alta |
| 2 | `paymentMethods` siempre vacio en AnalyticsPage | `AnalyticsPage.tsx` | Alta |
| 3 | `totalInvoices` siempre 0 en AdminDashboard | `AdminDashboard.tsx` | Alta |
| 4 | IVA usa columna inexistente `venta_detalles.impuestos` | `AnalyticsPage.tsx` | Alta |
| 5 | Facturas duplicadas en pagos recurring via webhook | `wompi-webhook/index.ts` | Alta |
| 6 | Facturas faltantes en plan_change via check-payment | `check-payment/index.ts` | Alta |
| 7 | Sin columna `estado` en `facturas_saas` | DB migration | Media |
| 8 | Sin UNIQUE constraint en `payment_id` de facturas | DB migration | Media |
| 9 | InvoicesPage hardcodeaba "Pagada" | `InvoicesPage.tsx` | Baja |

### Mejoras Agregadas

| # | Mejora | Archivo |
|---|--------|---------|
| 1 | Filtro de sucursal + rango de fechas | `DashboardHome.tsx` |
| 2 | Filtro de periodo (30d/90d/12m/año) | `AdminAnalyticsPage.tsx` |
| 3 | KPI: Clientes suspendidos | `AdminDashboard.tsx` |
| 4 | KPI: Proximos a vencer (7 dias) | `AdminDashboard.tsx` |
| 5 | KPI: Renovaciones del mes | `AdminDashboard.tsx` |
| 6 | Estados de factura (emitida/pagada/anulada/reembolsada) | `InvoicesPage.tsx` |
| 7 | `estado` column en `facturas_saas` | DB migration |
| 8 | UNIQUE `payment_id` en `facturas_saas` | DB migration |

---

## 3. Nivel de Madurez del Sistema

### Funcionalidades listas para produccion

- Registro de tenant con validacion de plan
- Pago inicial via Wompi Payment Link
- Polling de verificacion de pago (check-payment)
- Webhook Wompi para aprobacion automatica
- Reconciliacion batch cada 5 minutos (reconcile-payments)
- Activacion automatica de tenant + sucursales
- Cambio de plan con pago prorrateado
- Renovacion manual y automatica (cron)
- Cancelacion de suscripcion
- Dashboard cliente con ventas, stock, productos, metodos de pago
- Dashboard superadmin con KPIs, clientes, pagos, facturacion
- Analiticas con filtros de sucursal y fecha
- Facturacion electronica con PDF corporativo
- Exportacion CSV de facturas y pagos
- Modales con Portal, scroll lock, Escape, focus trap
- Breadcrumbs, error pages (404/403/500), empty states
- Paginas legales adaptadas a Colombia

### Funcionalidades incompletas

- Sin integracion de cierres de caja POS en SaaS
- Sin descuento de devoluciones en totales SaaS
- Sin agrupacion por categoria de productos
- Sin dashboard de turnos/caja para tenant
- Sin notificaciones push/email de eventos operativos
- Sin WebSocket para actualizacion en tiempo real
- Sin dark mode

---

## 4. Riesgos Detectados

| Riesgo | Impacto | Probabilidad | Mitigacion |
|--------|---------|-------------|------------|
| Deno.land caido impide deploy | Alto | Baja | Reintentar; persistir codigo en git |
| `empresas` table no creada por migraciones | Alto | Baja (ya existe en DB) | Crear migration de creacion si se recrea DB |
| Polling puede fallar si Wompi no responde | Medio | Media | Webhook como fuente primaria; reconcile como fallback |
| Sin rate limiting en register-tenant | Medio | Baja | Agregar en futura iteracion |
| Facturas pueden no tener PDF si generate-pdf falla | Bajo | Baja | Agregar cola de reintentos |

---

## 5. Calificacion Final

| Dimension | Puntuacion | Notas |
|-----------|------------|-------|
| **Operativa** | 8/10 | POS→DB→SaaS fluye. 9 tablas POS sin exponer, ganancia e IVA corregidos |
| **Comercial** | 8/10 | Pagos, suscripciones, facturas funcionales. Sin facturas duplicadas |
| **Tecnica** | 8/10 | DB schema solido, RPCs funcionales, Edge Functions corregidas |
| **UX/UI** | 8/10 | Layouts fluidos, filtros de fecha/sucursal, error pages, breadcrumbs |
| **Escalabilidad** | 7/10 | Multi-tenant via branch_accounts. Sin caching. Polling en vez de WebSocket |

**Calificacion global: 7.8/10 — Listo para produccion con monitoreo.**

---

## 6. Recomendaciones

1. Configurar `WOMPI_EVENTS_SECRET` y verificar webhook funcional
2. Configurar `INTERNAL_API_KEY` en todas las Edge Functions
3. Monitorear `reconcile-payments` via cron cada 5 minutos
4. Agregar dashboard de cierres de caja POS en SaaS
5. Migrar de polling a WebSocket para actualizaciones en tiempo real
6. Agregar rate limiting a `register-tenant`
7. Implementar dark mode
8. Agregar tests end-to-end del flujo de pago
