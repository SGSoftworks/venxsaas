# VenxPOS — Arquitectura del Sistema

Documento de arquitectura del proyecto (panel SaaS + punto de venta). Refleja el estado real del código y de la base de datos. La documentación técnica completa está en `Entrega_tecnica/`.

## 1. Visión general

VenxPOS se compone de **dos aplicaciones SPA independientes** que comparten **un único backend Supabase**:

- **Panel SaaS** (`venxpos-saas`): administración multi-inquilino (dashboard de negocio y panel superadmin).
- **POS** (`venxpos`): punto de venta de sucursal (ventas, devoluciones, caja).

No existe un servidor de aplicación propio. La lógica privilegiada vive en **funciones RPC de PostgreSQL** y en **Edge Functions de Deno**; el frontend consume el resto directamente mediante **PostgREST + RLS**.

## 2. Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS v4, Zustand |
| Routing | React Router v7 (panel SaaS) |
| Formularios | React Hook Form + Zod |
| Backend | Supabase: Auth (JWT), PostgreSQL, PostgREST, Storage, Edge Functions (Deno) |
| Pagos | Manual (el superadministrador registra/aprueba pagos; sin pasarela) |
| Email | Resend (vía Edge Function) |
| Hosting | Vercel (SPA con rewrites) |
| Exportación | `xlsx` (Excel); `jspdf` (PDF, POS) |
| Animaciones | GSAP + ScrollTrigger (landing) |

Proyecto Supabase: `beacnoxukkoellhecofm`.

## 3. Estructura

```
venxpos-saas/
├── src/
│   ├── components/   # landing, auth, dashboard, admin, legal, ui
│   ├── lib/          # cliente Supabase, utilidades, export, validators, appConfig
│   ├── store/        # Zustand (auth, ui, billing)
│   └── types/        # tipos TypeScript
├── supabase/
│   ├── migrations/   # 74 migraciones SQL
│   └── functions/    # 11 Edge Functions Deno + _shared/
├── docs/             # documentación
└── vercel.json       # CSP, cabeceras y rewrites SPA
```

## 4. Arquitectura por capas

1. **Presentación**: SPAs React. Enrutamiento con guards por rol.
2. **Aplicación/servicios**: módulos y stores del frontend; servicios de dominio que encapsulan queries y RPC.
3. **Datos**: PostgreSQL con RLS; RPCs para operaciones atómicas; triggers y contadores.
4. **Plataforma**: Auth, PostgREST, Storage y Edge Functions (Deno) con `service_role`.

### Frontend — routing

- **Público**: landing, login, registro, páginas legales.
- **Dashboard de negocio** (`/dashboard/*`): `AuthGuard` + `AdminNegocioGuard`.
- **Administración** (`/admin/*`): `GerenteGuard` (superadmin).
- **POS**: pantalla única `App → Login → ConnectionGuard → POSLayout` (online), con `Receipt` para impresión.

## 5. Modelo de datos

- **29 tablas** en el esquema `public`.
- **Sin tipos `ENUM`**: los dominios se modelan con columnas de texto y restricciones `CHECK`.
- **~50 funciones** (RPC/helpers).
- **RLS habilitada en todas las tablas**; aislamiento por tenant (`get_tenant_id`) y por sucursal (`get_user_sucursal`).
- Concurrencia de inventario con **bloqueo optimista** (`inventario_sucursal.version`).

Detalle en `Entrega_tecnica/04_Modelo_Entidad_ER.md`.

## 6. Multi-tenancy y roles

| Rol | Alcance | Guard |
|---|---|---|
| Superadministrador | Plataforma (tenants, planes, pagos, facturas, analítica global) | `GerenteGuard` |
| Administrador de negocio | Su tenant (sucursales, inventario, suscripción) | `AuthGuard` + `AdminNegocioGuard` |
| Cajero | POS de su sucursal (ventas, devoluciones, caja) | Sesión POS + sucursal |

El aislamiento se garantiza por **RLS**; `service_role` se usa únicamente dentro de las Edge Functions.

## 7. Edge Functions (Deno)

`create-signup`, `register-tenant`, `create-client`, `approve-tenant`, `admin-reset-password`, `create-branch`, `update-branch`, `generate-invoice`, `generate-pdf`, `log-audit`, `send-email`. Código compartido en `_shared/` (`cors`, `supabase`, `env`, `notify`, plantillas).

## 8. Seguridad

- RLS multi-inquilino en todas las tablas.
- `service_role` solo en Edge Functions (nunca en el bundle).
- Cabeceras HTTP en `vercel.json`: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- CORS con lista blanca de orígenes (Edge Functions).
- Validación con Zod en el frontend y `CHECK`/RPC en la base de datos.
- Auditoría en `audit_logs` y `eventos_auditoria`.

## 9. Despliegue

- **Base de datos y Functions**: Supabase (`supabase db push` / `supabase functions deploy`).
- **Frontend SaaS**: Vercel (`npm run build` + `vercel --prod`), con rewrites SPA.
- **POS**: SPA independiente, enlazada desde el panel.

## 10. Libro de limitaciones

Ver `Entrega_tecnica/09_Informe_Auditoria_y_Brechas.md` (p. ej. lógica de venta en el cliente con `inserts` directos + RPC de inventario en lugar de la RPC transaccional `finalizar_venta`).

---

*Documento basado en la investigación técnica de `Entrega_tecnica/`. Fuentes: código de ambos repositorios, 74 migraciones y la introspección del esquema en vivo.*
