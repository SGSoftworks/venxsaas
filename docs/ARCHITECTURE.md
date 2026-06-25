# VenxPOS — System Architecture

**Version**: 1.0.0
**Date**: 2026-06-19
**Audience**: Engineering Team, DevOps, Architecture Review

---

## 1. Ecosystem Overview

VenxPOS is a two-product ecosystem:

| Product | Type | Users | Deployment |
|---------|------|-------|------------|
| **VenxPOS SaaS** | Web platform (React 19 SPA) | Business owners, superadmins | Vercel (static + Edge) |
| **VenxPOS Desktop** | Desktop app (Tauri v2 + React 19) | Cashiers, branch admins | Tauri MSI/NSIS installer |

Both products share a **single Supabase PostgreSQL database** with Row-Level Security (RLS) enforcing strict data isolation between tenants.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VenxPOS Ecosystem                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐          ┌──────────────────────────┐     │
│  │   VenxPOS SaaS       │          │   VenxPOS Desktop (Tauri) │     │
│  │   (React 19 SPA)     │          │   (React 19 + Rust)      │     │
│  │                      │          │                          │     │
│  │  - Landing page      │          │  - Login / PIN auth      │     │
│  │  - Registration      │          │  - POS terminal          │     │
│  │  - Payment (Wompi)   │          │  - Inventory management  │     │
│  │  - Client dashboard  │          │  - Sales reports         │     │
│  │  - Superadmin panel  │          │  - Cash register         │     │
│  │  - Branch management │          │  - Offline mode          │     │
│  └──────────┬───────────┘          └────────────┬─────────────┘     │
│             │                                   │                   │
│             └───────────────┬───────────────────┘                   │
│                             │                                       │
│                  ┌──────────▼──────────┐                            │
│                  │     Supabase        │                            │
│                  │  (PostgreSQL + RLS) │                            │
│                  └──────────┬──────────┘                            │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                   │
│  ┌──────▼──────┐   ┌───────▼───────┐   ┌───────▼───────┐           │
│  │   Wompi     │   │    Resend     │   │    Vercel     │           │
│  │  (Payments) │   │   (Email)     │   │  (Hosting)    │           │
│  └─────────────┘   └───────────────┘   └───────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack Comparison

| Layer | SaaS Platform | POS Desktop |
|-------|---------------|-------------|
| **Runtime** | Browser (V8) | Tauri v2 (Rust + WebView2) |
| **Framework** | React 19 | React 19 |
| **Language** | TypeScript 6.0 | TypeScript 6.0 |
| **Bundler** | Vite 8 | Vite 8 |
| **Routing** | react-router-dom v7 | react-router-dom v7 |
| **State** | Zustand 5 | Zustand 5 |
| **Styling** | Tailwind CSS 4 | Tailwind CSS 4 |
| **Animation** | GSAP 3 + Motion | — |
| **Forms** | react-hook-form + zod | react-hook-form + zod |
| **Icons** | lucide-react | lucide-react |
| **Desktop Shell** | — | Tauri v2 (Rust backend) |
| **Auth** | Supabase Auth (JWT) | Supabase Auth (JWT) |
| **Database** | Supabase PostgreSQL | Supabase PostgreSQL |
| **API Layer** | PostgREST + Edge Functions | PostgREST |
| **Payments** | Wompi (API + Widget) | — |
| **Email** | Resend | — |
| **Hosting** | Vercel | Self-installed (MSI/NSIS) |

---

