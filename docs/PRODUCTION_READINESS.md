# VenxPOS SaaS — Production Readiness Checklist

**Project**: VenxPOS SaaS Platform
**Version**: 0.1.0 → Target: 1.0.0
**Date**: 2026-06-19
**Target Launch**: TBD
**Classification**: Engineering Team

---

## How to Use This Checklist

- [ ] = Not started / Not applicable
- [x] = Completed and verified
- [~] = In progress / Partially complete
- **P0** = Blocker for launch (must be complete)
- **P1** = Required within first week post-launch
- **P2** = Required within first month post-launch
- **P3** = Nice-to-have / continuous improvement

---

## 1. Authentication & Session Management

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 1.1 | PINs hashed with PBKDF2-SHA256 (not plaintext) | [ ] | **P0** | CRIT-001; `src/lib/crypto.ts:78-92` — existing `hashPin()`/`verifyPin()` unused. Update `AdminOverrideModal.tsx:18-19` |
| 1.2 | Minimum password length ≥10 characters | [ ] | **P0** | HIGH-003; `supabase/config.toml:177` — currently `minimum_password_length = 6` |
| 1.3 | Password complexity requirements enforced | [ ] | **P0** | HIGH-003; `supabase/config.toml:180` — set `password_requirements = "lower_upper_letters_digits_symbols"` |
| 1.4 | CAPTCHA enabled on login/signup | [ ] | **P0** | CRIT-002; `supabase/config.toml:209-212` — uncomment and configure hCaptcha or Turnstile |
| 1.5 | Account lockout after 5 failed login attempts | [ ] | **P0** | CRIT-002; implement via `auth.hook` or Edge Function; log to `eventos_auditoria` |
| 1.6 | Client-side rate limiting with exponential backoff | [ ] | **P0** | CRIT-002; add progressive delay in `Login.tsx:16-51` after consecutive failures |
| 1.7 | Email confirmations enabled | [ ] | **P0** | HIGH-004; `supabase/config.toml:221` — set `enable_confirmations = true` |
| 1.8 | Session timebox configured (max 12h) | [ ] | P1 | HIGH-002; `supabase/config.toml:268-269` — uncomment `timebox = "12h"` |
| 1.9 | Session inactivity timeout configured (2h) | [ ] | P1 | HIGH-002; `supabase/config.toml:270-271` — uncomment `inactivity_timeout = "2h"` |
| 1.10 | Client-side idle detection + auto-lock UI | [ ] | P1 | HIGH-002; implement inactivity timer with PIN re-entry lock screen |
| 1.11 | JWT access_token expiry ≤30 minutes | [ ] | P1 | `supabase/config.toml:160` — currently `jwt_expiry = 3600` (1h); consider 1800 (30m) |
| 1.12 | Refresh token rotation enabled (verify) | [~] | P0 | `supabase/config.toml:166` — `enable_refresh_token_rotation = true` (already set; verify in production) |
| 1.13 | JWT stored securely (httpOnly cookie for SaaS, encrypted for Tauri) | [ ] | **P0** | HIGH-001; `src/lib/supabase.ts:9` — `persistSession: true` uses localStorage; migrate for web |
| 1.14 | `refresh_token` removed from Zustand store | [ ] | P1 | LOW-002; `src/store/useAppStore.ts:11` — remove `refresh_token` from `UserSession` interface |
| 1.15 | SMTP configured for production email delivery (Resend) | [ ] | **P0** | `supabase/config.toml:232-239` — configure Resend SMTP; test invitation/password reset flows |
| 1.16 | MFA (TOTP) enabled for admin users | [ ] | P2 | MED-004; `supabase/config.toml:297-299` — set `enroll_enabled = true`, `verify_enabled = true` |
| 1.17 | MFA enrollment flow tested end-to-end | [ ] | P2 | MED-004; build MFA setup UI in admin profile page |
| 1.18 | Password reset flow tested end-to-end | [ ] | P1 | Verify Resend integration delivers reset emails within 30 seconds |
| 1.19 | Sign-up restricted to invited users only (or CAPTCHA-protected) | [ ] | P1 | `supabase/config.toml:171` — consider `enable_signup = false` for invite-only SaaS |

---

