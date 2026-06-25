# VenxPOS — QA Report

**Version**: 1.0.0
**Date**: 2026-06-19
**Scope**: SaaS platform (web), payment integration, database, authentication

---

## 1. Testing Strategy Overview

### Test Pyramid

```
         ┌─────────┐
         │   E2E   │  5%   — Critical user journeys
         │  (Future)│       (registration → payment → dashboard)
         ├─────────┤
         │   API   │  15%  — Edge Functions, RPC, webhook
         │  (Future)│       handler logic
         ├─────────┤
         │  Unit   │  20%  — validators, utils, store logic
         │  (Future)│
         ├─────────┤
         │ Manual  │  60%  — Exploratory, UX, cross-browser,
         │  (Now)  │       visual regression, RLS verification
         └─────────┘
```

### Current State

| Test Type | Framework | Status | Coverage |
|-----------|-----------|--------|----------|
| Unit tests | Vitest (TBD) | **Not implemented** | 0% |
| Component tests | React Testing Library (TBD) | **Not implemented** | 0% |
| API tests | Supertest / custom | **Partial** (manual curl) | ~30% |
| E2E tests | Playwright / Cypress (TBD) | **Not implemented** | 0% |
| Manual testing | Manual checklist (this doc) | **Active** | ~60% of critical paths |

### Recommended Test Frameworks

| Layer | Framework | Why |
|-------|-----------|-----|
| Unit | Vitest | Native Vite integration, fast |
| Component | @testing-library/react | Works with React 19 |
| API/Edge | Vitest + MSW or custom scripts | Test Edge Functions in isolation |
| E2E | Playwright | Cross-browser, mobile emulation, reliable |

---

## 2. Manual Test Cases — Critical Paths

### TC-001: User Registration (Happy Path)

| Field | Value |
|-------|-------|
| **Priority** | P0 (Blocker) |
| **Precondition** | Supabase project running, Wompi sandbox keys configured |

**Steps:**
1. Navigate to `https://venxpos.com/`
2. Click "Comenzar ahora" or navigate to `/registro`
3. Select a plan (e.g., Básico)
4. Fill registration form:
   - Nombre del negocio: `Tienda Test QA`
   - NIT: `123456789-0`
   - Correo: `testqa+{timestamp}@example.com`
   - Teléfono: `3001234567`
   - Contraseña: `TestQA2026!`
   - Confirmar contraseña: `TestQA2026!`
5. Check "Acepto los términos y condiciones"
6. Click "Crear cuenta"

**Expected Results:**
- [ ] Loading spinner appears
- [ ] Redirected to `/pago`
- [ ] In Supabase, check `auth.users` — new user exists with correct email
- [ ] In Supabase, check `tenants` — new record with `estado = 'pending_payment'`
- [ ] `tenants.auth_user_id` matches `auth.users.id`
- [ ] `tenants.plan_id` matches selected plan
- [ ] No error toast appears

### TC-002: User Registration (Validation Errors)

**Steps:**
1. Navigate to `/registro`
2. Submit empty form

**Expected Results:**
- [ ] "Nombre del negocio" field shows "Mínimo 3 caracteres"
- [ ] "NIT" field shows "NIT requerido"
- [ ] "Correo" field shows "Correo inválido" (if empty/invalid)
- [ ] "Teléfono" field shows "Teléfono requerido"
- [ ] "Contraseña" field shows "Mínimo 8 caracteres"
- [ ] "Acepto los términos" shows error if unchecked
- [ ] No API call is made (client-side validation)

3. Enter mismatched passwords
4. Click submit

**Expected Results:**
- [ ] "Las contraseñas no coinciden" error appears
- [ ] No API call is made

5. Enter an already-registered email
6. Click submit

**Expected Results:**
- [ ] Error toast: "El correo ya está registrado" or similar
- [ ] No duplicate tenant created

### TC-003: Payment Flow (Happy Path — Sandbox)

**Precondition:** Tenant in `pending_payment` state.

**Steps:**
1. Login with `pending_payment` tenant credentials
2. Should be redirected to `/pago`
3. Verify plan name and amount displayed correctly
4. Wompi widget renders (card form fields visible)
5. Enter test card: `4242 4242 4242 4242`, exp `12/30`, CVV `123`, name `Test User`
6. Click "Pagar"

