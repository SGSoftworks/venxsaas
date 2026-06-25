# VenxPOS — Database Documentation

**Version**: 1.0.0
**Date**: 2026-06-19
**Database**: PostgreSQL 17 (Supabase)
**Schema**: `public`

---

## 1. Entity-Relationship Overview

The VenxPOS database comprises **22 tables** split across two domains:

- **SaaS Domain** (7 new tables): Manages multi-tenancy, subscriptions, payments, and branch accounts.
- **POS Domain** (15 existing tables): Manages companies, branches, users, products, inventory, sales, cash registers, and audit logs.

All 22 tables share a single PostgreSQL schema (`public`) with Row-Level Security (RLS) isolating data per tenant.

---

## 2. Complete Table Catalog

### SaaS Domain (7 tables)

| # | Table | Purpose | Key Columns |
|---|-------|---------|-------------|
| 1 | `plans` | Subscription plan catalog | `id`, `nombre`, `max_sucursales`, `max_administradores`, `precio_inicial`, `precio_mensual`, `features` (JSONB), `activo`, `destacado` |
| 2 | `tenants` | Multi-tenant business accounts | `id`, `nombre_negocio`, `nit`, `email_propietario`, `telefono`, `estado` (CHECK: pending_payment/active/suspended/cancelled), `auth_user_id` (FK→auth.users), `plan_id` (FK→plans) |
| 3 | `subscriptions` | Active plan subscriptions | `id`, `tenant_id` (FK→tenants), `plan_id` (FK→plans), `estado` (CHECK: pending/active/past_due/cancelled/expired), `fecha_inicio`, `fecha_renovacion`, `proximo_cobro`, `payment_source_id` |
| 4 | `subscription_events` | Audit log for subscription lifecycle | `id`, `subscription_id` (FK→subscriptions), `tenant_id` (FK→tenants), `tipo` (CHECK: created/activated/renewed/cancelled/expired/plan_changed/suspended/reactivated/payment_failed), `metadata` (JSONB) |
| 5 | `payments` | Payment transaction records | `id`, `tenant_id` (FK→tenants), `subscription_id` (FK→subscriptions), `wompi_transaction_id`, `wompi_reference` (UNIQUE), `amount`, `currency`, `status` (CHECK: pending/approved/declined/voided/error), `payment_method_type`, `tipo` (CHECK: initial/recurring/manual/retry), `metadata` (JSONB) |
| 6 | `branch_accounts` | Maps branch users to their tenant | `id`, `tenant_id` (FK→tenants), `sucursal_id` (FK→sucursales), `user_id` (FK→auth.users), `nombre_sucursal`, `email`, `activo` |
| 7 | `superadmins` | Platform-level administrators | `id`, `user_id` (FK→auth.users, UNIQUE), `nombre` |

### POS Domain (15 existing tables)

| # | Table | Purpose | Key Columns |
|---|-------|---------|-------------|
| 8 | `empresas` | Business entities (linked to tenants) | `id`, `tenant_id` (FK→tenants, NULLABLE), `nombre`, `nit`, `email`, `telefono` |
| 9 | `sucursales` | Branch offices | `id`, `empresa_id` (FK→empresas), `nombre`, `direccion`, `telefono` |
| 10 | `usuarios` | POS user accounts | `id`, `user_id` (FK→auth.users), `sucursal_id` (FK→sucursales), `nombre`, `rol` (cajero/admin), `pin_acceso`, `estado` (activo/inactivo/suspendido) |
| 11 | `categorias` | Product categories | `id`, `empresa_id` (FK→empresas), `nombre` |
| 12 | `productos` | Product catalog | `id`, `empresa_id` (FK→empresas), `categoria_id` (FK→categorias), `nombre`, `codigo_barras`, `precio_venta`, `activo` |
| 13 | `inventario_sucursal` | Per-branch stock levels | `id`, `producto_id` (FK→productos), `sucursal_id` (FK→sucursales), `cantidad`, `stock_minimo` |
| 14 | `ajustes_inventario` | Inventory adjustment log | `id`, `producto_id` (FK→productos), `usuario_id`, `tipo` (entrada/salida), `cantidad`, `motivo` |
| 15 | `ventas` | Sales transactions | `id`, `sucursal_id`, `usuario_id`, `total`, `metodo_pago`, `estado` |
| 16 | `detalle_ventas` | Sales line items | `id`, `venta_id` (FK→ventas), `producto_id` (FK→productos), `cantidad`, `precio_unitario` |
| 17 | `devoluciones` | Product returns | `id`, `venta_id` (FK→ventas), `motivo`, `monto` |
| 18 | `cierres_caja` | Cash register closure records | `id`, `sucursal_id`, `usuario_id`, `monto_inicial`, `monto_final`, `diferencia` |
| 19 | `configuracion_fiscal` | Tax and invoice configuration | `id`, `empresa_id` (FK→empresas), `resolucion_dian`, `fecha_vencimiento` |
| 20 | `eventos_auditoria` | Security audit log | `id`, `usuario_id`, `tipo`, `descripcion`, `metadata` (JSONB) |
| 21 | `conflictos_inventario` | Inventory conflict tracking | `id`, `producto_id`, `cantidad_disponible`, `cantidad_intentada` |
| 22 | `auth.users` | Supabase-managed auth identities | `id`, `email`, `encrypted_password`, `confirmed_at`, `last_sign_in_at` |

