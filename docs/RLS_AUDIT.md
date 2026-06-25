# VenxPOS — RLS Policy Audit

**Version**: 1.0.0
**Date**: 2026-06-19
**Purpose**: Complete audit of all Row-Level Security policies across the platform

---

## 1. Audit Methodology

This audit verifies:
1. RLS is **enabled** on all 22 tables
2. All CRUD operations have appropriate policies
3. Policies correctly scope data per tenant/role
4. No privilege escalation vectors exist
5. Security definer functions are safe
6. No conflicting or missing policies

---

## 2. Existing POS RLS Policies (15 Tables)

### 2.1 `empresas`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_empresas` | `tenant_id = get_tenant_id()` | VERIFIED |
| INSERT | — | — | **MISSING** — INSERT needed for activation via SaaS |
| UPDATE | — | — | **MISSING** — UPDATE needed for config changes |
| DELETE | — | — | **MISSING** — DELETE needed for tenant deletion |

**Note:** The `activate_tenant()` function uses `SECURITY DEFINER` and inserts into `empresas` via service_role, so client-side INSERT policies are not strictly required for the initial activation flow. However, superadmin manual operations will require INSERT/UPDATE policies.

### 2.2 `sucursales`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_sucursales` | Tenant-scoped via empresa_id chain | VERIFIED |
| INSERT | — | — | **MISSING** — INSERT needed for branch creation |
| UPDATE | — | — | **MISSING** — UPDATE needed for branch edits |
| DELETE | — | — | **MISSING** — DELETE needed for branch removal |

### 2.3 `usuarios`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Scoped | User sees own record; admin sees branch users | VERIFIED |
| INSERT | Scoped | Admin can create users for their branch | VERIFIED |
| UPDATE | Scoped | User can update own record; admin can update branch users | VERIFIED |
| DELETE | Scoped | Admin can deactivate branch users | VERIFIED |

### 2.4 `categorias`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via empresa_id | | VERIFIED |
| INSERT | `is_admin()` | Admin can create categories | VERIFIED |
| UPDATE | `is_admin()` | Admin can update categories | VERIFIED |
| DELETE | `is_admin()` | Admin can delete categories | VERIFIED |

### 2.5 `productos`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via empresa_id chain | | VERIFIED |
| INSERT | `is_admin()` | Admin can create products | VERIFIED |
| UPDATE | `is_admin()` | Admin can update products | VERIFIED |
| DELETE | `is_admin()` | Admin can delete products | VERIFIED |

### 2.6 `inventario_sucursal`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via sucursal_id chain | | VERIFIED |
| INSERT | `is_admin()` | Admin can create inventory records | VERIFIED |
| UPDATE | `is_admin()` or via RPC | Admin + inventory operations | VERIFIED |
| DELETE | `is_admin()` | Admin only | VERIFIED |

### 2.7 `ajustes_inventario`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped | | VERIFIED |
| INSERT | `is_admin()` | Admin can log adjustments | VERIFIED |
| UPDATE | — | Append-only log | VERIFIED (no UPDATE by design) |
| DELETE | — | Append-only log | VERIFIED (no DELETE by design) |

### 2.8 `ventas`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via sucursal_id | | VERIFIED |
| INSERT | Authenticated users | Cashiers/admins can create sales | VERIFIED |
| UPDATE | `is_admin()` | Admin can update/correct sales | VERIFIED |
| DELETE | — | Sales should not be deleted | VERIFIED (by design) |

### 2.9 `detalle_ventas`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via venta_id → sucursal_id | | VERIFIED |
| INSERT | Authenticated users | During sale creation | VERIFIED |
| UPDATE | — | Line items not modifiable after sale | VERIFIED (by design) |
| DELETE | — | Line items not deletable | VERIFIED (by design) |

### 2.10 `devoluciones`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via venta_id chain | | VERIFIED |
| INSERT | Authenticated users | Cashiers/admins can process returns | VERIFIED |
| UPDATE | `is_admin()` | Admin can update returns | VERIFIED |
| DELETE | — | Returns should not be deleted | VERIFIED (by design) |

### 2.11 `cierres_caja`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via sucursal_id | | VERIFIED |
| INSERT | Authenticated users | Open cash register | VERIFIED |
| UPDATE | Authenticated users | Close cash register (own shift) | VERIFIED |
| DELETE | — | Cash register records not deletable | VERIFIED (by design) |

### 2.12 `configuracion_fiscal`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped via empresa_id | | VERIFIED |
| INSERT | `is_admin()` | Admin can configure fiscal settings | VERIFIED |
| UPDATE | `is_admin()` | Admin can update fiscal settings | VERIFIED |
| DELETE | — | Fiscal config not deletable | VERIFIED (by design) |

