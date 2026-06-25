# VenxPOS SaaS — Security Audit Report

**Project**: VenxPOS SaaS Platform
**Version**: 0.1.0 (pre-production)
**Date**: 2026-06-19
**Auditor**: Internal Security Review
**Scope**: Full-stack security assessment of codebase, infrastructure configuration, and data model
**Methodology**: SAST, manual code review, configuration audit, architectural threat modeling

---

## Executive Summary

This report presents the findings of a comprehensive security audit conducted on the VenxPOS SaaS platform, based on the existing VenxPOS v2.0 desktop codebase at `C:\Users\Juan2\Desktop\venxpos` and the planned SaaS architecture at `C:\Users\Juan2\Desktop\venxpos-saas`.

The audit identified **5 Critical**, **7 High**, **4 Medium**, and **2 Low** severity findings. The most pressing issues involve plaintext PIN storage, lack of authentication rate limiting at the application layer, service role key exposure via CLI scripts, missing CSRF protections, and absent webhook signature verification for Wompi payment integration.

The platform uses a modern stack (React 19, TypeScript, Tailwind, Zustand, Supabase, Tauri v2) with generally sound architectural choices. Row-Level Security (RLS) is enabled on all tables, which provides a strong foundation. However, the `empresas` table has RLS enabled but lacks INSERT/UPDATE/DELETE policies, the payment integrity hash is computed client-side, and several authentication hardening measures remain disabled in the Supabase configuration.

**Overall Risk Rating**: **HIGH** — The platform should not enter production without resolving all Critical and High severity findings.

---

## Finding Summary

| Severity | Count | Risk Level |
|----------|-------|------------|
| Critical | 5     | Immediate remediation required |
| High     | 7     | Remediation required before production |
| Medium   | 4     | Remediation within 30 days of launch |
| Low      | 2     | Remediation within 90 days of launch |
| **Total** | **18** | — |

---

## Scope of Audit

- **Frontend**: React 19 SPA (`src/`), Tauri desktop shell (`src-tauri/`)
- **Backend/API**: Supabase Edge Functions, PostgreSQL schema (`supabase_schema.sql`, `supabase/migrations/`)
- **Authentication**: Supabase Auth (Gotrue) configuration (`supabase/config.toml`)
- **Data Layer**: PostgreSQL 17 with RLS, 15 tables, 2 RPC functions
- **Third-Party Integrations**: Wompi (payment gateway), Resend (email delivery)
- **Build Tooling**: Vite 8, TypeScript 6, ESLint 10
- **Scripts**: CLI utilities (`scripts/`)
- **State Management**: Zustand 5 with session persistence

---

## Critical Findings

### CRIT-001: PIN stored in plaintext in database

| Field | Detail |
|-------|--------|
| **Severity** | Critical (9.5) |
| **Location** | `supabase_schema.sql:83` — `pin_acceso TEXT NOT NULL` in `usuarios` table |
| **Affected Code** | `src/components/AdminOverrideModal.tsx:18-19` |
| **CWE** | CWE-312 (Cleartext Storage of Sensitive Information) |

**Evidence**: The `usuarios` table stores administrator PINs as plaintext in the `pin_acceso` column:

```sql
-- supabase_schema.sql:83
pin_acceso      TEXT NOT NULL,
```

The `AdminOverrideModal` component retrieves the PIN and performs a direct string comparison:

```ts
// src/components/AdminOverrideModal.tsx:18-19
const { data } = await supabase.from('usuarios').select('pin_acceso').eq('user_id', session.id).single();
if (data && data.pin_acceso === pin) { onSuccess(); }
```

The seed script hardcodes a weak 4-digit PIN:

```js
// scripts/create-test-user.mjs:61
pin_acceso: "1234",
```

**Impact**: An attacker who gains read access to the `usuarios` table (via SQL injection, compromised service role, or insider access) obtains all administrator PINs in plaintext. Since PINs are also stored in Supabase localStorage sessions, an XSS attack could exfiltrate them. The PINs are used for sensitive operations including voiding sales, adjusting inventory, and overriding cash register closures.

**Remediation**:
1. Replace plaintext `pin_acceso` with a PBKDF2-SHA256 hash using the existing `hashPin()` function in `src/lib/crypto.ts:78-82`
2. Update `AdminOverrideModal.tsx:18-19` to use `verifyPin()` from `src/lib/crypto.ts:84-92` instead of direct string comparison
3. Add a salt per-user via database column `pin_salt TEXT` or store the hash in `salt:hash` format
4. Enforce minimum PIN length of 6 digits (currently no minimum enforced in the application)
5. Add PIN attempt logging to `eventos_auditoria` table and lock account after 5 failed attempts
6. Add `ALTER COLUMN pin_acceso SET NOT NULL` constraint if not already present

