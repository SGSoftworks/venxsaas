# VenxPOS — Arquitectura General

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, TailwindCSS v4, Zustand, React Router v7 |
| Backend | Supabase (Auth, Database, Storage, Edge Functions Deno) |
| Pagos | Wompi Sandbox API |
| Email | Resend |
| Hosting | Vercel (SPA), Netlify (POS web), Supabase (EF) |
| Exportación | xlsx |

## Estructura del proyecto

```
venxpos-saas/
├── src/                    # Frontend React
│   ├── components/         # UI, auth, dashboard, admin, landing, legal
│   ├── store/              # Zustand (auth, ui, billing)
│   ├── lib/                # Clientes Supabase, utilidades, export, validators
│   ├── types/              # Tipos TypeScript
│   └── assets/             # Imágenes, branding
├── supabase/
│   ├── functions/          # 19 Edge Functions Deno
│   │   └── _shared/        # CORS, auth, Wompi, notificaciones, env
│   └── migrations/         # 64 migraciones SQL
├── api/                    # Vercel serverless wrappers (CRON)
├── scripts/                # Scripts de seed/simulación
└── vercel.json             # CSP, CRON jobs, rewrites
```

## Frontend — Routing

- **Público**: LandingPage, LoginPage, PaymentPage, CheckoutPage, PaymentSuccess, PaymentPending, PaymentFailed
- **Protegido (AuthGuard)**: Dashboard (home, inventario, facturas, sucursales, analytics, suscripción, configuración)
- **Admin (GerenteGuard)**: AdminDashboard, AdminClients, AdminPayments, AdminBilling, AdminAnalytics, AdminRequests
- **Estados especiales**: PendingApprovalPage (espera aprobación), ChangePasswordPage (primer login)
- **Páginas legales**: 7 páginas (términos, privacidad, cookies, etc.)
- **Errores**: 404, 403, 500

## Backend — Supabase

### Auth
- Supabase Auth nativo (email/password)
- JWT verificado en Edge Functions via `supabaseAdmin.auth.getUser()`
- Superadmin detectado via tabla `superadmins` + función `is_superadmin()`

### Edge Functions (19)
- **Registro**: `create-signup` → `check-signup` → `register-tenant` → `approve-tenant`
- **Pagos**: `create-payment` → `check-payment` → `wompi-webhook` → `reconcile-payments`
- **Suscripciones**: `renew-subscriptions` (CRON), `change-plan`, `create-renewal-payment`
- **Facturación**: `generate-invoice`, `generate-pdf`
- **Admin**: `create-client`, `create-branch`, `update-branch`, `admin-reset-password`
- **Utilidades**: `send-email`, `log-audit`, `simulate-payment`

### Shared Modules (`_shared/`)
- `cors.ts` — Whitelist de orígenes permitidos
- `supabase.ts` — `supabaseAdmin` (service_role) + verifyAuth, verifySuperAdmin, verifyInternalKey
- `wompi.ts` — Firma de integridad, verificación de webhooks (TTL 5min), peticiones API
- `notify.ts` + `email-template.ts` — Notificaciones transaccionales
- `env.ts` — Mapeo de variables de entorno

### Base de datos
- **SaaS**: tenants, plans, subscriptions, payments, facturas_saas, branch_accounts, pending_signups, subscription_requests, payment_proofs, audit_logs, superadmins
- **POS**: sucursales, usuarios, productos, inventario_sucursal, ventas, venta_detalles, aperturas_caja, cierres_caja, categorias, movimientos_inventario, devoluciones, eventos_auditoria, configuracion_fiscal, ventas_conflicto, empresas
- **RLS**: Políticas por tenant + superadmin. Uso de `get_user_sucursal()` para POS.

### Seguridad
- JWT validation en Edge Functions
- Webhook Wompi con firma SHA-256, TTL 5min
- RLS en todas las tablas (excepto plans y superadmins, intencional)
- Service_role solo en Edge Functions (nunca en frontend)
- CSP en vercel.json
- SECURITY DEFINER con `search_path = ''` en todas las RPCs

## Flujo de registro y pago

1. Usuario llena formulario en LandingPage → `create-signup` (EF pública)
2. Usuario es redirigido a Wompi Widget para pagar
3. Frontend pollea `check-signup` hasta que Wompi aprueba
4. Webhook Wompi confirma pago → `wompi-webhook` activa tenant
5. Admin aprueba manualmente → `approve-tenant`
6. Usuario hace login, cambia contraseña, accede al dashboard
7. POS web vinculado via `branch_accounts`

## Despliegue
- Frontend: `npm run build` → Vercel (SPA rewrites)
- Edge Functions: `supabase functions deploy <name> --project-ref <ref>`
- Migraciones: `supabase db push` o `supabase db query --file <file> --linked`