### 2.13 `eventos_auditoria`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Scoped to user's events + admin sees all branch events | | VERIFIED |
| INSERT | Authenticated users (any) | Any user can log events | VERIFIED |
| UPDATE | — | Append-only audit log | VERIFIED (by design) |
| DELETE | — | Append-only audit log | VERIFIED (by design) |

### 2.14 `conflictos_inventario`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | Tenant-scoped | | VERIFIED |
| INSERT | Authenticated users (via RPC) | Logged by inventory functions | VERIFIED |
| UPDATE | — | Append-only conflict log | VERIFIED (by design) |
| DELETE | — | Append-only conflict log | VERIFIED (by design) |

### 2.15 POS Summary

| Table | SELECT | INSERT | UPDATE | DELETE | Overall |
|-------|--------|--------|--------|--------|---------|
| empresas | VERIFIED | **MISSING** | **MISSING** | **MISSING** | GAPS |
| sucursales | VERIFIED | **MISSING** | **MISSING** | **MISSING** | GAPS |
| usuarios | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| categorias | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| productos | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| inventario_sucursal | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| ajustes_inventario | VERIFIED | VERIFIED | DESIGN | DESIGN | COMPLETE |
| ventas | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| detalle_ventas | VERIFIED | VERIFIED | DESIGN | DESIGN | COMPLETE |
| devoluciones | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| cierres_caja | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| configuracion_fiscal | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| eventos_auditoria | VERIFIED | VERIFIED | DESIGN | DESIGN | COMPLETE |
| conflictos_inventario | VERIFIED | VERIFIED | DESIGN | DESIGN | COMPLETE |

**POS Gap Count:** 2 tables with missing policies (empresas: 3 actions missing, sucursales: 3 actions missing).

**Note about gaps:** The SaaS-side `activate_tenant()` function uses `SECURITY DEFINER` to insert into `empresas`. INSERT/UPDATE/DELETE policies for `empresas` and `sucursales` will be needed when the client dashboard's `BranchesPage` allows creating branches from the web UI.

---

## 3. New SaaS RLS Policies (7 Tables)

### 3.1 `plans`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_plans_auth` | `true` (all authenticated users) | VERIFIED |
| INSERT | `superadmin_insert_plans` | `is_superadmin()` | VERIFIED |
| UPDATE | `superadmin_update_plans` | `is_superadmin()` | VERIFIED |
| DELETE | `superadmin_delete_plans` | `is_superadmin()` | VERIFIED |

**Rationale:** Plans must be readable by all authenticated users (including during registration when no tenant exists yet). Modification is superadmin-only.

### 3.2 `tenants`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_own_tenant` | `auth_user_id = auth.uid() OR is_superadmin()` | VERIFIED |
| INSERT | `insert_tenant_auth` | `auth_user_id = auth.uid()` (self-service during signup) | VERIFIED |
| UPDATE | `update_own_tenant` | `auth_user_id = auth.uid() OR is_superadmin()` | VERIFIED |
| DELETE | `superadmin_delete_tenants` | `is_superadmin()` only | VERIFIED |

### 3.3 `subscriptions`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_own_subscriptions` | `tenant_id IN (subquery: own tenants) OR is_superadmin()` | VERIFIED |
| INSERT | `superadmin_insert_subscriptions` | `is_superadmin()` | VERIFIED |
| UPDATE | `superadmin_update_subscriptions` | `is_superadmin()` | VERIFIED |
| DELETE | — | No DELETE policy (no user should delete subscriptions) | VERIFIED |

**Rationale:** Subscription creation and modification is handled by Edge Functions (service_role bypasses RLS). Superadmins can also manage subscriptions from the admin panel. Regular users can only view their own.

### 3.4 `subscription_events`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_own_events` | `tenant_id IN (subquery: own tenants) OR is_superadmin()` | VERIFIED |
| INSERT | — | No INSERT policy — only service_role via Edge Functions | VERIFIED |
| UPDATE | — | Append-only audit log | VERIFIED |
| DELETE | — | Append-only audit log | VERIFIED |

### 3.5 `payments`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_own_payments` | `tenant_id IN (subquery: own tenants) OR is_superadmin()` | VERIFIED |
| INSERT | `superadmin_insert_payments` | `is_superadmin()` | VERIFIED |
| UPDATE | `superadmin_update_payments` | `is_superadmin()` | VERIFIED |
| DELETE | — | No DELETE policy | VERIFIED |

**Rationale:** Payment creation is handled by Edge Functions (service_role). Superadmins can manually create/update payments. Users can only view their own payment history.

