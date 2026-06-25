# VenxPOS — SaaS Architecture

**Version**: 1.0.0
**Date**: 2026-06-19
**Stack**: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5, react-router-dom 7

---

## 1. Project Structure

```
venxpos-saas/
├── index.html                          # Entry HTML with meta tags, CSP preconnect
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # TypeScript root config
├── tsconfig.app.json                   # App-specific TS config
├── tsconfig.node.json                  # Node-specific TS config
├── vite.config.ts                      # Vite config (aliases, chunk splitting)
├── vercel.json                         # Vercel deployment (rewrites, headers, CSP)
├── postcss.config.js                   # PostCSS with Tailwind
├── eslint.config.js                    # ESLint flat config
├── .env.example                        # Environment variable template
├── .gitignore                          # Git ignore rules
│
├── public/
│   └── favicon.svg                     # App favicon
│
├── supabase/
│   ├── migrations/
│   │   └── 20260619_saas_core.sql      # Full SaaS schema + RLS + seed data
│   └── functions/
│       ├── _shared/
│       │   ├── cors.ts                 # CORS headers helper
│       │   ├── supabase.ts             # Supabase admin client factory
│       │   └── wompi.ts                # Wompi API client for Deno
│       ├── create-payment/
│       │   └── index.ts                # Payment source + transaction + DB record
│       └── wompi-webhook/
│           └── index.ts                # Webhook handler with signature verification
│
├── src/
│   ├── main.tsx                        # React root with BrowserRouter
│   ├── App.tsx                         # Route definitions + auth init
│   ├── index.css                       # Tailwind + custom styles
│   │
│   ├── types/
│   │   └── index.ts                    # All TypeScript interfaces (Tenant, Plan, Subscription, etc.)
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── client.ts              # Supabase JS client (anon key)
│   │   ├── wompi/
│   │   │   ├── client.ts              # WompiClient class (public/private keys)
│   │   │   └── types.ts               # Wompi type definitions
│   │   ├── utils.ts                    # formatCurrency, formatDate, classNames, status helpers
│   │   └── validators.ts              # Zod schemas (login, register, branch)
│   │
│   ├── store/
│   │   ├── useAuthStore.ts            # Auth state: session, user, tenant, plan, superadmin
│   │   └── useUIStore.ts              # UI state: sidebar, toasts
│   │
│   └── components/
│       ├── landing/
│       │   └── LandingPage.tsx        # Full landing page with GSAP animations
│       ├── auth/
│       │   ├── LoginPage.tsx          # Email/password login form
│       │   ├── RegisterPage.tsx       # Multi-step registration with plan selection
│       │   ├── AuthGuard.tsx          # Route guard: requires auth + active tenant
│       │   └── SuperAdminGuard.tsx   # Route guard: requires superadmin role
│       ├── payment/
│       │   ├── PaymentPage.tsx        # Payment flow orchestrator
│       │   ├── WompiWidget.tsx        # Wompi inline widget integration
│       │   └── PaymentStatus.tsx      # Status display (pending/approved/declined)
│       ├── dashboard/
│       │   ├── DashboardLayout.tsx   # Client dashboard shell (sidebar + header)
│       │   ├── DashboardHome.tsx     # KPI cards and quick stats
│       │   ├── SubscriptionPage.tsx  # Plan details, billing info
│       │   └── BranchesPage.tsx      # Branch account CRUD
│       └── admin/
│           ├── AdminLayout.tsx       # Admin panel shell (collapsible sidebar)
│           ├── AdminDashboard.tsx    # Superadmin KPIs (MRR, clients, revenue)
│           ├── AdminClients.tsx      # Tenant management table
│           └── AdminPayments.tsx     # Payment records table
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE.md
    ├── SAAS_ARCHITECTURE.md          # (this file)
    ├── POS_ARCHITECTURE.md
    ├── WOMPI.md
    ├── DEPLOY_GUIDE.md
    ├── BACKUP_RECOVERY.md
    ├── RLS_AUDIT.md
    ├── PAYMENTS_FLOW.md
    ├── SEO_REPORT.md
    ├── PERFORMANCE_REPORT.md
    ├── QA_REPORT.md
    ├── CHANGELOG.md
    ├── PRODUCTION_CHECKLIST.md
    ├── SECURITY_REPORT.md
    ├── RISK_ANALYSIS.md
    └── PRODUCTION_READINESS.md
```

---

## 2. State Management (Zustand Stores)

### 2.1 `useAuthStore`

The central authentication and tenant state store.

