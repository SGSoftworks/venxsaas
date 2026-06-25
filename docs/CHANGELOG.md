# Changelog

All notable changes to the VenxPOS SaaS platform will be documented in this file.

---

## [1.0.0] - 2026-06-19

### Added
- Initial SaaS platform release
- Multi-tenant architecture with Supabase PostgreSQL
- 7 new database tables: `plans`, `tenants`, `subscriptions`, `subscription_events`, `payments`, `branch_accounts`, `superadmins`
- `empresas.tenant_id` column linking POS data to SaaS tenants
- Professional landing page with GSAP scroll-triggered animations
- Pricing section with dynamic plan data from database
- User registration flow with plan selection
- JWT-based authentication with Supabase Auth
- Client dashboard with navigation, subscription details, and branch management
- Branch account creation with plan limit enforcement
- AuthGuard and SuperAdminGuard route protection components
- Wompi payment integration (sandbox and production)
  - Inline widget card tokenization (frontend)
  - Server-side payment source and transaction creation (Edge Function)
  - Webhook handler with SHA-256 signature verification
  - Idempotency protection against duplicate webhook events
  - Amount verification against database records
  - Automatic tenant activation on successful payment
  - Declined payment handling with retry support
- Supabase Edge Functions (2 implemented, 4 planned)
  - `create-payment`: Card tokenization → payment source → transaction → DB record
  - `wompi-webhook`: Webhook signature verification → tenant activation / renewal processing
- PostgreSQL functions (5 functions)
  - `get_tenant_id()`: Resolve tenant from authenticated user
  - `is_superadmin()`: Check superadmin status
  - `count_branches_for_tenant()`: Enforce plan branch limits
  - `activate_tenant()`: Full activation transaction (payment → empresa → subscription → events)
  - `process_renewal()`: Monthly subscription renewal processing
- Row-Level Security on all 22 tables
  - 7 new SaaS tables with full policy sets
  - 15 existing POS tables with verified policies
  - Service role bypass for backend operations
- Superadmin dashboard
  - Platform KPIs (MRR, active clients, revenue, branches, conversion rate)
  - Client management table with filtering and status management
  - Payment records table with full transaction history
- Zustand state management
  - `useAuthStore`: Session, user, tenant, plan, subscription, superadmin state
  - `useUIStore`: Sidebar toggle, toast notifications
- Form validation with react-hook-form + zod
  - Login form schema
  - Registration form schema (multi-step)
  - Branch creation form schema
- Reusable utilities
  - Currency formatting (COP)
  - Date formatting (es-CO locale)
  - Status badge colors and labels
  - Tailwind class merging utility
- Security headers via Vercel deployment config
  - Content-Security-Policy (CSP) with Wompi domain allowlisting
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: restricted
- Vite build optimization
  - Code splitting: vendor, supabase, animation chunks
  - Source maps disabled in production
  - Path alias: `@` → `src/`
- Comprehensive documentation suite (16 documents)
- Professional PostCSS + Tailwind CSS 4 styling
- Vercel deployment configuration with SPA routing

### Security
- Full security audit completed (18 findings: 5 Critical, 7 High, 4 Medium, 2 Low)
- Risk analysis matrix with attack vector enumeration
- Production readiness checklist with 250+ verification items
- RLS on all tables with 4-tier access control (service_role, superadmin, tenant_owner, branch_user)
- Webhook signature verification (SHA-256 with Wompi events secret)
- CSRF protection headers
- CSP configuration with Wompi/Resend/Supabase domain allowlisting
- JWT auto-refresh and session persistence
- Password validation with zod (min 8 chars, email format)
- Input sanitization via React JSX escaping
- Parameterized PostgreSQL functions (no dynamic SQL injection)
- SECURITY DEFINER functions with `SET search_path = ''` protection
- Environment variable separation: frontend (VITE_*) vs Edge Function secrets
- Private Wompi keys never exposed to frontend
- `wompi_reference` UNIQUE constraint preventing duplicate payments
- Idempotent webhook processing

### Known Limitations (v1.0)
- No email verification on signup (disabled in Supabase Auth config)
- No CAPTCHA on registration/login forms
- No account lockout after failed login attempts
- No automated test suite (manual testing only)
- Wompi recurring payments not automated (cron not yet implemented)
- No payment retry logic for declined recurring charges
- Plan limit enforcement is client-side only (no DB trigger)
- No tenant self-cancellation flow
- No plan change flow
- No invoice/PDF generation
- Admin KPIs calculated client-side (not cached)
- Single payment provider (Wompi only)

---

*Changelog format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).*