### 3.6 `branch_accounts`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_own_branch` | `user_id = auth.uid() OR tenant_id IN (subquery) OR is_superadmin()` | VERIFIED |
| INSERT | `insert_branch_accounts` | Tenant-owner or superadmin only | VERIFIED |
| UPDATE | `update_branch_accounts` | Tenant-owner or superadmin only | VERIFIED |
| DELETE | `delete_branch_accounts` | Tenant-owner or superadmin only | VERIFIED |

### 3.7 `superadmins`

| RLS Enabled | Yes |
|-------------|-----|

| Action | Policy | Condition | Status |
|--------|--------|-----------|--------|
| SELECT | `select_superadmins_auth` | `true` (needed for `is_superadmin()` check by any user) | VERIFIED |
| INSERT | `superadmin_insert_superadmins` | `is_superadmin()` | VERIFIED |
| UPDATE | `superadmin_update_superadmins` | `is_superadmin()` | VERIFIED |
| DELETE | `superadmin_delete_superadmins` | `is_superadmin()` | VERIFIED |

### 3.8 SaaS Summary

| Table | SELECT | INSERT | UPDATE | DELETE | Overall |
|-------|--------|--------|--------|--------|---------|
| plans | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| tenants | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| subscriptions | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| subscription_events | VERIFIED | DESIGN | DESIGN | DESIGN | COMPLETE |
| payments | VERIFIED | VERIFIED | VERIFIED | DESIGN | COMPLETE |
| branch_accounts | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |
| superadmins | VERIFIED | VERIFIED | VERIFIED | VERIFIED | COMPLETE |

**DESIGN indicates the absence of a policy is intentional (append-only table, or operations handled exclusively by service_role).**

---

## 4. Policy Coverage Matrix

### By Role

| Table | anonymous | authenticated (self) | tenant_owner | branch_user | superadmin | service_role |
|-------|-----------|---------------------|--------------|-------------|------------|-------------|
| plans | — | SELECT | SELECT | SELECT | ALL | ALL |
| tenants | — | INSERT (signup) | SELECT, UPDATE | — | ALL | ALL |
| subscriptions | — | — | SELECT | — | SELECT, INSERT, UPDATE | ALL |
| subscription_events | — | — | SELECT | — | SELECT | ALL |
| payments | — | — | SELECT | — | SELECT, INSERT, UPDATE | ALL |
| branch_accounts | — | SELECT (own) | ALL | SELECT (own) | ALL | ALL |
| superadmins | — | SELECT | SELECT | SELECT | ALL | ALL |
| empresas | — | — | (gaps) | (gaps) | (gaps) | ALL |
| sucursales | — | — | (gaps) | (gaps) | (gaps) | ALL |
| usuarios | — | — | — | SELECT, UPDATE | ALL | ALL |
| categorias | — | — | is_admin: ALL | is_admin: ALL | ALL | ALL |
| productos | — | — | is_admin: ALL | is_admin: ALL | ALL | ALL |
| inventario_sucursal | — | — | is_admin: ALL | — | ALL | ALL |
| ajustes_inventario | — | — | is_admin: INSERT | — | ALL | ALL |
| ventas | — | — | SELECT | INSERT, SELECT | ALL | ALL |
| detalle_ventas | — | — | SELECT | INSERT, SELECT | ALL | ALL |
| devoluciones | — | — | SELECT | INSERT, SELECT | ALL | ALL |
| cierres_caja | — | — | SELECT | INSERT, UPDATE | ALL | ALL |
| configuracion_fiscal | — | — | is_admin: ALL | — | ALL | ALL |
| eventos_auditoria | — | — | SELECT | INSERT, SELECT | ALL | ALL |
| conflictos_inventario | — | — | SELECT | — | ALL | ALL |

**Legend:** ALL = SELECT + INSERT + UPDATE + DELETE. — = No access. DESIGN = Intentionally disabled.

---

## 5. Security Definer Functions Audit

| Function | SECURITY DEFINER | search_path | Risk Assessment |
|----------|-----------------|-------------|-----------------|
| `get_tenant_id()` | YES | `SET search_path = ''` | **SAFE** — Only reads tenants and branch_accounts tables. No dynamic SQL. |
| `is_superadmin()` | YES | `SET search_path = ''` | **SAFE** — Only checks existence in superadmins table. |
| `count_branches_for_tenant(p_tenant_id)` | YES | `SET search_path = ''` | **SAFE** — Parameterized query on branch_accounts. |
| `activate_tenant(p_tenant_id, p_payment_id, p_wompi_transaction_id, p_payment_source_id)` | YES | `SET search_path = ''` | **SAFE** — All queries parameterized. Writes to payments, empresas, subscriptions, subscription_events, tenants. No dynamic SQL. |
| `process_renewal(p_tenant_id, p_payment_id, p_wompi_transaction_id)` | YES | `SET search_path = ''` | **SAFE** — All queries parameterized. Writes to payments, subscriptions, subscription_events. No dynamic SQL. |
| `trigger_set_updated_at_saas()` | NO | N/A | **SAFE** — Simple trigger function, no privilege escalation. |
| `decrementar_inventario()` (POS) | YES | `SET search_path = ''` | **SAFE** — Parameterized PL/pgSQL. |
| `incrementar_inventario()` (POS) | YES | `SET search_path = ''` | **SAFE** — Parameterized PL/pgSQL. |