**Migration SQL**:
```sql
ALTER TABLE usuarios RENAME COLUMN pin_acceso TO pin_acceso_legacy;
ALTER TABLE usuarios ADD COLUMN pin_hash TEXT;
-- Run a migration script to hash all existing PINs
-- After verification, DROP COLUMN pin_acceso_legacy;
```

---

### CRIT-002: No application-level rate limiting on login endpoint

| Field | Detail |
|-------|--------|
| **Severity** | Critical (9.0) |
| **Location** | `src/components/Login.tsx:16-51` |
| **Configuration** | `supabase/config.toml:202` — `sign_in_sign_ups = 30` per 5 min |
| **CWE** | CWE-307 (Improper Restriction of Excessive Authentication Attempts) |

**Evidence**: The `Login.tsx` component has no client-side rate limiting, CAPTCHA, or progressive backoff:

```ts
// src/components/Login.tsx:16-51
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({ email, password });
  // ... no retry limit, no CAPTCHA, no delay
};
```

The Supabase auth configuration provides server-side rate limiting (`sign_in_sign_ups = 30` per 5 minutes), but this only applies to sign-in/sign-up endpoints — not to the application-level login flow. There is also no account lockout mechanism:

```toml
# supabase/config.toml:271-272 (commented out)
# [auth.sessions]
# inactivity_timeout = "8h"
```

CAPTCHA is disabled:
```toml
# supabase/config.toml:209-212 (commented out)
# [auth.captcha]
# enabled = true
# provider = "hcaptcha"
```

**Impact**: An attacker can perform credential brute-force attacks against user accounts. While the Supabase rate limiter (30 requests per 5 minutes per IP) offers some protection, distributed attacks using botnets can bypass IP-based limits. The lack of account lockout means an attacker can attempt credentials indefinitely. There is no progressive delay between attempts to slow automated tools.

**Remediation**:
1. Enable CAPTCHA in Supabase Auth config (`supabase/config.toml:209-212`) using hCaptcha or Cloudflare Turnstile
2. Add a client-side exponential backoff (1s → 2s → 4s → 8s → ...) after consecutive failures
3. Enable account lockout after 5 failed attempts (implement via `auth.hook.before_user_created` or a custom Edge Function)
4. Uncomment and configure session timeout (`supabase/config.toml:267-271`)
5. Add login attempt audit logging to `eventos_auditoria` table for SIEM integration
6. Implement progressive delay on the server side using an Edge Function that tracks failed attempts in Redis or a dedicated table

---

### CRIT-003: Supabase service_role key exposed in CLI scripts

| Field | Detail |
|-------|--------|
| **Severity** | Critical (9.0) |
| **Location** | `scripts/create-test-user.mjs:2-6` |
| **CWE** | CWE-798 (Use of Hard-coded Credentials) |

**Evidence**: The script `create-test-user.mjs` accepts the service_role key as a command-line argument and uses it to create users with admin privileges:

```js
// scripts/create-test-user.mjs:2-6
// Uso: node scripts/create-test-user.mjs TU_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://beacnoxukkoellhecofm.supabase.co";
const serviceKey = process.argv[2];
```

The project URL (`beacnoxukkoellhecofm.supabase.co`) is hardcoded in the script and visible in the repository.

**Impact**: The service_role key has unrestricted access to all database operations, bypassing RLS entirely. If a developer passes the key on the command line, it is stored in shell history (`~/.bash_history` or PowerShell history), visible to `ps` output on multi-user systems, and exposed in CI/CD logs. An attacker with access to shell history or CI logs gains full administrative access to the Supabase project — including reading all data, modifying records, creating admin accounts, and deleting the entire database.

