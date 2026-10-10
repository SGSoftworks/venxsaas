# 04. Modelo Entidad-Relación — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta Centralizado para Pequeños Negocios de Retail en Colombia
**UNINPAHU — Ingeniería de Software — Bogotá D.C., 2026**

---

## 1. Introducción

El modelo de datos de VenxPOS reside en una única base de datos PostgreSQL (Supabase) con **29 tablas** en el esquema `public`. No existen tipos `ENUM`: todos los dominios se modelan como columnas de texto con restricciones `CHECK`.

El diagrama MER está disponible (formato Mermaid, editable) en:

- `diagramas/mer/MER_Central.mmd` — modelo relacional central (núcleo del sistema).

---

## 2. Inventario de tablas

El esquema `public` consta de **29 tablas**, agrupadas por dominio (SaaS y POS):

| # | Tabla | Dominio | Propósito |
|---|---|---|---|
| 1 | `tenants` | SaaS | Negocio / inquilino |
| 2 | `plans` | SaaS | Planes comerciales |
| 3 | `subscriptions` | SaaS | Suscripción por tenant |
| 4 | `subscription_events` | SaaS | Historial de eventos de suscripción |
| 5 | `subscription_requests` | SaaS | Solicitudes de renovación/cambio de plan |
| 6 | `payments` | SaaS | Pagos (manuales) |
| 7 | `payment_proofs` | SaaS | Comprobantes de pago |
| 8 | `facturas_saas` | SaaS | Facturas del servicio SaaS |
| 9 | `invoice_counter` | SaaS | Contador de número de factura |
| 10 | `client_counter` | SaaS | Contador de `client_id` |
| 11 | `superadmins` | SaaS | Superadministradores |
| 12 | `empresas` | SaaS | Entidad heredada (1:1 con tenant) |
| 13 | `branch_accounts` | SaaS/POS | Cuentas de acceso por sucursal |
| 14 | `pending_signups` | SaaS | Registros pendientes de aprobación |
| 15 | `audit_logs` | SaaS | Auditoría administrativa |
| 16 | `sucursales` | POS | Sucursales |
| 17 | `usuarios` | POS | Usuarios del POS |
| 18 | `categorias` | POS | Categorías (jerárquicas) |
| 19 | `productos` | POS | Productos por sucursal |
| 20 | `inventario_sucursal` | POS | Stock por sucursal (versionado) |
| 21 | `movimientos_inventario` | POS | Kardex de inventario |
| 22 | `ventas` | POS | Cabecera de venta |
| 23 | `venta_detalles` | POS | Detalle de venta |
| 24 | `devoluciones` | POS | Cabecera de devolución |
| 25 | `devolucion_detalles` | POS | Detalle de devolución |
| 26 | `aperturas_caja` | POS | Apertura de turno |
| 27 | `cierres_caja` | POS | Cierre de caja |
| 28 | `ventas_conflicto` | POS | Conflictos de stock |
| 29 | `eventos_auditoria` | POS | Eventos de auditoría operativa |

> Total del esquema `public`: **29 tablas** (verificado con la introspección en vivo).

---

## 3. Entidades principales y atributos clave

### 3.1 Núcleo SaaS

**tenants** — negocio.
`id (PK)`, `nombre_negocio`, `nit` (UNIQUE), `email_propietario`, `telefono`, `estado` (CHECK: `pending_payment | pending_approval | active | suspended | cancelled`), `plan_id` (FK→plans), `auth_user_id`, `client_id`, `temp_password`, `must_change_password`, timestamps.

### 3.2 Operación de tienda

- **sucursales**: `id`, `nombre`, `nit`, `direccion`, `telefono`, `empresa_id?`.
- `usuarios`: `id`, `user_id` (Auth), `nombre`, `pin_acceso`, `rol` (`cajero`/`admin`), `estado`, `sucursal_id`.
- `productos`: `codigo_barras`, `descripcion`, `costo`, `precio_venta`, `stock_minimo`, `categoria_id`, `sucursal_id`, `requiere_peso`, `activo`.
- `inventario_sucursal`: `producto_id`, `sucursal_id`, `stock_actual`, `version`.
- `movimientos_inventario`: `producto_id`, `tipo`, `cantidad`, `stock_resultante`, `referencia_id`, `referencia_tipo`.

### 3.3 Venta / devolución

- `ventas`: `sucursal_id`, `cajero_id`, `metodo_pago`, `subtotal`, `total`, `monto_recibido`, `cambio_entregado`, `ticket_number`, `hash`, `fecha_hora`.
- `venta_detalles`: `venta_id`, `producto_id`, `cantidad_o_peso`, `precio_unitario`, `descuento`, `subtotal`.
- `devoluciones` / `devolucion_detalles`: análogas, con importes negativos.

### 3.4 Caja

- `aperturas_caja`: `sucursal_id`, `usuario_id`, `fondo_inicial`, `estado`, `efectivo_esperado`, `fecha_apertura`, `fecha_cierre`.
- `cierres_caja`: `apertura_caja_id`, `total_sistema`, `total_fisico`, `diferencia`, `cajero_id`.

### 3.5 Suscripciones y facturación