**Expected Results:**
- [ ] Loading indicator appears
- [ ] "Pago procesado exitosamente" or success message appears
- [ ] Redirected to `/dashboard`

**Verify in Supabase:**
- [ ] `payments` table: new record with `status = 'approved'`, `tipo = 'initial'`
- [ ] `payments.wompi_reference` starts with `VENX-`
- [ ] `empresas` table: new record with correct `nombre_negocio`, `nit`, `tenant_id`
- [ ] `subscriptions` table: new record with `estado = 'active'`
- [ ] `subscription_events` table: new record with `tipo = 'activated'`
- [ ] `tenants.estado` changed to `'active'`

### TC-004: Payment Flow (Declined Card)

**Steps:**
1. Follow TC-003 steps 1–4
2. Use declined test card: `4000 0000 0000 0127` (insufficient funds)

**Expected Results:**
- [ ] Error message displayed
- [ ] User can retry with different card
- [ ] `payments` record with `status = 'declined'`
- [ ] `tenants.estado` remains `'pending_payment'`
- [ ] No empresa or subscription created

### TC-005: Client Dashboard Access

**Precondition:** Active tenant (post-payment).

**Steps:**
1. Login with active tenant credentials
2. Should be redirected to `/dashboard`
3. Verify navigation sidebar shows:
   - [ ] Dashboard
   - [ ] Mi Suscripción
   - [ ] Sucursales
4. Verify top area shows:
   - [ ] Tenant business name
   - [ ] User email
   - [ ] Plan name badge

**Navigate to Subscription page:**
5. Click "Mi Suscripción"
6. Verify:
   - [ ] Plan name displayed
   - [ ] Plan features listed
   - [ ] Billing dates (fecha_inicio, proximo_cobro) displayed
   - [ ] Monthly price shown

### TC-006: Branch Account Creation

**Precondition:** Active tenant with available branch slots.

**Steps:**
1. Navigate to `/dashboard/sucursales`
2. Click "Agregar sucursal" or create button
3. Fill: Nombre: `Sucursal Norte`, Email: `sucursalnorte+{ts}@test.com`, Password: `Test2026!`
4. Click create

**Expected Results:**
- [ ] Success toast appears
- [ ] New branch appears in list
- [ ] `branch_accounts` table: new record
- [ ] `auth.users` table: new user for branch email
- [ ] `branch_accounts.tenant_id` matches current tenant
- [ ] `branch_accounts.activo = true`

### TC-007: Plan Limit Enforcement

**Precondition:** Básico plan (max 2 branches).

**Steps:**
1. Create 2 branch accounts (max for Básico)
2. Attempt to create a 3rd branch

**Expected Results:**
- [ ] Error message: plan limit reached
- [ ] No branch created
- [ ] `count_branches_for_tenant()` returns 2

### TC-008: Superadmin Dashboard

**Precondition:** User in `superadmins` table.

**Steps:**
1. Login with superadmin email
2. Should be redirected to `/admin`

**Verify KPIs:**
- [ ] Active clients count matches `tenants WHERE estado = 'active'`
- [ ] MRR calculated correctly
- [ ] Payments table shows all records

**Navigate to Clients page:**
3. Click "Clientes"
4. Verify:
   - [ ] All tenants visible (not just own)
   - [ ] Status filter works
   - [ ] Can view tenant details

### TC-009: Session Management

**Steps:**
1. Login successfully
2. Close browser tab
3. Open new tab, navigate to `/dashboard`

**Expected Results:**
- [ ] Session persists (no login required)
- [ ] Tenant data loaded correctly

4. Click "Cerrar sesión"
5. Navigate to `/dashboard`

**Expected Results:**
- [ ] Redirected to `/login`
- [ ] Cannot access `/dashboard` without login
- [ ] `localStorage` Supabase token cleared

### TC-010: Route Protection

**Steps:**
1. Without login, navigate to `/dashboard` → redirect to `/login`
2. Without login, navigate to `/admin` → redirect to `/login`
3. Login as regular tenant, navigate to `/admin` → redirect to `/dashboard`
4. Login as `pending_payment` tenant, navigate to `/dashboard` → redirect to `/pago`

**Expected Results:**
- [ ] All redirects behave correctly
- [ ] No way to bypass auth guards via URL manipulation

---

## 3. RLS Testing — Cross-Tenant Data Isolation

