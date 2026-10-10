# 03. Arquitectura del Sistema — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta Centralizado para Pequeños Negocios de Retail en Colombia
**UNINPAHU — Ingeniería de Software — Bogotá D.C., 2026**

> Documento técnico. El formato APA se reserva para `documentacion_metodologica.txt`.

---

## 1. Estilo y patrón arquitectónico

VenxPOS es un sistema **cliente-servidor por capas** construido sobre un **Backend como Servicio (BaaS)**. No es MVC clásico ni microservicios; es un **monolito de base de datos compartida** (*shared-database monolith*): una única base de datos PostgreSQL sirve a dos frontends independientes.

- **Capa de presentación (Vista):** dos aplicaciones React (`venxpos-saas` y `venxpos`).
- **Capa de lógica de negocio (Controlador):** funciones RPC de PostgreSQL + Edge Functions de Deno.
- **Capa de datos (Modelo):** PostgreSQL (29 tablas) con RLS, RPCs y triggers.

Mapeo didáctico del patrón por capas:

| Capa | Implementación real |
|---|---|
| Vista | Componentes React (`.tsx`) |
| Controlador | RPCs de PostgreSQL, Edge Functions, stores Zustand (orquestación en cliente) |
| Modelo | Tablas PostgreSQL + políticas RLS + constraints |
| Seguridad | Supabase Auth (JWT) + RLS por tenant/sucursal |
| Integración | PostgREST (API REST autogenerada), Storage, Resend |

---

## 2. Componentes de alto nivel

| Componente | Responsabilidad | Tecnología |
|---|---|---|
| **VenxPOS SaaS** | Gestión multi-inquilino: tenants, planes, suscripciones, pagos manuales, sucursales, inventario consolidado, facturación, analítica | React SPA (Vercel) |
| **VenxPOS POS** | Operación de caja: carrito, ventas, inventario por sucursal, apertura/cierre, devoluciones | React SPA (Netlify) |
| **Supabase Auth** | Autenticación y sesión | Supabase |
| **PostgREST / API** | Acceso a datos con RLS | Supabase |
| **PostgreSQL** | Almacenamiento, reglas, RPCs | Supabase |
| **Edge Functions** | Operaciones privilegiadas | Deno |
| **Storage** | PDFs de facturas | Supabase Storage |
| **Resend** | Correo saliente | API externa |
| **Vercel / Netlify** | Hosting de los frontends | CDN |

---

## 3. Vista de capas detallada

### 3.1 Capa de presentación
- **SaaS**: enrutamiento con `react-router-dom` v7; tres zonas: pública (`/`, `/legal/*`, `/login`), dashboard de negocio (`/dashboard/*`, guard `AuthGuard`+`AdminNegocioGuard`) y administración (`/admin/*`, guard `GerenteGuard`).
- **POS**: SPA de pantalla única controlada por `App.tsx` → `Login` → `ConnectionGuard` → `POSLayout` (+ `Receipt` para impresión).

### 3.2 Capa de lógica
- **RPCs** (ejemplos): `finalizar_venta`, `decrementar_inventario`, `incrementar_inventario`, `get_subscription_info`, `activate_tenant`, `approve_tenant`, `generar_factura_desde_pago`, `renew_subscription`, `process_expired_subscriptions`.
- **Edge Functions**: creación de usuarios, facturación PDF, correo, auditoría.
- **Stores Zustand**: estado de sesión, carrito y UI (orquestan llamadas al backend).

### 3.3 Capa de datos
- 29 tablas, RLS, triggers `set_updated_at`, contadores (`invoice_counter`, `client_counter`).

---

## 4. Multi-tenancy y aislamiento

- **Aislamiento por tenant:** la función `get_tenant_id()` resuelve el tenant del usuario (vía `tenants.auth_user_id` o `branch_accounts.user_id`). Las políticas RLS restringen `tenants`, `subscriptions`, `payments`, `facturas_saas`, etc. a `tenant_id = get_tenant_id()` o superadmin.
- **Aislamiento por sucursal (POS):** `get_user_sucursal()` mapea el usuario a su `sucursal_id`; las políticas de POS filtran por `sucursal_id`.
- **Dueños de negocio vs. cajeros:** los dueños no están en `usuarios`, por lo que se añadieron políticas específicas para que accedan a ventas/inventario de sus sucursales (`20260801000000_fix_rls_tenant_access.sql`).
- **Superadmin:** identificado en `superadmins`; `is_superadmin()` habilita acceso global.

---

## 5. Flujos clave (secuencias)

Los diagramas de secuencia completos están en `diagramas/secuencias/`:

1. `seq_venta_pos.mmd` — Registro de una venta en el POS (validación de stock, inserción de venta/detalle, descuento de inventario, ticket).
2. `seq_login_suscripcion.mmd` — Login y verificación de suscripción (bloqueo si no está activa).
3. `seq_devolucion.mmd` — Búsqueda de venta y devolución con restauración de stock.
4. `seq_aprobacion_tenant.mmd` — Registro público → aprobación por superadmin → pago manual → factura.

---

## 6. Despliegue

```
Vercel (venxsaas)            Netlify (venxpos-pos)
      │                             │
      └───────── HTTPS ─────────────┘
                    │
                    ▼
        Supabase (beacnoxukkoellhecofm.supabase.co)
        ├── Auth
        ├── REST (PostgREST) ── PostgreSQL (RLS)
        ├── Storage (invoices)
        └── Edge Functions ── Resend
```

Diagrama en `diagramas/arquitectura/despliegue.mmd`.

---

## 7. Atributos de calidad (arquitectura)

| Atributo | Decisión arquitectónica |
|---|---|
| **Seguridad** | RLS multi-inquilino, `service_role` solo en Edge Functions, CSP/cabeceras, CORS whitelist |
| **Escalabilidad** | BaaS administrado; frontends estáticos en CDN; lógica cerca de los datos (RPC) |
| **Mantenibilidad** | Dos frontends desacoplados sobre un mismo contrato (esquema + RPCs) |
| **Consistencia** | Concurrencia optimista en inventario (`version`), transacciones en RPC |
| **Disponibilidad** | Aplicación en línea sobre BaaS administrado; alta disponibilidad del backend y frontends estáticos en CDN |
| **Auditabilidad** | Tablas `audit_logs` y `eventos_auditoria` |

---

## 8. Limitaciones arquitectónicas declaradas

1. **Lógica de venta en el cliente**: el POS registra la venta con *inserts* directos + RPC de inventario por ítem (`PaymentModal.tsx`) en lugar de la RPC `finalizar_venta`, que existe pero no se usa desde el frontend. Esto implica escrituras no atómicas (riesgo de venta sin descuento de stock completo).
2. **Sin enums de base de datos**: los dominios se validan con `CHECK`, lo que requiere mantener manualmente la coherencia entre migraciones y frontend.
3. **Código legacy**: migraciones con columnas `gateway_*`/`wompi_*` y módulos no usados (`_shared/notify.ts`, `register-tenant`) permanecen en el repositorio.

Estas limitaciones se detallan en `09_Informe_Auditoria_y_Brechas.md`.

---

*Diagramas fuente (Mermaid) en `diagramas/arquitectura/` y `diagramas/secuencias/`.*