- `plans`: `nombre`, `precio_inicial`, `precio_mensual`, `max_sucursales`, `max_administradores`, `features`, `activo`.
- `subscriptions`: `tenant_id`, `plan_id`, `estado`, `fecha_inicio`, `fecha_renovacion`, `proximo_cobro`.
- `payments`: `tenant_id`, `amount`, `status`, `tipo`, `payment_method_type`.
- `facturas_saas`: `tenant_id`, `payment_id`, `numero_factura`, `concepto`, `subtotal`, `total`, `estado`, `pdf_url`.

---

## 4. Relaciones principales (claves foráneas verificadas)

- `tenants.plan_id → plans.id`
- `subscriptions.(tenant_id, plan_id) → tenants.id, plans.id`
- `subscription_events.(subscription_id, tenant_id) → subscriptions.id, tenants.id`
- `subscription_requests.(tenant_id, plan_actual_id, plan_nuevo_id, subscription_id) → tenants, plans, subscriptions`
- `payments.(tenant_id, subscription_id) → tenants.id, subscriptions.id`
- `payment_proofs.(tenant_id, plan_id) → tenants.id, plans.id`
- `facturas_saas.(tenant_id, payment_id) → tenants.id, payments.id`
- `sucursales.empresa_id → empresas.id`
- `usuarios.sucursal_id → sucursales.id`
- `categorias.(sucursal_id, parent_id) → sucursales.id, categorias.id` (jerárquica)
- `productos.(sucursal_id, categoria_id) → sucursales.id, categorias.id`
- `inventario_sucursal.(sucursal_id, producto_id) → sucursales.id, productos.id`
- `movimientos_inventario.(sucursal_id, producto_id, usuario_id) → sucursales, productos, usuarios`
- `ventas.(sucursal_id, cajero_id) → sucursales.id, usuarios.id`
- `venta_detalles.(venta_id, producto_id) → ventas.id, productos.id`
- `devoluciones.(sucursal_id, cajero_id, venta_original_id) → sucursales, usuarios, ventas`
- `devolucion_detalles.(devolucion_id, producto_id) → devoluciones, productos`
- `aperturas_caja.(sucursal_id, usuario_id) → sucursales, usuarios`
- `cierres_caja.(apertura_caja_id, cajero_id, sucursal_id) → aperturas_caja, usuarios, sucursales`
- `ventas_conflicto.(venta_id, producto_id, resuelto_por) → ventas, productos, usuarios`
- `branch_accounts.(tenant_id, sucursal_id) → tenants, sucursales`
- `eventos_auditoria.(sucursal_id, usuario_id) → sucursales, usuarios`
- `audit_logs.tenant_id → tenants.id`

---

## 5. Reglas de integridad (a nivel de base de datos)

- Unicidad: `tenants.nit`, `tenants.client_id`, `productos (sucursal_id, codigo_barras)`, `inventario_sucursal (sucursal_id, producto_id)`.
- `CHECK`:
  - `ventas.metodo_pago` / `devoluciones.metodo_pago` ∈ `('EFECTIVO','BILLETERA','QR','MIXTO')`.
  - `usuarios.rol` ∈ `('cajero','admin')`; `usuarios.estado` ∈ `('activo','inactivo','suspendido')`.
  - `branch_accounts.rol` ∈ `('admin_negocio','cajero')`.
  - `tenants.estado` ∈ `('pending_payment','pending_approval','active','suspended','cancelled')`.
  - `subscriptions.estado` ∈ `('pending','active','past_due','cancelled','expired')`.
  - `payments.status` ∈ `('pending','approved','declined','voided','error')`; `payments.tipo` ∈ `('initial','recurring','manual','retry','plan_change')`.
  - `facturas_saas.estado` ∈ `('emitida','pagada','anulada','reembolsada')`.
  - `movimientos_inventario.tipo` ∈ `('venta','ajuste','entrada','salida','devolucion','inicial')` (según migración `init_schema`).
- Concurrencia: `inventario_sucursal.version` se incrementa en cada actualización de stock.

---

## 6. Trazabilidad MER ↔ RPC

| Operación de negocio | Tablas afectadas | RPC/Edge Function |
|---|---|---|
| Registrar venta | `ventas`, `venta_detalles`, `inventario_sucursal`, `movimientos_inventario` | `decrementar_inventario` (POS hace inserts directos) / `finalizar_venta` (disponible) |
| Devolución | `devoluciones`, `devolucion_detalles`, `inventario_sucursal`, `movimientos_inventario` | `incrementar_inventario` |
| Apertura/cierre caja | `aperturas_caja`, `cierres_caja`, `eventos_auditoria` | inserts directos |
| Activar tenant | `tenants`, `subscriptions`, `payments`, `subscription_events` | `activate_tenant`, `approve_tenant` |
| Renovar | `subscriptions`, `payments`, `subscription_events`, `facturas_saas` | `process_renewal`, `renew_subscription` |
| Facturar | `facturas_saas`, `invoice_counter` | `generar_factura_desde_pago`, `generar_numero_factura` |
| Ajustar stock | `inventario_sucursal`, `movimientos_inventario` | `adjust_tenant_product_stock` |

---

*Elaborado a partir de la introspección en vivo del esquema (`supabase gen types typescript --linked`) y del análisis de las 74 migraciones.*