### TC-RLS-01: Tenant A Cannot See Tenant B Payments

**Setup:**
1. Create Tenant A (active, with payments)
2. Create Tenant B (active, with payments)

**Test:**
1. Login as Tenant A owner
2. In browser console, attempt to query Tenant B's payments:
   ```javascript
   const { data } = await supabase
     .from('payments')
     .select('*')
     .eq('tenant_id', 'TENANT_B_UUID')
   console.log(data) // Should be [] (empty array)
   ```

**Expected Results:**
- [ ] `data` is empty array
- [ ] No cross-tenant data leakage

### TC-RLS-02: Branch User Scope

**Setup:**
1. Create branch user for Tenant A, Sucursal 1

**Test:**
1. Login as branch user
2. Attempt to read tenant data directly:
   ```javascript
   const { data } = await supabase.from('tenants').select('*')
   ```
3. Attempt to read subscription data:
   ```javascript
   const { data } = await supabase.from('subscriptions').select('*')
   ```

**Expected Results:**
- [ ] `tenants` query returns empty (branch user is not tenant owner)
- [ ] `subscriptions` query returns empty (branch user not owner/superadmin)
- [ ] Branch user CAN access POS data scoped to their branch

### TC-RLS-03: Unauthenticated Access

**Test:**
1. Sign out completely
2. Attempt via console:
   ```javascript
   const { data, error } = await supabase.from('tenants').select('*')
   ```

**Expected Results:**
- [ ] Error returned (not authenticated)
- [ ] No data returned

### TC-RLS-04: Self-Registration Only Creates Own Tenant

**Test:**
1. Login as User A
2. Attempt to INSERT a tenant with `auth_user_id` of User B:
   ```javascript
   const { error } = await supabase.from('tenants').insert({
     nombre_negocio: 'Hack',
     nit: '000',
     email_propietario: 'hack@test.com',
     telefono: '000',
     auth_user_id: 'USER_B_UUID',  // Different from logged-in user
     plan_id: 'PLAN_UUID'
   })
   ```

**Expected Results:**
- [ ] RLS rejects INSERT — `auth_user_id = auth.uid()` check fails
- [ ] Error returned, no record created

---

## 4. Edge Case Scenarios

### Payment Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User refreshes during payment processing | Payment page reloads; can retry if payment didn't go through |
| Wompi widget fails to load (CSP block) | Error message with instructions to check browser settings |
| Network error during Edge Function call | Retry button appears; user can try again |
| Duplicate webhook event | Idempotency check: `already_processed: true` returned, no duplicate activation |
| Webhook with wrong amount (tampered) | Payment marked as error, amount mismatch logged |
| Webhook with invalid signature | 401 returned, payment not processed |
| Payment source token expired | Error returned, user redirected to re-enter card |

### Auth Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Invalid JWT token (expired) | Redirect to login; Supabase auto-refreshes if possible |
| User logs in from two browsers | Both sessions valid; no session invalidation (no single-session enforcement) |
| Password change while logged in | Next API call fails with 401; auto-redirect to login |
| Email with + alias (`test+spam@test.com`) | Treated as unique email; no collision with `test@test.com` |

### Database Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Tenant deleted while subscription active | CASCADE deletes subscription, events, payments, branch accounts |
| Plan deleted while tenants subscribed | ON DELETE SET NULL; tenants.plan_id becomes null; subscription remains |
| Payment without subscription (manual) | Allowed; `subscription_id` nullable |
| Branch account created for deleted tenant | FK constraint prevents; error returned |
| Concurrent branch creation hitting plan limit | Last transaction fails; `count_branches_for_tenant` enforces limit |

---

## 5. Known Limitations

### v1.0 Limitations