---

## 3. Entity-Relationship Diagram (Text/ASCII)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          SAAS DOMAIN                                      │
│                                                                          │
│  ┌──────────┐       ┌──────────┐       ┌───────────────┐                │
│  │  plans   │◄──────│ tenants  │──────►│ subscriptions │                │
│  │          │  fk   │          │  fk   │               │                │
│  │ nombre   │       │ nombre_n │       │ estado        │                │
│  │ precio   │       │ nit      │       │ fecha_inicio  │                │
│  │ features │       │ email_pr │       │ proximo_cobro │                │
│  └──────────┘       │ estado   │       │ payment_src   │                │
│                     │ auth_uid │       └───────┬───────┘                │
│                     └────┬─────┘               │                        │
│                          │                     │                        │
│                          │ fk           ┌──────▼───────┐                │
│                          │              │ subscription │                │
│                          │              │   _events    │                │
│                          │              │              │                │
│                          │              │ tipo         │                │
│                          │              │ metadata     │                │
│                          │              └──────────────┘                │
│                          │                                              │
│                          │ fk    ┌──────────┐      ┌──────────┐        │
│                          ├──────►│ payments │      │ super    │        │
│                          │       │          │      │ admins   │        │
│                          │       │ amount   │      │          │        │
│                          │       │ status   │      │ user_id  │        │
│                          │       │ wompi_id │      │ nombre   │        │
│                          │       └──────────┘      └──────────┘        │
│                          │                                              │
│                          │ fk    ┌─────────────────┐                    │
│                          ├──────►│ branch_accounts │                    │
│                          │       │                 │                    │
│                          │       │ tenant_id (fk)  │                    │
│                          │       │ sucursal_id(fk) │                    │
│                          │       │ user_id (fk)    │                    │
│                          │       └────────┬────────┘                    │
│                          │                │                             │
├──────────────────────────┼────────────────┼─────────────────────────────┤
│                          │ POS DOMAIN     │                             │
│                          │                │                             │
│                          │       ┌────────▼───────┐                     │
│                          ├──────►│   empresas      │                     │
│                          │ fk    │                 │                     │
│                          │       │ tenant_id (fk)  │                     │
│                          │       │ nombre          │                     │
│                          │       │ nit             │                     │
│                          │       └────────┬────────┘                     │
│                          │                │                             │
│                          │       ┌────────▼────────┐                    │
│                          │       │   sucursales     │                    │
│                          │       │                  │                    │
│                          │       │ empresa_id (fk)  │                    │
│                          │       │ nombre           │◄──┐               │
│                          │       └────────┬─────────┘   │               │
│                          │                │              │               │
│                          │    ┌───────────┼──────────┐   │               │
│                          │    │           │          │   │               │
│                          │    ▼           ▼          ▼   │               │
│                          │ ┌──────┐ ┌────────┐ ┌──────────┐            │
│                          │ │ usr  │ │invent  │ │ cierres  │            │
│                          │ │arios │ │_sucurs │ │  _caja   │            │
│                          │ └──────┘ └───┬────┘ └──────────┘            │
│                          │              │                              │
│                          │       ┌──────▼──────┐    ┌─────────┐        │
│                          │       │  productos  │    │categor  │        │
│                          │       │             │    │  ias    │        │
│                          │       │ nombre      │◄───│         │        │
│                          │       │ precio      │    └─────────┘        │
│                          │       └──────┬──────┘                       │
│                          │              │                              │
│                          │       ┌──────▼──────────┐                   │
│                          │       │ detalle_ventas  │                   │
│                          │       │                 │                   │
│                          │       │ venta_id (fk)   │                   │
│                          │       │ producto_id (fk)│                   │
│                          │       └────────┬────────┘                   │
│                          │                │                            │
│                          │       ┌────────▼───────┐                    │
│                          │       │    ventas       │                    │
│                          │       │                 │                    │
│                          │       │ sucursal_id(fk) │                    │
│                          │       │ total           │                    │
│                          │       └────────┬────────┘                    │
│                          │                │                            │
│                          │       ┌────────▼──────────┐                 │
│                          │       │   devoluciones    │                 │
│                          │       │                   │                 │
│                          │       │ venta_id (fk)     │                 │
│                          │       │ motivo            │                 │
│                          │       └───────────────────┘                 │
│                          │                                             │
│                          │  ┌──────────────────┐  ┌────────────────┐   │
│                          │  │ eventos_auditoria│  │ conflictos     │   │
│                          │  │                  │  │  _inventario   │   │
│                          │  │ usuario_id       │  │                │   │
│                          │  │ tipo             │  │ producto_id    │   │
│                          │  └──────────────────┘  └────────────────┘   │
│                          │                                             │
│                          │  ┌──────────────────────┐                   │
│                          │  │ configuracion_fiscal │                   │
│                          │  │                      │                   │
│                          │  │ empresa_id (fk)      │                   │
│                          │  │ resolucion_dian      │                   │
│                          │  └──────────────────────┘                   │
│                          │                                             │
└──────────────────────────────────────────────────────────────────────────┘