## 3. Data Flow: Registration + Payment + Activation

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browser │     │  Vercel  │     │ Supabase │     │  Wompi   │     │  Wompi   │
│  (SPA)   │     │  (CDN)   │     │ (DB+Auth)│     │ (Widget) │     │ (Webhook)│
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                 │               │                │                │
     │ 1. Fill form    │               │                │                │
     │─────────────────────────────────>                │                │
     │  POST /auth/v1/signup           │                │                │
     │                │               │                │                │
     │ 2. RegisterPage creates:        │                │                │
     │    - auth.users record          │                │                │
     │    - tenants record             │                │                │
     │      (estado=pending_payment)   │                │                │
     │                │               │                │                │
     │ 3. Redirect to /pago            │                │                │
     │                │               │                │                │
     │ 4. Load Wompi Widget            │                │                │
     │────────────────────────────────────────────────>│                │
     │   WompiWidget (vite env pub_key)│                │                │
     │                │               │                │                │
     │ 5. User enters card data        │                │                │
     │   Widget returns card token     │                │                │
     │                │               │                │                │
     │ 6. POST Edge Function           │                │                │
     │────────────────────────────────>│                │                │
     │   /create-payment               │                │                │
     │   { token, amountInCents, ... } │                │                │
     │                │               │                │                │
     │                │  7. Create payment source      │                │
     │                │ ──────────────────────────────>│                │
     │                │               │                │                │
     │                │  8. Create transaction         │                │
     │                │ ──────────────────────────────>│                │
     │                │               │                │                │
     │                │  9. Record payment (pending)   │                │
     │                │ <──────────────                │                │
     │                │               │                │                │
     │ 10. Return { transactionId }    │                │                │
     │ <───────────────────────────────│                │                │
     │                │               │                │                │
     │                │               │  11. Wompi processes payment     │
     │                │               │                │                │
     │                │               │  12. POST webhook (transaction.updated)
     │                │               │ <───────────────────────────────│
     │                │               │                │                │
     │                │               │  13. Edge Function:              │
     │                │               │      Verify signature            │
     │                │               │      Double-check amount         │
     │                │               │      Call activate_tenant()      │
     │                │               │      - payment.status=approved   │
     │                │               │      - INSERT empresas           │
     │                │               │      - INSERT subscriptions      │
     │                │               │      - INSERT subscription_events│
     │                │               │      - tenants.estado=active     │
     │                │               │                │                │
     │ 14. User redirected to dashboard│                │                │
     │   /dashboard (tenant active)    │                │                │
     │                │               │                │                │
```

---

## 4. Route Hierarchy

```
/                          → LandingPage (public)
/login                     → LoginPage (public)
/registro/:planId?         → RegisterPage (public)
/pago                      → PaymentPage (requires auth + pending_payment)

/dashboard                 → DashboardLayout (AuthGuard)
  /dashboard               → DashboardHome (index)
  /dashboard/suscripcion   → SubscriptionPage
  /dashboard/sucursales    → BranchesPage

/admin                     → AdminLayout (SuperAdminGuard)
  /admin                   → AdminDashboard (index)
  /admin/clientes          → AdminClients
  /admin/pagos             → AdminPayments
