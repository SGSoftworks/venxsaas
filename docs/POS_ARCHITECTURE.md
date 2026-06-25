# VenxPOS — POS Desktop Architecture Reference

**Version**: 1.0.0
**Date**: 2026-06-19
**Stack**: React 19, TypeScript, Vite, Tauri v2, Zustand 5, Supabase

---

## 1. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19 | UI components and state |
| **Language** | TypeScript | 6.0 | Type-safe development |
| **Bundler** | Vite | 8 | Development server and build |
| **Desktop Shell** | Tauri | v2 | Native desktop wrapper (Rust backend + WebView2) |
| **Routing** | react-router-dom | 7 | Client-side routing |
| **State** | Zustand | 5 | Global state management |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS |
| **Auth** | Supabase Auth | 2.x | JWT-based authentication |
| **Database** | Supabase PostgreSQL | 17 | Shared database with SaaS |
| **API** | PostgREST | — | Direct database queries with RLS |
| **Icons** | lucide-react | — | Icon library |

---

## 2. Component Overview

The POS desktop app shares the React codebase with the SaaS web app but is compiled as a Tauri desktop application. The following components are POS-specific:

### Core Layouts

| Component | Path | Description |
|-----------|------|-------------|
| `POSLayout` | `src/components/pos/POSLayout.tsx` | Main POS interface shell: header bar, sidebar navigation, content area |
| `Login` | `src/components/auth/Login.tsx` | POS-specific login with email/password |

### POS Features

| Component | Path | Description |
|-----------|------|-------------|
| `Dashboard` | `src/components/pos/Dashboard.tsx` | Home screen with quick stats, recent sales, cash register status |
| `Inventory` | `src/components/inventory/Inventory.tsx` | Product catalog browser, search, category filter, stock levels |
| `Reports` | `src/components/reports/Reports.tsx` | Sales reports, shift reports, product performance |
| `Sales` | `src/components/sales/Sales.tsx` | Active sales terminal: product lookup, cart, payment processing |
| `CashRegister` | `src/components/cash/CashRegister.tsx` | Cash register open/close, arqueo (cash count), discrepancy resolution |
| `AdminOverrideModal` | `src/components/AdminOverrideModal.tsx` | PIN-based admin authorization for sensitive operations |
| `Config` | `src/components/config/Config.tsx` | Tax configuration, fiscal settings, branch info |

### Payment Components

| Component | Path | Description |
|-----------|------|-------------|
| `PaymentModal` | `src/components/payment/PaymentModal.tsx` | Cash and card payment processing |
| `CashPayment` | `src/components/payment/CashPayment.tsx` | Cash handling: received amount, change calculation |

### Shared Components

| Component | Path | Description |
|-----------|------|-------------|
| `ErrorBoundary` | `src/components/ErrorBoundary.tsx` | React error boundary wrapping routes |
| `Loading` | Various | Loading spinners and skeletons |

---

## 3. Authentication Flow

### POS Login

```
User opens Tauri app
         │
         ▼
  ┌─────────────┐
  │ Login screen │    user enters email + password
  │ (Login.tsx)  │──────────────────────────┐
  └─────────────┘                          │
         │                                  │
         ▼                                  ▼
  supabase.auth.signInWithPassword()   ┌────────────────────┐
         │                             │ auth.users (Supabase)│
         │                             │ - email verification │
         ▼                             │ - password hashing   │
  ┌─────────────────────┐             │ - JWT issuance        │
  │ JWT returned         │             └────────────────────┘
  │ session.access_token │
  │ session.refresh_token│
  └──────────┬──────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ Query usuarios table        │
  │ WHERE user_id = auth.uid()  │
  │ (RLS scoped — user sees     │
  │  only their own record)     │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ Check usuarios.rol          │
  │ - 'cajero' → POS terminal   │
  │ - 'admin' → POS + admin     │
  │                             │
  │ Check usuarios.estado       │
  │ - 'activo' → proceed        │
  │ - 'inactivo' → blocked      │
  │ - 'suspendido' → blocked    │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ Load branch data            │
  │ sucursales WHERE id =       │
  │   usuarios.sucursal_id      │
  │                             │
  │ Load empresa data           │
  │ empresas WHERE id =         │
  │   sucursales.empresa_id     │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │ PIN verification (optional) │
  │ AdminOverrideModal.tsx      │
  │ - Prompt for PIN            │
  │ - Compare with usuarios.    │
  │   pin_acceso (plaintext!)   │
  │ - Log to eventos_auditoria  │
  └─────────────────────────────┘
```

### JWT Storage

- **Tauri Desktop**: JWT stored in `localStorage` (WebView2 context).
- **Session Persistence**: `persistSession: true` in Supabase client config.
- **Token Refresh**: Automatic via Supabase client (`autoRefreshToken: true`).
- **Security Note**: In Tauri's WebView2, localStorage is isolated to the app. However, exposing JWT to the WebView JS context is a risk if XSS is possible. Future versions should use Tauri's encrypted storage via the Rust backend.

---

## 4. Database Usage (POS Tables)

### Tables Read by POS