```typescript
interface AuthState {
  session: Session | null        // Supabase auth session
  user: User | null              // Supabase auth user
  tenant: Tenant | null          // Current tenant record
  plan: Plan | null              // Current subscription plan
  subscription: Subscription | null  // Active subscription
  isSuperadmin: boolean          // Platform admin flag
  loading: boolean               // Global loading state
  initialized: boolean           // App bootstrap complete

  initialize(): Promise<void>    // Called once on app mount
  login(email, password): Promise<{ error?, needsPayment? }>
  logout(): Promise<void>
  refreshTenant(): Promise<void> // Re-fetch tenant data after mutations
}
```

**Data flow on initialize():**
1. `supabase.auth.getSession()` — restore persisted session
2. Query `tenants` by `auth_user_id` — load tenant profile
3. If tenant found, query `plans` by `plan_id` — load plan details
4. Query `subscriptions` by `tenant_id` — load subscription
5. Query `superadmins` by `user_id` — determine superadmin status

### 2.2 `useUIStore`

UI-level state management.

```typescript
interface UIState {
  sidebarOpen: boolean           // Sidebar collapsed/open
  toasts: Toast[]                // Toast notification queue

  toggleSidebar(): void
  setSidebarOpen(open: boolean): void
  addToast(type, message): void  // Auto-dismiss after 5 seconds
  removeToast(id): void
}
```

---

## 3. Route Protection Flow

```
User requests /dashboard or /admin
         │
         ▼
   ┌─────────────┐     NO     ┌──────────────┐
   │ initialized? │──────────▶│ Show loader   │
   └──────┬──────┘            └──────────────┘
          │ YES
          ▼
   ┌─────────────┐     NO     ┌──────────────┐
   │ has session? │──────────▶│ /login        │
   └──────┬──────┘            └──────────────┘
          │ YES
          ▼
   ┌─────────────────────────┐
   │ Check tenant.estado     │
   └───────┬─────────────────┘
           │
     ┌─────┼─────────────────────────┐
     │     │                         │
     ▼     ▼                         ▼
  pending  active                 suspended
  _payment │                    / cancelled
     │     │                         │
     ▼     ▼                         ▼
  /pago   Check route           Status message
           │                    (block access)
     ┌─────┴─────┐
     │           │
     ▼           ▼
  /dashboard   /admin
  (any tenant  (isSuperadmin
   can access)  required)
```

---

## 4. Payment Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ RegisterPage │     │ PaymentPage  │     │ WompiWidget  │     │ Edge Function│
│              │     │              │     │  (iframe)    │     │ /create-pay  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │ 1. Create tenant   │                    │                    │
       │    estado=pending  │                    │                    │
       │                    │                    │                    │
       │ 2. Navigate to     │                    │                    │
       │───────────────────▶│                    │                    │
       │    /pago            │                    │                    │
       │                    │                    │                    │
       │                    │ 3. Fetch plan      │                    │
       │                    │    amount from DB  │                    │
       │                    │                    │                    │
       │                    │ 4. Get acceptance  │                    │
       │                    │    tokens from     │                    │
       │                    │    WompiClient     │                    │
       │                    │                    │                    │
       │                    │ 5. Mount widget    │                    │
       │                    │───────────────────▶│                    │
       │                    │   pub_key, amount  │                    │
       │                    │                    │                    │
       │                    │                    │ 6. User fills      │
       │                    │                    │    card details    │
       │                    │                    │                    │
       │                    │                    │ 7. Widget returns  │
       │                    │◄───────────────────│    card token      │
       │                    │   onToken(cardTok) │                    │
       │                    │                    │                    │
       │                    │ 8. POST with JWT   │                    │
       │                    │────────────────────────────────────────▶│
       │                    │   { token,         │                    │
       │                    │     amountInCents, │                    │
       │                    │     tenantId,      │                    │
       │                    │     planId,        │                    │
       │                    │     customerEmail, │                    │
       │                    │     acceptance... }│                    │
       │                    │                    │                    │
       │                    │                    │ 9. Create payment  │
       │                    │                    │    source at Wompi │
       │                    │                    │                    │
       │                    │                    │ 10. Create Wompi   │
       │                    │                    │     transaction    │
       │                    │                    │                    │
       │                    │                    │ 11. Record payment │
       │                    │                    │     in DB (pending)│
       │                    │                    │                    │
       │                    │                    │ 12. Create/update  │
       │                    │                    │     subscription   │
       │                    │                    │     (pending)      │
       │                    │                    │                    │
       │                    │ 13. Return         │                    │
       │◄───────────────────────────────────────│                    │
       │                    │   { transactionId, │                    │
       │                    │     reference,     │                    │
       │                    │     paymentId }    │                    │
       │                    │                    │                    │
       │                    │ 14. Show pending   │                    │
       │                    │     status to user │                    │
       │                    │                    │                    │
       │                    │                    │                    │
       │  ...webhook arrives (separate path)                            │
       │  ...tenant activated                                           │
       │  ...user redirected to /dashboard                              │