KEY:
  ───►  Foreign key relationship
  ◄──   Referenced by
```

---

## 4. Seven New SaaS Tables — Full Column Descriptions

### 4.1 `plans` — Subscription Plan Catalog

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique plan identifier |
| `nombre` | TEXT | NOT NULL, UNIQUE | Plan display name (Básico, Estándar, Pro, Empresarial) |
| `max_sucursales` | INTEGER | NOT NULL | Maximum branch count for this plan |
| `max_administradores` | INTEGER | NOT NULL | Maximum admin user count |
| `precio_inicial` | DECIMAL(12,2) | NOT NULL | One-time setup fee (COP) |
| `precio_mensual` | DECIMAL(12,2) | NOT NULL | Recurring monthly fee (COP) |
| `features` | JSONB | DEFAULT '[]' | Array of feature strings for display |
| `activo` | BOOLEAN | DEFAULT true | Whether this plan is available for new signups |
| `destacado` | BOOLEAN | DEFAULT false | Whether this plan is highlighted on the pricing page |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

### 4.2 `tenants` — Multi-Tenant Business Accounts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique tenant identifier |
| `nombre_negocio` | TEXT | NOT NULL | Display name of the business |
| `nit` | TEXT | NOT NULL | Colombian tax ID (NIT) |
| `email_propietario` | TEXT | NOT NULL, UNIQUE | Owner's email (unique across platform) |
| `telefono` | TEXT | NOT NULL | Contact phone number |
| `estado` | TEXT | NOT NULL, DEFAULT 'pending_payment', CHECK | Account status: pending_payment, active, suspended, cancelled |
| `auth_user_id` | UUID | FK→auth.users, ON DELETE SET NULL | Links to Supabase auth identity |
| `plan_id` | UUID | FK→plans, ON DELETE SET NULL | Selected subscription plan |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp (auto-updated via trigger) |

### 4.3 `subscriptions` — Active Plan Subscriptions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique subscription identifier |
| `tenant_id` | UUID | NOT NULL, FK→tenants, ON DELETE CASCADE | Owning tenant |
| `plan_id` | UUID | NOT NULL, FK→plans | Subscribed plan |
| `estado` | TEXT | NOT NULL, DEFAULT 'pending', CHECK | Subscription state: pending, active, past_due, cancelled, expired |
| `fecha_inicio` | DATE | NULLABLE | Subscription start date |
| `fecha_renovacion` | DATE | NULLABLE | Last renewal date |
| `proximo_cobro` | DATE | NULLABLE | Next billing date |
| `payment_source_id` | TEXT | NULLABLE | Wompi payment source ID for recurring charges |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp (auto-updated via trigger) |

### 4.4 `subscription_events` — Subscription Audit Log

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique event identifier |
| `subscription_id` | UUID | NOT NULL, FK→subscriptions, ON DELETE CASCADE | Related subscription |
| `tenant_id` | UUID | NOT NULL, FK→tenants, ON DELETE CASCADE | Owning tenant (denormalized for efficient queries) |
| `tipo` | TEXT | NOT NULL, CHECK | Event type: created, activated, renewed, cancelled, expired, plan_changed, suspended, reactivated, payment_failed |
| `metadata` | JSONB | DEFAULT '{}' | Event-specific data (plan_id, payment_id, wompi IDs, timestamps) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event timestamp |

### 4.5 `payments` — Payment Transaction Records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique payment identifier |
| `tenant_id` | UUID | NOT NULL, FK→tenants, ON DELETE CASCADE | Paying tenant |
| `subscription_id` | UUID | FK→subscriptions, ON DELETE SET NULL | Related subscription (nullable for manual payments) |
| `wompi_transaction_id` | TEXT | NULLABLE | Wompi transaction identifier |
| `wompi_reference` | TEXT | UNIQUE | Unique reference string (VENX-{tenant_prefix}-{timestamp}) |
| `amount` | DECIMAL(12,2) | NOT NULL | Payment amount in COP |
| `currency` | TEXT | DEFAULT 'COP' | ISO 4217 currency code |
| `status` | TEXT | NOT NULL, DEFAULT 'pending', CHECK | Payment status: pending, approved, declined, voided, error |
| `payment_method_type` | TEXT | NULLABLE | Payment method (CARD, PSE, etc.) |
| `tipo` | TEXT | NOT NULL, DEFAULT 'initial', CHECK | Payment type: initial, recurring, manual, retry |
| `metadata` | JSONB | DEFAULT '{}' | Additional data (payment_source_id, error details) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification timestamp (auto-updated via trigger) |

### 4.6 `branch_accounts` — Branch User Mappings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique branch account identifier |
| `tenant_id` | UUID | NOT NULL, FK→tenants, ON DELETE CASCADE | Owning tenant |
| `sucursal_id` | UUID | FK→sucursales, ON DELETE SET NULL | Linked branch (set after branch creation) |
| `user_id` | UUID | FK→auth.users, ON DELETE CASCADE | Linked auth user |
| `nombre_sucursal` | TEXT | NOT NULL | Branch display name |
| `email` | TEXT | NOT NULL | Branch contact email |
| `activo` | BOOLEAN | DEFAULT true | Whether this branch account is active |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

### 4.7 `superadmins` — Platform Administrators

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Unique superadmin record identifier |
| `user_id` | UUID | NOT NULL, FK→auth.users, ON DELETE CASCADE, UNIQUE | Linked auth user |
| `nombre` | TEXT | NULLABLE | Display name (optional) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

---

## 5. RLS Strategy Overview

Row-Level Security is enabled on **all 22 tables**. The strategy follows three access tiers:

### Tier 1: Service Role (Backend)
- Supabase `service_role` key bypasses all RLS policies.
- Used exclusively in Edge Functions for webhook processing, payment creation, and admin operations.
- Never exposed to frontend code.

### Tier 2: Superadmin (Platform)
- Identified via the `is_superadmin()` function (checks `superadmins` table).
- Has read access to all tenant data (tenants, subscriptions, payments, branches).
- Has write access to plans and superadmins tables.
- Can insert/update payments and subscriptions from the admin panel.

### Tier 3: Tenant Owners (Customers)
- Identified via `auth.uid()` matching `tenants.auth_user_id`.
- Full CRUD on their own tenant record.
- Read access to their own subscriptions, payments, subscription_events.
- Read/write access to their own branch_accounts.
- Access to POS data scoped via `get_tenant_id()` function.

### Tier 4: Branch Users (Staff)
- Identified via `branch_accounts` table mapping auth user to tenant.
- Read/write access to POS data scoped to their tenant via `get_tenant_id()`.
- Cannot access SaaS tables directly (tenants, subscriptions, payments).
- Can read their own `branch_accounts` record.

### Public Access
- `plans` table: read access for all authenticated users (needed during registration before tenant exists).
- `superadmins` table: read access for all authenticated users (needed for `is_superadmin()` check).

---

## 6. Security Definer Functions

### 6.1 `get_tenant_id()` → UUID
Returns the tenant UUID for the authenticated user. Checks `tenants` (owners) first, then `branch_accounts` (staff). Used by POS RLS policies.

### 6.2 `is_superadmin()` → BOOLEAN
Returns true if the authenticated user exists in the `superadmins` table.

### 6.3 `count_branches_for_tenant(p_tenant_id UUID)` → INTEGER
Returns the count of active branch accounts for a tenant. Used to enforce plan limits.

### 6.4 `activate_tenant(p_tenant_id, p_payment_id, p_wompi_transaction_id, p_payment_source_id)` → VOID
Full activation transaction: marks payment approved, creates empresa, creates subscription, logs event, sets tenant to active.

### 6.5 `process_renewal(p_tenant_id, p_payment_id, p_wompi_transaction_id)` → VOID
Processes monthly renewal: marks payment approved, advances billing dates, logs renewal event.

All functions use `SECURITY DEFINER` with `SET search_path = ''` to prevent search path injection.

---

## 7. Indexes

| Table | Indexes |
|-------|---------|
| `tenants` | `auth_user_id`, `plan_id`, `estado` |
| `subscriptions` | `tenant_id`, `plan_id`, `estado`, `proximo_cobro` |
| `subscription_events` | `subscription_id`, `tenant_id`, `created_at DESC` |
| `payments` | `tenant_id`, `subscription_id`, `wompi_transaction_id`, `status`, `created_at DESC` |
| `branch_accounts` | `tenant_id`, `sucursal_id`, `user_id` |
| `superadmins` | `user_id` |
| `empresas` | `tenant_id` |
| POS tables | Existing indexes (productos, ventas, inventario_sucursal, etc.) |

---

## 8. Migration Procedure

### Apply Migration

```bash
# Local development
supabase db reset