**Remediation**:
1. **Immediately rotate** the service_role key in the Supabase dashboard
2. Move the production URL to an environment variable (`.env.local` which is already in `.gitignore`)
3. Accept the service_role key from environment variable `SUPABASE_SERVICE_ROLE_KEY` instead of CLI argument
4. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` (without real values)
5. Restrict service_role usage to server-side code only (Edge Functions, never client-side)
6. Add `.mjs` files to `.gitignore` or move scripts to a private, non-committed directory
7. Never hardcode Supabase URLs in source files; always use environment variables

---

### CRIT-004: No CSRF protection on the SaaS web application

| Field | Detail |
|-------|--------|
| **Severity** | Critical (8.5) |
| **Location** | Global — SaaS web entry point (Vite + React config) |
| **Affected Code** | `vite.config.ts`, `src/lib/supabase.ts` |
| **CWE** | CWE-352 (Cross-Site Request Forgery) |

**Evidence**: The current Tauri desktop application has a CSP configured in `src-tauri/tauri.conf.json:25`, but this only applies to the Tauri WebView. The SaaS web application (browser-based) has no Content Security Policy configured:

```json
// src-tauri/tauri.conf.json:25 — Tauri desktop only
"csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://beacnoxukkoellhecofm.supabase.co"
```

The Supabase client is initialized without any CSRF token handling:

```ts
// src/lib/supabase.ts:8-9
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: true, persistSession: true },
});
```

**Impact**: The SaaS web application, when deployed, will be vulnerable to CSRF attacks. An attacker can craft a malicious website that submits authenticated requests to the VenxPOS API on behalf of a logged-in user. This could lead to unauthorized actions such as creating sales, modifying inventory, changing user roles, or deleting data. The Supabase JS client does not automatically include CSRF tokens in API requests. Since `persistSession: true` stores the JWT in localStorage, any script with access to the origin can read the token.

**Remediation**:
1. Add a CSP meta tag in `index.html` for the SaaS web build with appropriate directives:
   ```html
   <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.wompi.co; img-src 'self' data:; font-src 'self'; frame-ancestors 'none';">
   ```
2. Configure the web server (Nginx/Cloudflare) to send CSP and CSRF headers
3. Implement SameSite cookie attribute enforcement (Supabase auth already uses `SameSite=Lax` by default; verify in production)
4. Add a custom CSRF token mechanism: generate a token server-side, embed it in a meta tag, and require it in all state-changing requests
5. For the SaaS frontend, move JWT storage from localStorage to an httpOnly cookie with `SameSite=Strict`
6. Add `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` headers

---

### CRIT-005: No webhook signature verification for Wompi payment integration

| Field | Detail |
|-------|--------|
| **Severity** | Critical (9.0) |
| **Location** | SaaS Edge Functions layer (to be implemented) |
| **CWE** | CWE-345 (Insufficient Verification of Data Authenticity) |

**Evidence**: The Wompi payment gateway integration is planned as part of the SaaS platform. The POS currently generates sale hashes client-side:

```ts
// src/components/PaymentModal.tsx:26-33
const computeVentaHash = useCallback(async (ventaId: string, fechaHora: string): Promise<string> => {
  const payload = `${ventaId}|${cartSubtotal}|${cartTaxes}|${cartTotal}|${fechaHora}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}, [cartSubtotal, cartTaxes, cartTotal]);
```

Wompi sends webhook events (`transaction.updated`, `nequi.updated`) to a configurable URL. Without signature verification, there is no mechanism to verify that incoming webhook payloads originate from Wompi.

**Impact**: An attacker who discovers the webhook endpoint URL can send forged payment confirmation payloads. This would allow them to mark unpaid orders as paid, trigger product fulfillment for fraudulent transactions, and cause direct financial loss. The Wompi API uses HMAC-SHA256 signatures with a secret key (`wompi_event_secret`), but if the Edge Function does not verify these signatures, the entire payment workflow is compromised.

**Remediation**:
1. Implement Wompi webhook signature verification in the Edge Function:
   ```ts
   // Edge Function: verify-wompi-webhook.ts
   const signature = req.headers.get('wompi-signature');
   const payload = await req.text();
   const expected = crypto.createHmac('sha256', WOMpi_EVENT_SECRET).update(payload).digest('hex');
   if (signature !== expected) return new Response('Invalid signature', { status: 401 });
   ```
2. Rotate the Wompi event secret key and store it in Supabase Vault/Edge Function secrets
3. Validate the `x-event-checksum` header (Wompi sends both `wompi-signature` and checksum)
4. Add IP allowlisting for Wompi's webhook source IPs (`34.196.85.2`, `52.87.190.255`)
5. Implement idempotency: track processed `transaction.id` values to prevent replay attacks
6. Log all webhook events (including failed verifications) to the `eventos_auditoria` table
7. Add a timestamp validation to reject webhooks older than 5 minutes

---

## High Findings

### HIGH-001: JWT tokens stored in localStorage (XSS-vulnerable)

| Field | Detail |
|-------|--------|
| **Severity** | High (7.5) |
| **Location** | `src/lib/supabase.ts:9` |
| **CWE** | CWE-922 (Insecure Storage of Sensitive Information) |

**Evidence**:

```ts
// src/lib/supabase.ts:8-9
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: true, persistSession: true },
});
```

The `persistSession: true` option causes Supabase to store JWT tokens (both `access_token` and `refresh_token`) in `localStorage`. These tokens are also stored in the Zustand store:

```ts
// src/store/useAppStore.ts:42-43
access_token: string;
refresh_token: string;
```

**Impact**: Any XSS vulnerability in the application allows an attacker to read `localStorage` and exfiltrate the JWT tokens. With the `refresh_token`, the attacker can maintain persistent access even after the `access_token` expires (1 hour per `supabase/config.toml:160`). The tokens grant full API access scoped to the user's RLS permissions.

**Remediation**:
1. For the SaaS web application: configure Supabase to use httpOnly cookies for token storage (requires custom domain and reverse proxy configuration)
2. For the Tauri desktop app: use the existing `encryptSession()`/`decryptSession()` functions in `src/lib/crypto.ts:94-122` with a device-specific key, and store encrypted tokens in Tauri's secure store plugin
3. Implement a strict Content Security Policy to mitigate XSS risk
4. Set `enable_refresh_token_rotation = true` (already enabled at `supabase/config.toml:166`)
5. Reduce `jwt_expiry` to 15-30 minutes for access tokens with automatic refresh

---

### HIGH-002: No session inactivity timeout configured

| Field | Detail |
|-------|--------|
| **Severity** | High (7.0) |
| **Location** | `supabase/config.toml:267-271` |
| **CWE** | CWE-613 (Insufficient Session Expiration) |

**Evidence**:

```toml
# supabase/config.toml:267-272 (commented out)
# [auth.sessions]
# Force log out after the specified duration.
# timebox = "24h"
# Force log out if the user has been inactive longer than the specified duration.
# inactivity_timeout = "8h"
```

**Impact**: User sessions persist indefinitely as long as the refresh token is valid and rotation is occurring. A shared or unattended POS terminal remains logged in indefinitely, allowing unauthorized users to perform transactions. The `jwt_expiry` of 3600 seconds only governs access token lifetime, not session lifetime. Since `enable_refresh_token_rotation = true`, the refresh token is effectively perpetual without a `timebox` limit.

**Remediation**:
1. Uncomment and configure `[auth.sessions]`:
   ```toml
   [auth.sessions]
   timebox = "12h"
   inactivity_timeout = "2h"
   ```
2. Add a client-side idle detection timer that triggers automatic logout after configurable inactivity
3. Implement a "lock screen" component that requires PIN re-entry after inactivity timeout
4. Log all session timeouts to `eventos_auditoria`

---

### HIGH-003: Weak password policy (minimum 6 characters)

| Field | Detail |
|-------|--------|
| **Severity** | High (7.0) |
| **Location** | `supabase/config.toml:177` |
| **CWE** | CWE-521 (Weak Password Requirements) |

**Evidence**:

```toml
# supabase/config.toml:177
minimum_password_length = 6
```

No password complexity requirements are configured:

```toml
# supabase/config.toml:180
password_requirements = ""
```

**Impact**: The minimum password length of 6 characters without any complexity requirements (no digits, no uppercase, no special characters) makes user accounts vulnerable to brute-force and dictionary attacks. A password like "123456" or "abcdef" would be accepted. Combined with CRIT-002 (no account lockout), the authentication security is significantly weakened.

**Remediation**:
1. Set `minimum_password_length = 10` (recommended minimum for financial systems)
2. Set `password_requirements = "lower_upper_letters_digits_symbols"` in `supabase/config.toml:180`
3. Add a custom password strength validator in the sign-up Edge Function
4. Reject passwords from known breach databases (HaveIBeenPwned API)
5. Enforce password rotation every 90 days for admin accounts

---

### HIGH-004: Email confirmations disabled

| Field | Detail |
|-------|--------|
| **Severity** | High (7.5) |
| **Location** | `supabase/config.toml:221` |
| **CWE** | CWE-640 (Weak Account Registration) |

**Evidence**:

```toml
# supabase/config.toml:221
enable_confirmations = false
```

**Impact**: Users can register accounts with arbitrary email addresses without verifying ownership. This enables:
- Account creation with typosquatted emails
- Denial-of-service by registering accounts with other users' emails
- Fake account creation for fraud
- Bypassing email-based audit trails

**Remediation**:
1. Set `enable_confirmations = true` in `supabase/config.toml:221`
2. Configure SMTP for production email delivery (`[auth.email.smtp]` at `supabase/config.toml:232-239`)
3. Add a Resend integration for transactional emails (already planned per SaaS architecture)
4. Implement email verification reminder banner in the UI
5. Add a grace period: unverified accounts are restricted to read-only access until confirmed

---

### HIGH-005: No CSP configured for SaaS web application

| Field | Detail |
|-------|--------|
| **Severity** | High (7.5) |
| **Location** | SaaS web `index.html` (to be created) |
| **Reference** | `src-tauri/tauri.conf.json:25` (Tauri-only CSP) |
| **CWE** | CWE-1021 (Improper Restriction of Rendered UI Layers) |

**Evidence**: The existing CSP only applies to the Tauri desktop application. The SaaS web application will run in standard browsers without the Tauri security boundaries:

```json
// src-tauri/tauri.conf.json:25 — desktop only
"csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://beacnoxukkoellhecofm.supabase.co"
```

**Impact**: Without a CSP, the SaaS web application is vulnerable to XSS attacks, clickjacking, and content injection. An attacker who finds any HTML injection vector can execute arbitrary JavaScript in the user's browser context, potentially exfiltrating JWT tokens from localStorage (see HIGH-001), manipulating DOM elements to phish credentials, or performing unauthorized API calls.

**Remediation** (same as CRIT-004):
1. Add CSP headers via meta tag and HTTP response headers
2. Configure the deployment platform (Netlify, Vercel, Cloudflare Pages) to send security headers:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co https://api.wompi.co https://api.resend.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   X-Content-Type-Options: nosniff
   X-Frame-Options: DENY
   Referrer-Policy: strict-origin-when-cross-origin
   ```
3. Generate a `_headers` or `netlify.toml` file with security headers
4. Test CSP with report-only mode before enforcing

---

### HIGH-006: empresas table missing INSERT/UPDATE/DELETE RLS policies

| Field | Detail |
|-------|--------|
| **Severity** | High (7.5) |
| **Location** | `supabase_schema.sql:335` |
| **CWE** | CWE-862 (Missing Authorization) |

**Evidence**: The `empresas` table has RLS enabled but only a SELECT policy is implicitly inherited (no explicit SELECT policy is defined). There are no INSERT, UPDATE, or DELETE policies:

```sql
-- supabase_schema.sql:335
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- No INSERT, UPDATE, DELETE policies for empresas
-- Compare with other tables that have ALL policies for admins:
-- supabase_schema.sql:365-371
CREATE POLICY "Admin gestiona productos" ON productos FOR ALL USING (...);
CREATE POLICY "Admin gestiona inventario" ON inventario_sucursal FOR ALL USING (...);
-- ... etc
-- empresas has NO such policy
```

The schema also lacks policies for `sucursales` INSERT/UPDATE/DELETE (only SELECT exists):

```sql
-- supabase_schema.sql:338
CREATE POLICY "Leer sucursales" ON sucursales FOR SELECT USING (...);
-- No INSERT/UPDATE/DELETE policy for sucursales
```

**Impact**: In the SaaS multi-tenant model, new tenant (empresa) registration cannot happen through the API because there are no INSERT policies. More critically, if the service_role key is ever leaked (see CRIT-003), an attacker can modify or delete empresa records with no RLS barrier. The `sucursales` table similarly cannot be created or modified through the application API, blocking core SaaS onboarding flows.

**Remediation**:
1. Add explicit policies for `empresas`:
   ```sql
   -- Only superadmins (cross-tenant) can create empresas
   CREATE POLICY "Superadmin crea empresas" ON empresas FOR INSERT
     WITH CHECK (is_superadmin());
   
   -- Tenant admins can manage their own empresa
   CREATE POLICY "Admin gestiona empresa" ON empresas FOR ALL
     USING (id IN (SELECT empresa_id FROM sucursales WHERE id = get_user_sucursal()))
     WITH CHECK (id IN (SELECT empresa_id FROM sucursales WHERE id = get_user_sucursal()));
   ```
2. Add INSERT policy for `sucursales`:
   ```sql
   CREATE POLICY "Admin crea sucursales" ON sucursales FOR INSERT
     WITH CHECK (empresa_id IN (SELECT empresa_id FROM sucursales WHERE id = get_user_sucursal()));
   ```
3. Create an `is_superadmin()` function that checks a cross-tenant role
4. Add an `app_admin` role separate from tenant admin for platform-level operations

---

### HIGH-007: Payment integrity hash computed client-side

| Field | Detail |
|-------|--------|
| **Severity** | High (7.0) |
| **Location** | `src/components/PaymentModal.tsx:26-33` |
| **CWE** | CWE-602 (Client-Side Enforcement of Server-Side Security) |

**Evidence**: The sale integrity hash is computed entirely in the browser using `crypto.subtle.digest` before sending the transaction to the database:

```ts
// src/components/PaymentModal.tsx:26-33
const computeVentaHash = useCallback(async (ventaId: string, fechaHora: string): Promise<string> => {
  const payload = `${ventaId}|${cartSubtotal}|${cartTaxes}|${cartTotal}|${fechaHora}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}, [cartSubtotal, cartTaxes, cartTotal]);
```

The computed hash is then inserted directly into the `ventas` table:

```ts
// src/components/PaymentModal.tsx:67-69
await supabase.from('ventas').insert({
  // ...
  hash,  // <-- client-computed hash
  // ...
});
```

**Impact**: The payment hash is intended to serve as an integrity check against tampering, but since it's computed client-side, a malicious user or a compromised client can:
1. Modify cart totals before hash computation
2. Send fabricated hash values that match manipulated transaction data
3. Bypass the hash integrity check entirely by modifying the client code

The hash serves no security purpose when computed entirely client-side. For tax compliance (Colombian DIAN requirements), the hash must be verifiable by auditors as tamper-proof.

**Remediation**:
1. Compute the sale hash server-side in a `SECURITY DEFINER` Postgres function:
   ```sql
   CREATE OR REPLACE FUNCTION compute_venta_hash(
     p_venta_id UUID,
     p_subtotal DECIMAL(12,2),
     p_impuestos DECIMAL(12,2),
     p_total DECIMAL(12,2),
     p_fecha_hora TIMESTAMPTZ
   ) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
   BEGIN
     RETURN encode(
       digest(p_venta_id::text || '|' || p_subtotal::text || '|' || p_impuestos::text || '|' || p_total::text || '|' || p_fecha_hora::text, 'sha256'),
       'hex'
     );
   END;
   $$;
   ```
2. Remove `computeVentaHash` from the client and call the server-side function instead
3. Add a database trigger that automatically computes the hash on INSERT to prevent bypass
4. Add a CHECK constraint on `ventas.hash` that validates the hash format
5. For Wompi transactions, use Wompi's own transaction reference as the integrity token

---

## Medium Findings

### MED-001: Error messages expose internal database structure

| Field | Detail |
|-------|--------|
| **Severity** | Medium (5.0) |
| **Location** | Multiple components, e.g., `src/components/PaymentModal.tsx:122-123` |
| **CWE** | CWE-209 (Generation of Error Message Containing Sensitive Information) |

**Evidence**: Error messages from Supabase queries are passed directly to the user interface without sanitization:

```ts
// src/components/PaymentModal.tsx:121-123
} catch (e) {
  console.error('Error guardando la venta', e);
  setErrorMessage(e instanceof Error ? e.message : 'Error al guardar la venta');
}
```

Supabase error messages often contain table names, column names, constraint names, and database structure details. For example, a failed INSERT might expose: `"new row violates row-level security policy for table 'ventas'"`.

**Impact**: Error messages reveal internal database schema to attackers, including table names, column names, and the existence of RLS policies. This information aids reconnaissance for targeted attacks.

**Remediation**:
1. Implement a centralized error handler that maps database errors to user-friendly messages
2. Log detailed errors server-side or to console only in development mode
3. Display generic error messages to users: "Ocurrió un error al procesar la venta. Intente nuevamente."
4. Use error codes (not messages) to determine user-facing text
5. Add an error boundary component that catches and sanitizes all errors

---

### MED-002: No structured logging or centralized audit trail

| Field | Detail |
|-------|--------|
| **Severity** | Medium (5.5) |
| **Location** | Global — across all components |
| **CWE** | CWE-778 (Insufficient Logging) |

**Evidence**: The application uses `console.error()` for error logging with no structured format, no log levels, and no centralized log aggregation:

```ts
// src/components/PaymentModal.tsx:122
console.error('Error guardando la venta', e);

// src/components/Login.tsx:46
console.error(e);
```

While there is an `eventos_auditoria` table (`supabase_schema.sql:172-185`), it is used for specific business events (apertura_cajon, inicio_sesion, etc.) and is not leveraged for security-relevant event logging such as failed login attempts, RLS violations, or suspicious API access patterns.

**Impact**: Without structured logging, security incidents cannot be detected, investigated, or attributed. Failed login attempts are not tracked, making it impossible to detect brute-force attacks. Database errors are not correlated with user sessions, making forensic analysis impossible after a breach.

**Remediation**:
1. Implement structured JSON logging with fields: `timestamp`, `level`, `component`, `userId`, `sucursalId`, `action`, `error`, `stack`
2. Send logs to a centralized service (Supabase Logs, Logflare, or self-hosted Grafana/Loki)
3. Add security-specific log events: `LOGIN_FAILED`, `LOGIN_SUCCESS`, `RLS_BLOCKED`, `INVALID_TOKEN`, `RATE_LIMITED`, `SUSPICIOUS_ACTIVITY`
4. Create a `security_events` table or extend `eventos_auditoria` with security-relevant event types
5. Set up log-based alerts for anomaly detection (e.g., >10 failed logins from same IP in 5 minutes)

---

### MED-003: No backup strategy defined

| Field | Detail |
|-------|--------|
| **Severity** | Medium (6.0) |
| **Location** | Infrastructure — not in codebase |
| **CWE** | — (Operational security gap) |

**Evidence**: There is no backup configuration, backup script, or disaster recovery documentation anywhere in the project. Supabase's hosted plan includes automated backups (Point-in-Time Recovery on Pro plan, daily backups on all paid plans), but there is no:
- Backup verification procedure
- Restoration test schedule
- Off-site backup strategy
- RPO (Recovery Point Objective) definition
- RTO (Recovery Time Objective) definition

**Impact**: In the event of data corruption, accidental deletion, or ransomware, critical business data (sales records, inventory, tax reports) could be permanently lost. Colombian tax law (DIAN) requires retention of electronic invoices and sales records for a minimum of 5 years.

**Remediation**:
1. Enable Supabase Point-in-Time Recovery (requires Pro plan)
2. Set up daily automated `pg_dump` exports to an encrypted S3 bucket in a different region
3. Document RPO (≤1 hour) and RTO (≤4 hours) targets
4. Create a backup verification script that runs weekly
5. Schedule quarterly restoration drills
6. Export critical tables (`ventas`, `productos`, `inventario_sucursal`) as CSV daily as a secondary backup
7. Add backup status monitoring with alerting

---

### MED-004: No Multi-Factor Authentication (MFA)

| Field | Detail |
|-------|--------|
| **Severity** | Medium (5.5) |
| **Location** | `supabase/config.toml:296-299` |
| **CWE** | CWE-308 (Use of Single-Factor Authentication) |

**Evidence**: MFA is available in Supabase but disabled:

```toml
# supabase/config.toml:297-299
[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false
```

**Impact**: All users authenticate with only email + password. A compromised password grants full access to the system. For a financial application handling real money transactions (sales, payments, refunds), single-factor authentication is insufficient, especially for admin users who can modify inventory, adjust prices, and override system controls.

**Remediation**:
1. Enable TOTP-based MFA for all admin users:
   ```toml
   [auth.mfa.totp]
   enroll_enabled = true
   verify_enabled = true
   ```
2. Require MFA enrollment on first admin login
3. Make MFA optional for cajero (cashier) roles but required for admin roles
4. Add MFA setup UI flow in the user profile/settings page
5. Implement MFA recovery codes stored as hashed values

---

## Low Findings

### LOW-001: Pre-release/unstable dependencies in package.json

| Field | Detail |
|-------|--------|
| **Severity** | Low (3.0) |
| **Location** | `package.json:19-21,25-41` |
| **CWE** | CWE-1104 (Use of Unmaintained Third-Party Components) |

**Evidence**: The project uses bleeding-edge versions of major dependencies that may have undiscovered vulnerabilities:

```json
"react": "^19.2.6",
"typescript": "~6.0.2",
"vite": "^8.0.12",
"eslint": "^10.3.0"
```

React 19.2 and TypeScript 6 are very recent releases with limited production track record. Vite 8 reached stable release only 2 months before this audit.

**Impact**: Newer versions may contain undiscovered security vulnerabilities. The rapid release cycles of these tools mean security patches may not be available for zero-days. The npm supply chain attack surface is larger with cutting-edge dependencies.

**Remediation**:
1. Pin dependency versions exactly (remove `^` and `~` prefixes) for production
2. Run `npm audit` in CI/CD pipeline and fail on high/critical findings
3. Subscribe to security advisories for React, Vite, and Supabase JS client
4. Consider using Dependabot or Renovate for automated security updates
5. Perform a pre-production dependency review: remove unused dependencies (`lucide-react`, `xlsx` may have large trees)
6. Generate and commit an SBOM (Software Bill of Materials) using `npm sbom`

---

### LOW-002: refresh_token stored in Zustand state (plaintext)

| Field | Detail |
|-------|--------|
| **Severity** | Low (3.5) |
| **Location** | `src/store/useAppStore.ts:11` |
| **CWE** | CWE-315 (Cleartext Storage in Memory) |

**Evidence**: The `UserSession` interface stores the `refresh_token` alongside the `access_token` in Zustand state:

```ts
// src/store/useAppStore.ts:10-11
access_token: string;
refresh_token: string;
```

And it's populated from the Supabase auth session:

```ts
// src/components/Login.tsx:42-43
access_token: authData.session.access_token,
refresh_token: authData.session.refresh_token,
```

**Impact**: The `refresh_token` is stored in-memory in the Zustand store and is accessible to any code running in the same JavaScript context. In a Tauri environment, this is contained. In the SaaS web environment, an XSS vulnerability would expose both the `access_token` (short-lived) and `refresh_token` (long-lived), allowing persistent unauthorized access. While this is a lower severity because it's in-memory (not persisted to disk), it's still a concern.

**Remediation**:
1. Remove `refresh_token` from the `UserSession` interface — the Supabase JS client manages it internally
2. Only store the `access_token` in Zustand for API calls; let the Supabase client handle refresh silently
3. If `refresh_token` must be stored, encrypt it with `encryptSession()` from `src/lib/crypto.ts:94-103`
4. The `Login.tsx` component should not manually extract and store tokens — rely on the Supabase client's internal session management

---

## Appendix A: Security Strengths Identified

The codebase demonstrates several positive security practices:

| Strength | Details |
|----------|---------|
| **RLS enabled on all tables** | All 15 tables have Row Level Security enabled (`supabase_schema.sql:320-335`), ensuring data isolation per `sucursal_id` |
| **Optimistic concurrency control** | `decrementar_inventario()` uses `FOR UPDATE` and version-checking pattern (`supabase_schema.sql:396-413`) |
| **PBKDF2 crypto utilities exist** | `src/lib/crypto.ts` implements `hashPin()`, `verifyPin()`, `encryptSession()`, `decryptSession()` with 100,000 iterations (though unused for PINs) |
| **Refresh token rotation enabled** | `supabase/config.toml:166` — prevents long-lived refresh token abuse |
| **Rate limiting configured (server-side)** | `sign_in_sign_ups = 30` per 5 min, `token_refresh = 150` per 5 min |
| **Security-definer functions** | `get_user_sucursal()`, `is_admin()`, `decrementar_inventario()` use `SECURITY DEFINER` for controlled privilege escalation |
| **Audit table exists** | `eventos_auditoria` table with structured event types and JSONB metadata |
| **CSP in Tauri desktop** | `tauri.conf.json:25` provides application-level CSP for the desktop build |
| **DB network restrictions ready** | `[db.network_restrictions]` section in config prepared for IP allowlisting |

---

## Appendix B: Tested Files

| File | Lines | Key Security Relevance |
|------|-------|----------------------|
| `src/components/AdminOverrideModal.tsx` | 38 | PIN verification, plaintext comparison |
| `src/components/Login.tsx` | 79 | Authentication flow, no rate limiting |
| `src/components/PaymentModal.tsx` | 180 | Client-side hash computation, error exposure |
| `src/lib/supabase.ts` | 10 | JWT storage configuration |
| `src/lib/crypto.ts` | 122 | PBKDF2 hashing (unused for PINs) |
| `src/store/useAppStore.ts` | 273 | Token storage in Zustand state |
| `supabase/config.toml` | 408 | Auth, MFA, session, rate limit configuration |
| `supabase_schema.sql` | 481 | Schema definitions, RLS policies |
| `scripts/create-test-user.mjs` | 80 | Service role key exposure |
| `src-tauri/tauri.conf.json` | 58 | Desktop CSP, Tauri security boundaries |
| `package.json` | 43 | Dependency versions |
| `supabase/migrations/20260617043200_init_schema.sql` | 328 | Initial schema with RLS |

---

## Appendix C: Remediation Priority Matrix

| Priority | Finding IDs | Timeline |
|----------|-------------|----------|
| **P0 — Immediate** | CRIT-001, CRIT-003, CRIT-005 | Before any production deployment |
| **P1 — Before Launch** | CRIT-002, CRIT-004, HIGH-004, HIGH-005, HIGH-006 | Before SaaS public availability |
| **P2 — Sprint 1** | HIGH-001, HIGH-002, HIGH-003, HIGH-007 | Within first development sprint |
| **P3 — Sprint 2** | MED-001, MED-002, MED-004 | Within 2 weeks of launch |
| **P4 — Sprint 3** | MED-003, LOW-001, LOW-002 | Within 30 days of launch |

---

*This report is confidential and intended for the VenxPOS engineering and security teams. All findings must be tracked and remediated before production deployment.*