```

---

## 5. Component Breakdown by Section

### 5.1 Landing Section (`/`)

**`LandingPage.tsx`** — Full-page marketing site (no auth required)
- Hero section with GSAP text animation
- Feature grid (6 cards: multi-sucursal, inventory, reports, cash control, security, offline)
- Pricing table (fetches `plans` from Supabase, displays dynamically)
- FAQ accordion
- CTA sections with GSAP scroll-triggered animations
- Navigation: sticky header, mobile hamburger menu
- Footer with links

**Dependencies:** GSAP + ScrollTrigger, lucide-react icons, react-router-dom Link

### 5.2 Auth Section (`/login`, `/registro/:planId?`)

**`LoginPage.tsx`** — Email/password authentication
- react-hook-form with zod validation
- Calls `useAuthStore.login()`
- Handles `needsPayment` flag to redirect to `/pago`
- Links to registration

**`RegisterPage.tsx`** — Multi-step registration
- Step 1: Read plan from URL param or show plan selector
- Step 2: Business details form (nombre_negocio, nit, email, telefono)
- Step 3: Account creation (password with confirmation)
- Terms acceptance checkbox
- Calls `supabase.auth.signUp()` then creates `tenants` record
- RLS allows INSERT on `tenants` with `auth.uid()` match
- Redirects to `/pago` on success

### 5.3 Payment Section (`/pago`)

**`PaymentPage.tsx`** — Orchestrates the payment flow
- Requires auth + tenant with `estado = 'pending_payment'`
- Fetches plan details and calculates amount
- Obtains Wompi acceptance tokens
- Renders WompiWidget

**`WompiWidget.tsx`** — Wompi inline checkout
- Mounts Wompi JavaScript widget via script injection
- Passes public key, amount, currency
- Receives card token via callback
- Calls Edge Function `/create-payment` with JWT auth header
- Edge function performs all Wompi API calls server-side

**`PaymentStatus.tsx`** — Payment result display
- Polls or waits for payment status
- Shows success/failure/pending states
- On approved: calls `refreshTenant()` and redirects to `/dashboard`

### 5.4 Dashboard Section (`/dashboard/*`)

**`DashboardLayout.tsx`** — Client dashboard shell
- Responsive sidebar with navigation (Dashboard, Subscription, Branches)
- Breadcrumb navigation
- User info (tenant name, email, plan badge)
- Logout button
- Redirects `pending_payment` tenants to `/pago`
- Wrapped in `AuthGuard`

**`DashboardHome.tsx`** — Client home page
- KPI summary cards (branches count, subscription status, next billing date)
- Quick links to subscription and branches

**`SubscriptionPage.tsx`** — Subscription management
- Current plan details (name, features, pricing)
- Billing dates (start, renewal, next charge)
- Payment history
- Plan change option (future)

**`BranchesPage.tsx`** — Branch account CRUD
- List branch accounts for current tenant
- Create new branch (name, email, password)
- Branch limit enforcement via `count_branches_for_tenant()`
- Deactivate/reactivate branches
- Creates `auth.users` + `branch_accounts` records

### 5.5 Admin Section (`/admin/*`)

**`AdminLayout.tsx`** — Superadmin panel shell
- Collapsible sidebar (JGSoftworks branding)
- Navigation: Dashboard, Clients, Payments
- Wrapped in `SuperAdminGuard`

**`AdminDashboard.tsx`** — Platform KPIs
- MRR (monthly recurring revenue)
- Active clients count
- Past-due subscriptions count
- Monthly revenue
- Total branches across all tenants
- Conversion rate
- Revenue chart (future)

**`AdminClients.tsx`** — Tenant management
- Searchable/filterable table of all tenants
- Status filters (active, pending_payment, suspended, cancelled)
- Plan filters
- View tenant details
- Suspend/activate/cancel tenant actions
- Export capability (future)

**`AdminPayments.tsx`** — Payment records
- Filterable table of all payments
- Status, date range, type filters
- Detailed view with Wompi transaction IDs
- Manual payment recording (future)

---

## 6. Edge Function Catalog

| # | Function | Endpoint | Trigger | Purpose |
|---|----------|----------|---------|---------|
| 1 | `create-payment` | `POST /create-payment` | Client (JWT) | Tokenize card → create payment source → create transaction → record in DB |
| 2 | `wompi-webhook` | `POST /wompi-webhook` | Wompi webhook | Verify signature → check amount → activate tenant or process renewal |
| 3 | `process-renewals` | `GET /process-renewals` | Cron (pg_cron or external) | Find subscriptions due for renewal → charge via payment source → create payment record |
| 4 | `send-email` | Internal call | Webhook/Function | Send transactional emails via Resend (activation, renewal, invoice, password reset) |
| 5 | `get-admin-kpis` | `GET /get-admin-kpis` | Admin panel | Aggregate MRR, active clients, payment stats (service_role) |
| 6 | `get-tenant-stats` | `GET /get-tenant-stats` | Dashboard | Per-tenant stats: branch count, subscription health |

**Implemented:** Functions 1 and 2 are fully implemented.
**Planned:** Functions 3-6 are designed but pending implementation.

All Edge Functions:
- Run on Deno runtime
- Use `service_role` Supabase client (RLS bypass)
- Use `_shared/wompi.ts` for Wompi API calls (private key server-side only)
- Return CORS headers from `_shared/cors.ts`
- Have no direct database connection — all DB operations via Supabase JS client

---

## 7. Wompi Integration Details

### Key Architecture

```
Frontend (Browser)                    Edge Function (Deno)
─────────────────────                 ─────────────────────
  WompiWidget                          create-payment
  - Public key                         - Private key
  - Card tokenization only             - Payment source creation
  - Integrity check                    - Transaction creation
                                       - DB record insertion
                                       - Integrity signature
                                       generation
```

### Security

- **Public key** (`pub_test_*` / `pub_prod_*`): Embedded in frontend via `VITE_WOMPI_PUBLIC_KEY`. Safe for client-side.
- **Private key** (`prv_test_*` / `prv_prod_*`): Stored in Supabase Edge Function secrets. Never exposed.
- **Events secret** (`test_events_*` / `prod_events_*`): Used for webhook signature verification. Edge Function only.
- **Integrity secret** (`test_integrity_*` / `prod_integrity_*`): Used for transaction integrity signatures. Edge Function only.

### Environments

| | Sandbox | Production |
|---|---|---|
| API Base | `https://sandbox.wompi.co/v1` | `https://production.wompi.co/v1` |
| Public Key | `pub_test_*` | `pub_prod_*` |
| Private Key | `prv_test_*` | `prv_prod_*` |
| Widget URL | `https://checkout.wompi.co` | `https://checkout.wompi.co` |
| Webhook Source | `https://sandbox.wompi.co` | `https://production.wompi.co` |

---

## 8. Resend Email Integration

### Usage

- Transactional emails sent from Edge Functions via Resend API
- API key stored as Edge Function secret (`RESEND_API_KEY`)
- Domain: `venxpos.com` (must be verified in Resend dashboard)

### Planned Email Templates

| Trigger | Template | Recipient |
|---------|----------|-----------|
| Registration | Welcome + confirm email | `tenants.email_propietario` |
| Payment approved | Activation confirmation | `tenants.email_propietario` |
| Monthly renewal | Invoice + subscription update | `tenants.email_propietario` |
| Payment failed | Past-due notice | `tenants.email_propietario` |
| Branch created | Branch credentials | `branch_accounts.email` |
| Admin action | Account status change | `tenants.email_propietario` |

### Implementation

```typescript
// Edge Function
import { Resend } from 'npm:resend'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

await resend.emails.send({
  from: 'VenxPOS <noreply@venxpos.com>',
  to: customerEmail,
  subject: 'Tu cuenta ha sido activada',
  html: `<h1>Bienvenido a VenxPOS</h1>...`,
})
```

---

## 9. Vercel Deployment Config

**`vercel.json`:**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://checkout.wompi.co https://widget.wompi.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://beacnoxukkoellhecofm.supabase.co https://sandbox.wompi.co https://production.wompi.co; frame-src https://checkout.wompi.co;" }
    ]
  }]
}
```

### Build Script
```bash
npm run build     # tsc -b && vite build
npm run deploy    # npm run build && npx vercel --prod
```

### Vite Build Config
- Code splitting: `vendor` (React stack), `supabase` (Supabase JS), `animation` (GSAP + Motion)
- Source maps: disabled in production
- Aliases: `@` → `src/`

---

## 10. SEO Strategy

See `docs/SEO_REPORT.md` for detailed analysis.

### Current Implementation
- `<meta name="description">` in `index.html`
- `<title>` tag
- Language attribute: `es-CO`
- Theme color meta tag
- Preconnect to Supabase origin

### Planned
- JSON-LD structured data for SaaS application
- OpenGraph tags (og:title, og:description, og:image)
- Twitter card tags
- `sitemap.xml` generation
- `robots.txt` configuration
- Canonical URLs
- Hreflang tags (if multi-language)

---

*End of SaaS Architecture Document*