# Remote (production)
supabase link --project-ref <project-id>
supabase db push
```

### Migration File

Location: `supabase/migrations/20260619_saas_core.sql`

What it does:
1. Creates 7 new SaaS tables
2. Adds `tenant_id` column to `empresas` (safe, `IF NOT EXISTS`)
3. Creates 5 `SECURITY DEFINER` functions
4. Creates auto-update triggers on `tenants`, `subscriptions`, `payments`
5. Enables RLS on all 7 tables with full policy sets
6. Creates 22 performance indexes
7. Seeds 4 subscription plan records

### Rollback (if needed)

```sql
-- Drop SaaS tables (order matters due to FK constraints)
DROP TABLE IF EXISTS subscription_events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS branch_accounts CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS superadmins CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Remove tenant_id from empresas
ALTER TABLE empresas DROP COLUMN IF EXISTS tenant_id;

-- Drop functions
DROP FUNCTION IF EXISTS get_tenant_id();
DROP FUNCTION IF EXISTS is_superadmin();
DROP FUNCTION IF EXISTS count_branches_for_tenant(UUID);
DROP FUNCTION IF EXISTS activate_tenant(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS process_renewal(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS trigger_set_updated_at_saas();
```

---

## 9. Seed Data

Four subscription plans are seeded on migration:

| Plan | Branches | Admins | Init Fee | Monthly | Features |
|------|----------|--------|----------|---------|----------|
| Básico | 2 | 2 | $150,000 COP | $80,000 COP | 2 branches, reports, inventory, basic support |
| Estándar | 5 | 5 | $250,000 COP | $150,000 COP | 5 branches, advanced reports, multi-branch inventory, priority support |
| Pro | 10 | 10 | $400,000 COP | $250,000 COP | 10 branches, custom reports, API access, 24/7 support |
| Empresarial | Unlimited | Unlimited | Custom | Custom | All features, dedicated account manager, SLA guarantee |

The `Empresarial` plan has `precio_inicial = 0` and `precio_mensual = 0` as placeholders for negotiated enterprise pricing.

---

## 10. Important Notes

1. **No migration modifies existing POS data.** The only addition to existing tables is `empresas.tenant_id` (nullable, safe).
2. **All SaaS tables use UUID primary keys** generated via `gen_random_uuid()`.
3. **JSONB columns** (`features`, `metadata`) use PostgreSQL's binary JSON format for efficient querying.
4. **CHECK constraints** enforce valid states on `tenants.estado`, `subscriptions.estado`, `payments.status`, `payments.tipo`, and `subscription_events.tipo`.
5. **ON DELETE CASCADE** propagates from `tenants` to `subscriptions`, `subscription_events`, `payments`, and `branch_accounts`.
6. **`subscription_events`** is append-only — no UPDATE or DELETE policies for authenticated users (only `service_role` via Edge Functions can insert).
7. **`payments.wompi_reference`** has a UNIQUE constraint to prevent duplicate processing.

---

*End of Database Documentation*