| Table | Read Operation | Purpose |
|-------|---------------|---------|
| `empresas` | SELECT | Load company name, NIT, configuration |
| `sucursales` | SELECT | Load branch name, address, phone |
| `usuarios` | SELECT, UPDATE | Load user profile, role, PIN; update estado |
| `categorias` | SELECT | Product category hierarchy |
| `productos` | SELECT | Product catalog browsing and sales lookup |
| `inventario_sucursal` | SELECT | Per-branch stock levels |
| `ventas` | SELECT | Sales history, reports |
| `detalle_ventas` | SELECT | Sales line item details |
| `devoluciones` | SELECT | Return history |
| `cierres_caja` | SELECT | Cash register history |
| `configuracion_fiscal` | SELECT | Tax/Dian configuration |
| `eventos_auditoria` | SELECT | Audit log review (admin only) |
| `conflictos_inventario` | SELECT | Inventory conflict history |

### Tables Written by POS

| Table | Write Operation | Purpose |
|-------|----------------|---------|
| `ventas` | INSERT | Record new sale |
| `detalle_ventas` | INSERT | Record sale line items |
| `devoluciones` | INSERT | Record product returns |
| `cierres_caja` | INSERT, UPDATE | Open/close cash register |
| `inventario_sucursal` | UPDATE | Decrement stock on sale (via RPC `decrementar_inventario`) |
| `inventario_sucursal` | UPDATE | Increment stock on return (via RPC `incrementar_inventario`) |
| `ajustes_inventario` | INSERT | Log inventory adjustments |
| `usuarios` | UPDATE | Update user profile, PIN |
| `conflictos_inventario` | INSERT | Log inventory conflict when stock insufficient |
| `eventos_auditoria` | INSERT | Log admin overrides, inventory adjustments, etc. |

### Tables NOT Accessed by POS

| Table | Reason |
|-------|--------|
| `plans` | SaaS-only pricing table |
| `tenants` | SaaS-only tenant management |
| `subscriptions` | SaaS-only subscription tracking |
| `subscription_events` | SaaS-only subscription audit |
| `payments` | SaaS-only payment records |
| `branch_accounts` | SaaS-only branch user mapping |
| `superadmins` | SaaS-only platform admin |

---

## 5. Data Isolation Between Tenants

### How RLS Enforces Isolation

Each POS table uses RLS policies that scope data to the user's tenant via the `get_tenant_id()` function:

```sql
-- Example: productos table RLS policy
CREATE POLICY "tenant_productos_select" ON productos
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT id FROM empresas
      WHERE tenant_id = get_tenant_id()
    )
  );
```

### Tenant Resolution Chain

```
auth.uid()
   │
   ▼
get_tenant_id()
   ├── tenants.auth_user_id = auth.uid() → tenant.id
   └── branch_accounts.user_id = auth.uid() → branch_accounts.tenant_id
       │
       ▼
   tenant.id
       │
       ▼
   empresas WHERE tenant_id = tenant.id → empresa.id
       │
       ▼
   sucursales WHERE empresa_id = empresa.id
       │
       ▼
   productos/inventario/ventas/cierres_caja/etc.
   WHERE sucursal_id IN (SELECT id FROM sucursales WHERE empresa_id = ...)
```

### Cross-Tenant Isolation Verification

**Test scenario:** Tenant A user queries Tenant B data.
1. Authenticate as `cajero@sucursal-A.com`
2. Attempt query: `SELECT * FROM ventas WHERE sucursal_id = '<sucursal-B-id>'`
3. **Expected result:** Empty set (0 rows) — RLS policy filters out all non-Tenant-A ventas.
4. **Expected:** 403/empty for any cross-tenant query.

---

## 6. Desktop Deployment (Tauri v2)

### Build Targets

| Platform | Target | Installer |
|----------|--------|-----------|
| Windows | `x86_64-pc-windows-msvc` | `.msi` (MSI installer) |
| Windows | `x86_64-pc-windows-msvc` | `.exe` (NSIS installer) |
| macOS | `aarch64-apple-darwin` | `.dmg` |
| Linux | `x86_64-unknown-linux-gnu` | `.AppImage` / `.deb` |

### Tauri Configuration

```jsonc
// src-tauri/tauri.conf.json (key settings)
{
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "VenxPOS",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.wompi.co"
    }
  },
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  }
}
```

### Tauri Rust Backend

The Rust backend provides:
- Window management (native title bar, minimize/maximize/close)
- System tray (optional)
- Auto-updater (check for updates on launch)
- File system access (for local data export/cache)
- Encrypted local storage (for session persistence, future)
- Printer integration (native print dialog for receipts)

### Tauri Security

- **CSP**: Enforced via `tauri.conf.json` — restricts script sources and network connections.
- **WebView Isolation**: Tauri's WebView2 runs in a sandboxed context.
- **No Node.js**: The Tauri app has no Node.js runtime — only Rust + WebView JS.
- **IPC**: Communication between frontend and Rust backend uses Tauri's `invoke()` API with command whitelisting.

---

## 7. Key Differences: POS Desktop vs SaaS Web

| Aspect | POS Desktop | SaaS Web |
|--------|------------|----------|
| **Deployment** | Windows/macOS/Linux installer | Vercel CDN (URL) |
| **Auth storage** | localStorage (WebView2) | localStorage (browser) |
| **CSP** | Tauri config | Vercel headers |
| **Offline support** | Planned (Tauri local SQLite) | None (always-online) |
| **Hardware access** | Printer, barcode scanner (via Tauri) | None |
| **Session timeout** | Manual logout only | Planned auto-logout |
| **Updates** | Tauri auto-updater | Instant (Vercel deploys) |
| **Target users** | Cashiers, branch admins | Business owners, superadmins |
| **Routes** | POS-specific (/pos/*) | SaaS-specific (/dashboard, /admin) |

---

*End of POS Architecture Document*