## 2. Role-Based Access Control (RBAC)

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 2.1 | RLS policies verified for all 15 tables | [~] | **P0** | `supabase_schema.sql:320-371` — 15/15 tables have RLS enabled |
| 2.2 | `empresas` table has INSERT/UPDATE/DELETE policies | [ ] | **P0** | HIGH-006; `supabase_schema.sql:335` — only SELECT implicit; add INSERT for superadmin, ALL for tenant admin |
| 2.3 | `sucursales` table has INSERT/UPDATE/DELETE policies | [ ] | **P0** | HIGH-006; `supabase_schema.sql:338` — add INSERT (tenant-scoped), UPDATE/DELETE (admin only) |
| 2.4 | Cross-tenant data isolation verified (Tenant A cannot read Tenant B data) | [ ] | **P0** | Test: authenticate as cajero@sucursal-A, attempt to query sucursal-B data — must return empty |
| 2.5 | `is_admin()` function used consistently across all admin policies | [~] | P1 | `supabase_schema.sql:256-263` — verified for productos, inventario, conflictos, usuarios, categorias, aperturas, config_fiscal |
| 2.6 | `is_superadmin()` function created for cross-tenant operations | [ ] | P1 | NEW — create function for platform-level operations (empresa creation, billing, global config) |
| 2.7 | RPC functions use `SECURITY DEFINER` appropriately (no privilege leaks) | [~] | P1 | `supabase_schema.sql:387-419,465` — `decrementar_inventario` and `incrementar_inventario` use SECURITY DEFINER; audit for privilege escalation |
| 2.8 | SQL injection tested on all RPC functions | [ ] | P1 | AV-4; verify all PL/pgSQL functions use parameterized variables, not dynamic SQL with concatenation |
| 2.9 | `usuarios.rol` CHECK constraint enforces only 'cajero' or 'admin' | [x] | P1 | `supabase_schema.sql:81` — `CHECK (rol IN ('cajero', 'admin'))` |
| 2.10 | `usuarios.estado` CHECK constraint enforces valid states | [x] | P1 | `supabase_schema.sql:84` — `CHECK (estado IN ('activo', 'inactivo', 'suspendido'))` |
| 2.11 | Suspended/inactive users cannot authenticate | [ ] | P1 | Test: set user to 'inactivo', attempt login — must be denied |
| 2.12 | Admin override (PIN) requires hashed verification | [ ] | **P0** | CRIT-001; `src/components/AdminOverrideModal.tsx:18-19` — migrate from plaintext to `verifyPin()` |

---