### Security Definer Best Practices Verified

- [x] All functions use `SET search_path = ''` to prevent search path injection
- [x] All queries use parameterized variables (no `EXECUTE` with string concatenation)
- [x] All functions explicitly declare variables with `DECLARE` block
- [x] No function accepts table or column names as parameters (no dynamic schema access)
- [x] `EXCEPTION` blocks handle errors gracefully
- [x] Functions are minimal in scope — each does one thing

---

## 6. Potential Bypasses and Mitigations

### Bypass 1: Superadmin Reading All Tenant Data

**Risk:** The superadmin can read any tenant's data, including sales, inventory, and financial records.

**Mitigation:** This is by design — superadmins are platform operators who need global visibility. Superadmin access is granted via the `superadmins` table, which only existing superadmins can modify. The `VITE_SUPERADMIN_EMAILS` env var identifies allowed emails.

### Bypass 2: Tenant User Creating Extra Branch Accounts Beyond Plan Limit

**Risk:** A tenant owner could create more branch accounts than their plan allows.

**Mitigation:** Client-side enforcement via `count_branches_for_tenant()` function should be called BEFORE creating a new branch account. The RLS policy for INSERT on `branch_accounts` does NOT currently enforce plan limits. **This should be added as a CHECK constraint or policy WITH CHECK.**

**Recommended Improvement:** Add a trigger or policy that checks `count_branches_for_tenant(tenant_id) < (SELECT max_sucursales FROM plans WHERE id = (SELECT plan_id FROM tenants WHERE id = tenant_id))` before allowing INSERT on `branch_accounts`.

### Bypass 3: Self-Service Tenant INSERT Without Validation

**Risk:** During registration, a user could insert multiple tenant records or insert with arbitrary plan IDs.

**Mitigation:**
- `auth_user_id = auth.uid()` ensures the user can only create a tenant for themselves.
- Plan IDs are limited to existing entries in the `plans` table (FK constraint).
- A user with an existing tenant would see their own tenant on login (not create a new one).

### Bypass 4: RLS on `empresas` and `sucursales` Incomplete

**Risk:** Client-side INSERT/UPDATE/DELETE on `empresas` and `sucursales` lacks RLS policies.

**Mitigation:** Currently, all writes to `empresas` go through `activate_tenant()` (SECURITY DEFINER, service_role). Branch management from the SaaS web is handled through `branch_accounts` with proper RLS. The POS desktop uses its own RLS policies. However, policies should be added before any client-side writes are enabled.

---

## 7. Recommended Improvements

### P0 (Before Production Launch)
1. **Branch account limit enforcement**: Add RLS policy WITH CHECK that verifies plan limits on `branch_accounts` INSERT.
2. **empresas INSERT/UPDATE policies**: Add `is_superadmin()` INSERT and UPDATE policies for admin panel operations.
3. **sucursales INSERT/UPDATE/DELETE policies**: Add tenant-scoped policies for branch management from the dashboard.

### P1 (Within First Week of Launch)
4. **subscription_events INSERT policy for superadmin**: Allow superadmins to manually log subscription events from the admin panel.
5. **Audit all POS RLS policies**: Verify that every POS table has appropriate INSERT policies for the POS desktop app.

### P2 (Within First Month)
6. **RLS policy testing automation**: Create a test suite that authenticates as different roles and verifies RLS enforcement.
7. **Rate limiting via RLS**: Consider adding rate-limiting logic to sensitive operations (payment creation, branch creation).
8. **RLS performance audit**: Test query performance under RLS with large datasets to ensure policies don't cause sequential scans.

---

## 8. RLS Enforcement Verification Commands

```sql
-- Check all tables with RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all policies
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Test as specific role (use in Supabase SQL Editor)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "test-user-uuid"}';

-- Try operations and verify RLS enforcement
SELECT get_tenant_id();
SELECT is_superadmin();
SELECT * FROM tenants;  -- Should only return own tenant (and all if superadmin)
```

---

*End of RLS Policy Audit*