```

**Route Guards:**

| Guard | Condition | Redirect on Fail |
|-------|-----------|------------------|
| `AuthGuard` | session exists, tenant active | `/login`, `/pago`, or status message |
| `SuperAdminGuard` | session + isSuperadmin | `/login` or `/dashboard` |

---

## 5. Component Tree

```
App
├── FullScreenLoader          (loading state)
├── Routes
│   ├── LandingPage           (public, GSAP animations, pricing plans)
│   ├── LoginPage             (public, react-hook-form + zod)
│   ├── RegisterPage          (public, plan selector, form wizard)
│   ├── PaymentPage           (auth'd, WompiWidget + PaymentStatus)
│   ├── DashboardLayout       (AuthGuard wrapper)
│   │   ├── Sidebar + breadcrumbs
│   │   └── Outlet
│   │       ├── DashboardHome       (KPI cards, quick stats)
│   │       ├── SubscriptionPage    (plan details, billing dates)
│   │       └── BranchesPage        (CRUD branch accounts)
│   └── AdminLayout           (SuperAdminGuard wrapper)
│       ├── Collapsible sidebar
│       └── Outlet
│           ├── AdminDashboard      (KPIs: MRR, active clients, revenue)
│           ├── AdminClients        (table: all tenants, filters, actions)
│           └── AdminPayments       (table: all payments, filters)
└── Toasts                  (global, useUIStore-driven)
```

---

## 6. Database Module Separation

The database is organized into logical modules sharing the same PostgreSQL instance with RLS isolation:

| Module | Tables | Purpose |
|--------|--------|---------|
| **SaaS Tenancy** | `plans`, `tenants`, `subscriptions`, `subscription_events`, `payments`, `branch_accounts`, `superadmins` | Multi-tenant SaaS operations |
| **Business Config** | `empresas`, `sucursales`, `configuracion_fiscal` | Company and branch setup |
| **Users** | `usuarios` (+ `auth.users` supabase) | POS user accounts |
| **Products** | `categorias`, `productos` | Product catalog |
| **Inventory** | `inventario_sucursal`, `ajustes_inventario` | Stock per branch |
| **Sales** | `ventas`, `detalle_ventas`, `devoluciones` | Transaction records |
| **Cash** | `cierres_caja` | Cash register management |
| **Audit** | `eventos_auditoria`, `conflictos_inventario` | Logging & conflict tracking |

The `empresas` table links POS data to SaaS tenants via `empresas.tenant_id → tenants.id`.

---

## 7. Edge Function Architecture

```
supabase/functions/
├── _shared/
│   ├── cors.ts          → CORS headers for all functions
│   ├── supabase.ts      → Supabase admin client (service_role)
│   └── wompi.ts         → Wompi API client (private key, integrity, signature verification)
│
├── create-payment/      → POST /create-payment
│   └── index.ts         → Card token → payment source → transaction → DB record
│
├── wompi-webhook/       → POST /wompi-webhook (Wompi calls this)
│   └── index.ts         → Verify signature → check amount → activate_tenant / process_renewal
│
├── (planned) process-renewals/
│   └── index.ts         → Cron-triggered: find due subscriptions → charge → webhook processes result
│
├── (planned) send-email/
│   └── index.ts         → Send transactional emails via Resend
│
├── (planned) get-admin-kpis/
│   └── index.ts         → Aggregate KPIs for superadmin dashboard
│
└── (planned) get-tenant-stats/
    └── index.ts         → Per-tenant stats for client dashboard
```

**Key design decisions:**
- All Wompi API calls with private keys happen in Edge Functions (never in browser).
- Webhook signature is verified with SHA-256 HMAC before any DB mutation.
- Amount is double-checked: webhook `amount_in_cents` vs DB `payments.amount`.
- Idempotency: already-approved transactions are skipped.
- All Edge Functions use `service_role` Supabase client (bypasses RLS).

---

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                 │
└───────┬──────────────┬──────────────┬──────────────┬───────────┘
        │              │              │              │
   ┌────▼────┐    ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ Vercel  │    │ Supabase│   │  Wompi  │   │ Resend  │
   │ (CDN)   │    │ (Cloud) │   │  (API)  │   │ (API)   │
   └────┬────┘    └────┬────┘   └─────────┘   └─────────┘
        │              │
        │   SPA assets │
        │◄─────────────│  (anon key)
        │              │
        │   Edge Functions (Deno)
        │──────────────>
        │              │  (service_role key)
        │              │
        │              │
   ┌────▼────┐    ┌────▼────┐
   │  User   │    │  POS    │
   │ Browser │    │ Desktop │
   └─────────┘    └─────────┘
```

**VenxPOS SaaS (Vercel):**
- Static assets served via Vercel CDN (global edge).
- SPA routing: all paths rewrite to `/index.html` (vercel.json).
- CSP, HSTS, X-Frame-Options configured via Vercel headers.
- Build: `tsc -b && vite build` → Vercel deploys `dist/`.

**Supabase Cloud:**
- PostgreSQL 17 with RLS enabled on all 22 tables.
- Edge Functions (Deno) for secure server-side logic.
- Auth (Gotrue) for JWT-based authentication.
- Storage for static assets (if needed).
- Realtime for live updates (optional).

**Key environment separation:**

| Layer | Secrets | Source |
|-------|---------|--------|
| Frontend (Vite) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WOMPI_PUBLIC_KEY` | `.env.production` |
| Edge Functions | `SUPABASE_SERVICE_ROLE_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`, `RESEND_API_KEY` | `supabase secrets set` |
| Vercel | Build env only (no runtime secrets) | Vercel dashboard |

---

*End of Architecture Document*