## 3. API Security

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 3.1 | CSRF protection implemented for SaaS web app | [ ] | **P0** | CRIT-004; add CSP, CSRF tokens, SameSite cookies |
| 3.2 | CSP headers configured for production deployment | [ ] | **P0** | CRIT-004, HIGH-005; deploy CSP via `_headers` file and server config: `default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co https://api.wompi.co; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'` |
| 3.3 | Security headers configured (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | [ ] | **P0** | CRIT-004; implement in deployment config (Netlify/Vercel/Cloudflare) |
| 3.4 | Wompi webhook HMAC signature verification implemented | [ ] | **P0** | CRIT-005; Edge Function must verify `wompi-signature` header before processing |
| 3.5 | Wompi webhook IP allowlisting configured | [ ] | P1 | CRIT-005; allow Wompi IPs: `34.196.85.2`, `52.87.190.255` |
| 3.6 | Webhook idempotency implemented (deduplicate events) | [ ] | P1 | CRIT-005; track processed transaction IDs in a `webhook_events` table |
| 3.7 | Wompi event secret stored in Edge Function secrets (not env vars) | [ ] | **P0** | CRIT-005; use `supabase secrets set WOMpi_EVENT_SECRET` |
| 3.8 | Resend webhook signature verification implemented | [ ] | P1 | Similar to Wompi; verify Resend's `svix-id` and `svix-signature` headers |
| 3.9 | Resend API key stored in Edge Function secrets | [ ] | P1 | Use `supabase secrets set RESEND_API_KEY` |
| 3.10 | Supabase service_role key rotated and never committed | [ ] | **P0** | CRIT-003; rotate key immediately; remove from `scripts/create-test-user.mjs` |
| 3.11 | All scripts use environment variables for secrets (never CLI args) | [ ] | **P0** | CRIT-003; update `create-test-user.mjs` to use `process.env.SUPABASE_SERVICE_ROLE_KEY` |
| 3.12 | Supabase anon key rotation plan documented | [ ] | P2 | Anon key is embedded in client code; rotation requires coordinated deployment |
| 3.13 | API rate limiting tested in production configuration | [ ] | P1 | `supabase/config.toml:202` — verify `sign_in_sign_ups = 30` per 5 min is active |
| 3.14 | API error responses sanitized (no table/column names exposed to client) | [ ] | P1 | MED-001; implement centralized error handler that maps DB errors to user-friendly messages |
| 3.15 | CORS configured to allow only production domains | [ ] | **P0** | `supabase/config.toml:154` — verify `site_url` and `additional_redirect_urls` are correct |
| 3.16 | TLS/HTTPS enforced in production | [ ] | **P0** | Supabase hosted: default HTTPS. Verify custom domain with SSL certificate. |

---

## 4. Frontend Security (SaaS Web App)

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 4.1 | CSP meta tag in `index.html` | [ ] | **P0** | See item 3.2; also add `<meta http-equiv="CSP" ...>` as defense-in-depth |
| 4.2 | No `dangerouslySetInnerHTML` without DOMPurify sanitization | [ ] | P1 | Search codebase: `rg "dangerouslySetInnerHTML"` — must find 0 results or justify each |
| 4.3 | No `eval()` or `new Function()` usage | [ ] | P1 | Search codebase: `rg "eval\(|new Function"` — must find 0 results |
| 4.4 | React's `useEffect` cleanup functions prevent memory leaks | [~] | P2 | Spot-check: `AdminOverrideModal.tsx:10-14` — correctly cleans up event listener |
| 4.5 | Input validation on all user-controlled fields (client-side) | [~] | P2 | `Login.tsx` uses HTML5 validation (`type="email"`, `required`); extend to all forms |
| 4.6 | No sensitive data in URL query parameters | [ ] | P1 | Verify no tokens, emails, or user IDs in URL bar |
| 4.7 | Error boundaries wrap all route-level components | [~] | P2 | `src/components/ErrorBoundary.tsx` exists; verify it wraps all routes |
| 4.8 | Static assets served with correct `Content-Type` headers | [ ] | P2 | Verify in production deployment |
| 4.9 | Source maps disabled in production build | [ ] | P1 | Vite config: `build.sourcemap = false` for production |
| 4.10 | `.env` files excluded from build output | [x] | **P0** | `.gitignore` already includes `.env.local`; verify `.env.production` is also excluded |
| 4.11 | `vite.config.ts` reviewed for security implications | [ ] | P2 | Check: no exposed env vars beyond `VITE_*` prefixed |
| 4.12 | Service workers (if any) reviewed for security | [ ] | P2 | No service workers currently; add to checklist if PWA features are added |

---

## 5. Wompi Payments Integration

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 5.1 | Webhook signature verified with HMAC-SHA256 | [ ] | **P0** | CRIT-005; implement in Edge Function |
| 5.2 | Transaction amounts validated server-side before fulfillment | [ ] | **P0** | Compare webhook `amount_in_cents` with database order amount |
| 5.3 | Payment status transitions validated (only valid state machine) | [ ] | P1 | Wompi states: `PENDING` → `APPROVED` / `DECLINED` / `VOIDED` / `ERROR` |
| 5.4 | Idempotency key used for all Wompi API calls | [ ] | P1 | Prevent duplicate transactions on retry |
| 5.5 | Wompi public key embedded in client code (expected) | [~] | Info | Public key is designed to be public; private key must remain server-side |
| 5.6 | Wompi private/secret keys never exposed to client | [ ] | **P0** | Verify: all Wompi API calls with private key happen in Edge Functions, not in React code |
| 5.7 | Payment amounts calculated server-side (not from client cart) | [ ] | **P0** | HIGH-007; move sale hash and amount calculation to server-side |
| 5.8 | Refund flow requires admin authorization (hashed PIN) | [ ] | P1 | Extend AdminOverrideModal to cover refund operations |
| 5.9 | Wompi test environment used for staging, production keys for production | [ ] | P1 | Use `VITE_WOMPI_ENV` to switch between test/production keys |
| 5.10 | Wompi integration error handling: timeout, network error, invalid response | [ ] | P1 | Implement retry with exponential backoff for API calls |

---

## 6. Data Protection

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 6.1 | All PINs hashed with PBKDF2-SHA256 + per-user salt | [ ] | **P0** | CRIT-001; migrate `usuarios.pin_acceso` → `usuarios.pin_hash` with salt |
| 6.2 | Sale integrity hash computed server-side | [ ] | **P0** | HIGH-007; create PostgreSQL function `compute_venta_hash()` |
| 6.3 | PostgreSQL TLS enforced for all connections | [ ] | P1 | `supabase/config.toml:78-79` — uncomment `[db.ssl_enforcement]` |
| 6.4 | Database network restrictions configured (IP allowlist) | [ ] | P2 | `supabase/config.toml:67-75` — restrict `allowed_cidrs` to application servers |
| 6.5 | PII fields identified and documented | [ ] | P1 | `usuarios.nombre`, `usuarios.email` (via auth.users), `sucursales.direccion`, `sucursales.telefono` |
| 6.6 | Data retention policy defined for all tables | [ ] | P2 | Colombian DIAN: 5-year retention for electronic invoices and sales records |
| 6.7 | Right-to-deletion (GDPR/Ley 1581) process documented | [ ] | P2 | Process: anonymize `usuarios`, cascade-delete user's data or mark as deleted |
| 6.8 | Data export capability (user data portability) | [ ] | P2 | Export ventas, productos, inventario as CSV/JSON |
| 6.9 | Encryption at rest verified (Supabase managed) | [~] | P1 | Supabase uses AES-256 for storage; verify in production dashboard |
| 6.10 | `encryptSession()`/`decryptSession()` used for Tauri-local session storage | [ ] | P1 | `src/lib/crypto.ts:94-122` — implement in Tauri build with device-specific key |
| 6.11 | Database column encryption considered for sensitive fields | [ ] | P2 | Use `pgcrypto` or Supabase Vault for `nit`, `resolucion_dian` |

---

## 7. Observability & Monitoring

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 7.1 | Structured logging implemented (JSON format with severity levels) | [ ] | P1 | MED-002; replace `console.error` with structured logger |
| 7.2 | All authentication events logged (login success/failure, logout, token refresh) | [ ] | P1 | MED-002; write to `eventos_auditoria` or dedicated `security_events` table |
| 7.3 | All admin actions logged (override, inventory adjustment, price change) | [~] | P1 | `eventos_auditoria` already has `admin_override`, `ajuste_inventario` types |
| 7.4 | Failed RLS policy checks logged | [ ] | P1 | Supabase logs RLS violations to PostgREST logs; aggregate and alert |
| 7.5 | API error rate monitoring with alerting | [ ] | P1 | Set up alert when error rate > 5% over 5 minutes |
| 7.6 | Database connection pool monitoring | [ ] | P2 | `supabase/config.toml:46-48` — monitor pool utilization |
| 7.7 | Supabase Realtime WebSocket connection monitoring | [ ] | P2 | Monitor disconnection rate, reconnection attempts |
| 7.8 | Uptime monitoring (external health check) | [ ] | P1 | Set up uptime check hitting a public health endpoint every 60s |
| 7.9 | Performance monitoring (API response times, DB query times) | [ ] | P2 | Supabase dashboard provides query performance analytics |
| 7.10 | Error tracking service integration (Sentry, LogRocket) | [ ] | P2 | Consider Sentry for frontend error tracking |
| 7.11 | Security alerting pipeline configured (SIEM/webhook) | [ ] | P2 | Forward security events to Slack/email for critical events |

---

## 8. SEO & Performance

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 8.1 | Meta tags configured (title, description, og:image) | [ ] | P2 | For SaaS landing page (not the POS app itself) |
| 8.2 | `robots.txt` configured appropriately | [ ] | P2 | Disallow `/app/*` (authenticated routes), allow landing page |
| 8.3 | `sitemap.xml` generated for public pages | [ ] | P2 | Landing page, pricing, docs, blog |
| 8.4 | Lazy loading implemented for below-fold components | [~] | P2 | React 19 `lazy()` for modals (PaymentModal, AdminOverrideModal, etc.) |
| 8.5 | Bundle size optimized (tree shaking, code splitting) | [~] | P2 | Vite handles tree shaking; verify unused deps (lucide-react, xlsx) are tree-shaken |
| 8.6 | Image optimization (WebP, responsive sizes) | [ ] | P3 | For marketing pages; POS app has minimal images |
| 8.7 | CDN configured for static asset delivery | [ ] | P2 | Netlify/Vercel/Cloudflare automatically provides CDN |
| 8.8 | Caching headers configured for static assets | [ ] | P2 | Immutable cache for hashed JS/CSS bundles, short cache for HTML |
| 8.9 | Core Web Vitals targets met (LCP < 2.5s, FID < 100ms, CLS < 0.1) | [ ] | P2 | Measure in production with Lighthouse or Web Vitals library |

---

## 9. Accessibility (a11y)

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 9.1 | All form inputs have associated `<label>` elements | [~] | P2 | `Login.tsx:66-70` — labels present; audit all modals |
| 9.2 | All interactive elements are keyboard-navigable | [~] | P2 | `Login.tsx` uses `<form>` + Enter key; `PaymentModal.tsx:153` handles Enter |
| 9.3 | Focus management on modal open/close | [~] | P2 | `PaymentModal.tsx:24` — auto-focuses input on mount |
| 9.4 | Color contrast meets WCAG AA (4.5:1 for text) | [ ] | P2 | Audit Tailwind color classes: `text-gray-500` on `#f9fafb` may fail |
| 9.5 | `aria-label` on icon-only buttons | [ ] | P2 | `AdminOverrideModal.tsx:27` — close button uses `×` without aria-label |
| 9.6 | Screen reader testing (NVDA/VoiceOver) | [ ] | P2 | Test primary flows: login → add items → checkout → print receipt |
| 9.7 | Reduced motion support (`prefers-reduced-motion`) | [ ] | P3 | Tailwind animations in modals (`animate-[fadeIn_150ms]`) should respect preference |
| 9.8 | Error messages announced to screen readers (`role="alert"`) | [ ] | P2 | `Login.tsx:64` — error div should have `role="alert"` |

---

## 10. Backup & Recovery

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 10.1 | Supabase Point-in-Time Recovery (PITR) enabled | [ ] | **P0** | MED-003; requires Pro plan; enables restore to any point in last 7 days |
| 10.2 | Automated daily `pg_dump` to encrypted S3 bucket | [ ] | P1 | MED-003; store in different AWS region from Supabase project |
| 10.3 | RPO (Recovery Point Objective) defined and documented | [ ] | P1 | MED-003; target: ≤ 1 hour |
| 10.4 | RTO (Recovery Time Objective) defined and documented | [ ] | P1 | MED-003; target: ≤ 4 hours |
| 10.5 | Backup verification script (weekly automated test restore) | [ ] | P1 | MED-003; restore latest backup to staging, verify data integrity |
| 10.6 | Critical tables exported as CSV daily (secondary backup) | [ ] | P2 | `ventas`, `productos`, `inventario_sucursal`, `usuarios` |
| 10.7 | Database migration version control (all migrations in `supabase/migrations/`) | [x] | P1 | 4 migration files committed; schema tracked via `supabase_schema.sql` |
| 10.8 | Disaster recovery runbook documented | [ ] | P1 | Include: detection, escalation, restore procedure, stakeholder communication |
| 10.9 | Quarterly restoration drill scheduled | [ ] | P2 | Test full recovery from backup; time and document the process |
| 10.10 | Backup status monitoring with alerting | [ ] | P1 | Alert if backup fails 2+ consecutive days |

---

## 11. Infrastructure & DevOps

| # | Item | Status | Priority | Notes / Reference |
|---|------|--------|----------|-------------------|
| 11.1 | Production environment separated from staging | [ ] | **P0** | Separate Supabase projects for staging and production |
| 11.2 | CI/CD pipeline includes security checks (lint, audit, typecheck) | [~] | P1 | `npm run lint` configured; add `npm audit --audit-level=high` |
| 11.3 | Secrets management via Supabase Vault / Edge Function secrets | [ ] | **P0** | CRIT-003; all service keys, API keys in Vault, not in codebase |
| 11.4 | `.gitignore` verified to exclude all sensitive files | [~] | **P0** | Already excludes `.env.local`, `node_modules/`, `dist/`; verify `.env.production` excluded |
| 11.5 | Docker/container image scanning (if containerized) | [ ] | P2 | Not applicable if using Supabase hosted + Vercel/Netlify |
| 11.6 | Dependency vulnerability scanning in CI (Dependabot/Snyk) | [ ] | P1 | LOW-001; integrate `npm audit` or GitHub Dependabot |
| 11.7 | SBOM (Software Bill of Materials) generated | [ ] | P2 | `npm sbom` or CycloneDX |
| 11.8 | Immutable deployments (no hot-patching production) | [ ] | P1 | Use Vercel/Netlify deploy previews → promote to production |
| 11.9 | Blue-green or canary deployment strategy | [ ] | P2 | For zero-downtime deployments |
| 11.10 | Infrastructure-as-Code for reproducible environments | [~] | P2 | Supabase config in `supabase/config.toml`; deployment config TBD |

---

## 12. Pre-Launch Verification Steps

These steps must be completed and signed off before the production launch.

### 12.1 Security Verification

| # | Step | Owner | Date | Sign-off |
|---|------|-------|------|----------|
| 1 | All Critical findings (CRIT-001 through CRIT-005) resolved and re-tested | | | |
| 2 | All High findings (HIGH-001 through HIGH-007) resolved or accepted with compensating controls | | | |
| 3 | Third-party penetration test completed (or internal red team exercise) | | | |
| 4 | OWASP Top 10 (2021) checklist completed with no open items | | | |
| 5 | Dependency audit (`npm audit`) returns 0 critical/high findings | | | |
| 6 | All secrets rotated: Supabase service_role, Wompi event secret, Resend API key | | | |
| 7 | CSP tested in report-only mode, then enforced | | | |
| 8 | Wompi webhook tested end-to-end (signature verification, idempotency, error handling) | | | |
| 9 | Session timeout tested (idle → lock screen → auto-logout) | | | |
| 10 | Account lockout tested (>5 failed logins → account locked → audit event logged) | | | |

### 12.2 Functional Verification

| # | Step | Owner | Date | Sign-off |
|---|------|-------|------|----------|
| 1 | End-to-end POS flow: login → add items → payment (cash/card/mixed) → receipt → close shift | | | |
| 2 | Wompi payment flow: redirect → payment → webhook → order fulfillment | | | |
| 3 | Admin flows: override, inventory adjustment, price change, user management | | | |
| 4 | Multi-tenant isolation: Tenant A cannot see Tenant B data | | | |
| 5 | Email flows: sign-up confirmation, password reset, invitation | | | |
| 6 | Error scenarios: network failure, Supabase outage, Wompi timeout | | | |
| 7 | Print receipt works in all browsers (Chrome, Firefox, Edge, Safari) | | | |
| 8 | Tauri desktop app builds and runs on Windows | | | |

### 12.3 Performance Verification

| # | Step | Owner | Date | Sign-off |
|---|------|-------|------|----------|
| 1 | Login → Dashboard renders in <2 seconds on 4G connection | | | |
| 2 | Product search returns results in <500ms with 10,000 products | | | |
| 3 | Payment processing completes in <3 seconds (including hash computation) | | | |
| 4 | Concurrent sale handling tested (2 cashiers, same product, low stock) | | | |
| 5 | Database query performance reviewed (no sequential scans on hot paths) | | | |

---

## 13. Rollback Plan

### 13.1 Triggers for Rollback

A rollback should be initiated if any of the following occur within the first 24 hours of production:
- Critical security vulnerability discovered post-launch
- Data corruption detected in `ventas`, `productos`, or `inventario_sucursal`
- Wompi integration fails with > 5% transaction rate
- Authentication service unavailable for > 15 minutes
- > 5 user-reported data integrity issues

### 13.2 Rollback Procedure

| Step | Action | Owner | Time |
|------|--------|-------|------|
| 1 | Declare incident in #incidents channel | On-call engineer | T+0 |
| 2 | Assess: can issue be fixed forward? If fix time > 1h, proceed to rollback | Tech lead | T+15min |
| 3 | Revert DNS to point to previous stable deployment | DevOps | T+20min |
| 4 | Restore database to pre-deployment state (PITR to timestamp before deploy) | DevOps | T+30min |
| 5 | Verify: login, POS flow, Wompi payment on rolled-back version | QA | T+45min |
| 6 | Communicate "all clear" to stakeholders | Tech lead | T+60min |
| 7 | Post-mortem scheduled within 48 hours | Engineering manager | T+48h |

### 13.3 Rollback Decision Authority
- **Primary**: CTO / Technical Lead
- **Secondary**: Senior Backend Engineer (if TL unavailable)
- **Communication**: Slack #engineering, email to stakeholders@venxpos.com

---

## 14. Incident Response Plan (Outline)

### 14.1 Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|--------------|----------|
| **SEV1** | System down, data breach, financial loss in progress | 15 min | Production outage, active data exfiltration, Wompi payment fraud |
| **SEV2** | Major feature broken, performance degradation, security alert | 1 hour | Login failures, payment delays, suspicious activity detected |
| **SEV3** | Minor bug, cosmetic issue, non-critical alert | 24 hours | UI glitch, non-blocking error messages |

### 14.2 Incident Response Team

| Role | Primary | Secondary |
|------|---------|-----------|
| Incident Commander | Tech Lead | Senior Backend Engineer |
| Investigator | Backend Engineer | Full-stack Engineer |
| Communications | Engineering Manager | Product Manager |
| Recovery | DevOps Engineer | Backend Engineer |

### 14.3 Incident Response Process

```
DETECT → TRIAGE → CONTAIN → INVESTIGATE → REMEDIATE → RECOVER → POST-MORTEM
```

#### Detect
- Monitoring alerts (Supabase Logs, uptime monitoring)
- User reports (support@venxpos.com, in-app feedback)
- Automated security scanning alerts

#### Triage (First 15 minutes)
1. Incident Commander acknowledges alert in #incidents
2. Classify severity (SEV1/SEV2/SEV3)
3. Create incident channel (#incident-YYYY-MM-DD)
4. Assign roles (Investigator, Communications, Recovery)

#### Contain (First 1 hour)
1. For SEV1 data breach: rotate all secrets, revoke affected sessions, enable WAF rules
2. For SEV1 service outage: failover to backup, enable maintenance page
3. For SEV2: disable affected feature flag, apply temporary rate limit
4. Preserve all logs and forensic evidence

#### Investigate
1. Gather: Supabase logs, application logs (if structured logging implemented), database query logs
2. Determine: root cause, attack vector, data affected, timeline
3. Document findings in shared incident doc

#### Remediate
1. Apply fix to staging environment first
2. Test fix thoroughly
3. Deploy to production (or rollback if fix is complex)

#### Recover
1. Restore any affected data from backups
2. Verify system functionality (run pre-launch checklist items)
3. Remove temporary mitigations (maintenance page, feature flags)

#### Post-Mortem (Within 48 hours)
1. Document: timeline, root cause, impact, remediation, lessons learned
2. Create action items with owners and deadlines
3. Share with engineering team and stakeholders
4. Update this checklist and security documentation as needed

### 14.4 Incident Contact Information

| Contact | Method | Details |
|---------|--------|---------|
| Supabase Support | Dashboard | https://app.supabase.com/support |
| Wompi Support | Email/Phone | https://wompi.co/ayuda |
| Resend Support | Email | https://resend.com/help |
| Internal On-Call | Phone/Slack | TBD — rotate weekly |

### 14.5 Forensic Evidence Preservation

For SEV1 security incidents:
1. Take Supabase database snapshot immediately
2. Export all relevant `eventos_auditoria` rows
3. Capture Supabase Logs for the incident window
4. Preserve application server logs (Vercel/Netlify function logs)
5. Take screenshots of any suspicious UI behavior
6. **Do not** reboot or destroy any infrastructure until evidence is preserved

---

## 15. Compliance Checklist

### 15.1 Colombian Regulations

| Regulation | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| DIAN Resolución 000042/2020 | Electronic invoicing with CUFE hash | [ ] | HIGH-007 — server-computed hash needed for fiscal integrity |
| DIAN | 5-year retention of electronic documents | [ ] | Data retention policy + backup strategy |
| Ley 1581 de 2012 | Personal data protection (Habeas Data) | [ ] | Privacy policy, consent collection, right to deletion |
| Ley 527 de 1999 | Electronic signatures and data messages | [~] | Sale hash serves as electronic integrity mark |

### 15.2 International (If Applicable)

| Regulation | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| GDPR (EU customers) | Data protection, right to erasure, DPA | [ ] | Required if serving EU customers |
| PCI-DSS | Cardholder data protection | [ ] | Wompi handles card data; VenxPOS never touches raw card numbers |

---

## 16. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO / Technical Lead | | | |
| Lead Backend Engineer | | | |
| Lead Frontend Engineer | | | |
| DevOps / Infrastructure Engineer | | | |
| Security Reviewer | | | |
| Product Manager | | | |
| CEO / Stakeholder | | | |

**Launch Decision**: ☐ APPROVED / ☐ REJECTED / ☐ CONDITIONAL (see notes)

---

*This checklist must be completed in full before the production launch. Any P0 items marked incomplete are launch blockers. The completed and signed checklist must be archived for audit purposes.*