| Limitation | Impact | Mitigation / Workaround | Target Fix |
|-----------|--------|------------------------|------------|
| No automated test suite | Manual testing only, regression risk | Follow manual test cases; prioritize test automation | v1.1 |
| No email verification on signup | Users can register with fake emails | Enable email confirmations in Supabase Auth settings | v1.1 |
| Plan limit enforced client-side only for branches | Could be bypassed via direct API | Add DB trigger/constraint as defense in depth | v1.1 |
| No rate limiting on Edge Functions | Potential for abuse | Configure Supabase rate limits; add API key authentication | v1.1 |
| Wompi recurring payments not automated | Manual renewal processing required | Implement cron-triggered Edge Function | v1.2 |
| No payment retry logic for declined recurring | Subscription goes to past_due immediately | Implement retry schedule (3, 5, 7 days) | v1.2 |
| No invoice/PDF generation | No downloadable receipts for SaaS payments | Send email with payment summary; future: generate PDF | v1.2 |
| No change plan flow | Users cannot switch plans without superadmin intervention | Build plan change UI with prorated calculation | v1.3 |
| No tenant self-cancellation | Users must contact support to cancel | Build cancellation flow with feedback | v1.3 |
| Admin dashboard uses direct queries | KPIs calculated client-side, not cached | Offload to Edge Function with caching | v1.2 |
| No mobile-responsive admin panel | Admin dashboard optimized for desktop only | Add responsive breakpoints | v1.3 |
| Single payment provider (Wompi) | No fallback if Wompi is down | Future: add PSE, Nequi via Wompi; alternative gateway | v2.0 |

---

## 6. Cross-Browser Testing Matrix

| Browser | Version | OS | Status | Notes |
|---------|---------|-----|--------|-------|
| Chrome | 125+ | Windows 11 | Not tested | Primary dev browser |
| Chrome | 125+ | macOS | Not tested | |
| Firefox | 127+ | Windows 11 | Not tested | |
| Firefox | 127+ | macOS | Not tested | |
| Edge | 125+ | Windows 11 | Not tested | Chromium-based, likely same as Chrome |
| Safari | 17+ | macOS | Not tested | Critical for Mac users |
| Safari | iOS 17+ | iPhone | Not tested | Mobile testing needed |
| Chrome | Android 14+ | Android | Not tested | Mobile testing needed |

### Mobile Responsiveness

| Page | Desktop | Tablet | Mobile | Notes |
|------|---------|--------|--------|-------|
| Landing | Not tested | Not tested | Not tested | Tailwind responsive classes used |
| Login | Not tested | Not tested | Not tested | |
| Register | Not tested | Not tested | Not tested | |
| Payment | Not tested | Not tested | Not tested | Wompi widget is mobile-responsive |
| Dashboard | Not tested | Not tested | Not tested | Sidebar collapses to mobile menu |
| Admin | Not tested | Not tested | Not tested | Sidebar collapses to mobile menu |

---

## 7. Future Test Automation Recommendations

### Phase 1: Unit Tests (Week 1–2)

**Target:** Core logic and validators.

```
src/lib/__tests__/
├── utils.test.ts           # formatCurrency, formatDate, classNames, getStatusColor
├── validators.test.ts      # loginSchema, registerSchema, branchSchema
└── store/
    ├── useAuthStore.test.ts # login, logout, initialize, refreshTenant
    └── useUIStore.test.ts   # toasts, sidebar
```

### Phase 2: Component Tests (Week 3–4)

**Target:** User-facing components with interactions.

```
src/components/__tests__/
├── LoginPage.test.tsx       # Form validation, error display, submit
├── RegisterPage.test.tsx    # Multi-step form, plan selection
├── PaymentPage.test.tsx     # Widget mount, edge function call
├── AuthGuard.test.tsx       # Redirect logic
└── DashboardLayout.test.tsx # Navigation, logout
```

### Phase 3: API/Integration Tests (Week 5–6)

**Target:** Edge Functions and RPC calls.

```
supabase/functions/__tests__/
├── create-payment.test.ts   # Payment source creation, transaction, DB insert
├── wompi-webhook.test.ts    # Signature verification, activation, renewal
└── _shared/
    ├── wompi.test.ts        # Signature generation, verification
    └── cors.test.ts         # CORS headers
```

### Phase 4: E2E Tests (Week 7–8)

**Target:** Critical user journeys.

```
e2e/
├── registration.spec.ts     # Full registration flow
├── payment.spec.ts          # Registration + payment + activation
├── dashboard.spec.ts        # Dashboard access, subscription view, branch CRUD
├── admin.spec.ts            # Superadmin login, KPIs, client management
└── auth.spec.ts             # Login, logout, session persistence, route guards
```

### CI Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run src/

  component:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx vitest run src/components/

  e2e:
    runs-on: ubuntu-latest
    needs: [unit, component]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: playwright/test-action@v1
        with:
          config: playwright.config.ts
```

---

*End of QA Report*
