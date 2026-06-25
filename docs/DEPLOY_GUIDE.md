# VenxPOS — Deployment Guide

**Version**: 1.0.0
**Date**: 2026-06-19
**Target**: Production launch on venxpos.com

---

## 1. Prerequisites

| Tool | Minimum Version | Check Command | Purpose |
|------|----------------|---------------|---------|
| Node.js | 20.x | `node --version` | Runtime for Vite, npm |
| npm | 10.x | `npm --version` | Package manager |
| Supabase CLI | 1.x | `npx supabase --version` | Database migrations, Edge Function deployment |
| Git | 2.x | `git --version` | Version control |
| Vercel CLI | Latest | `npx vercel --version` | Frontend deployment |

---

## 2. Environment Variables Setup

### 2.1 Frontend Variables (Vite)

Create `.env.production`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Wompi (public key only — safe for client)
VITE_WOMPI_PUBLIC_KEY=pub_prod_xxxxxxxxxxxxx

# App URL
VITE_APP_URL=https://venxpos.com

# Superadmin emails (comma-separated)
VITE_SUPERADMIN_EMAILS=admin@jgsoftworks.com
```

**Important:** Only `VITE_` prefixed variables are exposed to the frontend bundle. Never put secrets here.

### 2.2 Edge Function Secrets

Set via Supabase CLI (NOT in .env files):

```bash
# Navigate to project directory
cd venxpos-saas

# Link to production Supabase project
supabase link --project-ref your-project-ref

# Set all secrets
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_... \
  WOMPI_PRIVATE_KEY=prv_prod_xxxxxxxxxxxxx \
  WOMPI_EVENTS_SECRET=prod_events_xxxxxxxxxxxxx \
  WOMPI_INTEGRITY_SECRET=prod_integrity_xxxxxxxxxxxxx \
  RESEND_API_KEY=re_xxxxxxxxxxxxx \
  INTERNAL_API_KEY=your-internal-api-key
```

### 2.3 Verify Secrets

```bash
supabase secrets list
```

Expected output should list all 6 secrets.

---

## 3. Supabase Project Configuration

### 3.1 Auth Settings

In Supabase Dashboard → Authentication → Settings:

| Setting | Value | Notes |
|---------|-------|-------|
| Site URL | `https://venxpos.com` | Production domain |
| Redirect URLs | `https://venxpos.com/**` | All routes on production domain |
| JWT Expiry | 3600 (1 hour) | Consider 1800 (30 min) for tighter security |
| Enable refresh token rotation | **ON** | Already enabled by default |
| Minimum password length | 10 | Increase from default 6 |
| Password requirements | `lower_upper_letters_digits_symbols` | Require complex passwords |
| Enable email confirmations | **ON** | Verify email ownership |
| Enable sign-ups | **ON** | Allow self-service registration |
| SMTP Provider | Resend | See section 3.2 |
| CAPTCHA | **ON** (hCaptcha or Turnstile) | Protect sign-up/login endpoints |

### 3.2 Resend SMTP Configuration

In Supabase Dashboard → Authentication → Email:

```
SMTP Host:     smtp.resend.com
SMTP Port:     465 (TLS) or 587 (STARTTLS)
SMTP User:     resend
SMTP Password: re_xxxxxxxxxxxxx (your Resend API key)
Sender Name:   VenxPOS
Sender Email:  noreply@venxpos.com
```

**Important:** Verify your domain (`venxpos.com`) in the Resend dashboard before sending production emails.

### 3.3 API Settings

| Setting | Value |
|---------|-------|
| API exposed | **ON** (required for PostgREST) |
| Additional redirect URLs | `https://venxpos.com/**`, `venxpos://**` (Tauri deep link) |

---

## 4. Database Migration Deployment

### 4.1 Deploy Migration to Production

```bash
# Link to production project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push

# Verify migration was applied
supabase db diff --linked
```

### 4.2 Expected Result

After migration, the following should exist in production:
- 7 new tables: `plans`, `tenants`, `subscriptions`, `subscription_events`, `payments`, `branch_accounts`, `superadmins`
- `empresas.tenant_id` column (nullable)
- 5 SECURITY DEFINER functions
- 3 auto-update triggers
- 22 indexes
- 4 seed plan records
- RLS enabled on all 7 new tables
- RLS policies on all 7 new tables

### 4.3 Verify in Supabase Dashboard

Go to Table Editor and confirm:
1. All 7 tables appear with correct columns and types
2. `plans` table has 4 rows (Básico, Estándar, Pro, Empresarial)
3. RLS is "Enabled" on each table
4. Policies are listed under "Authentication" → "Policies"

---

## 5. Edge Function Deployment

### 5.1 Deploy All Functions

```bash
# Deploy all Edge Functions
supabase functions deploy create-payment
supabase functions deploy wompi-webhook

# For future functions:
# supabase functions deploy process-renewals
# supabase functions deploy send-email
# supabase functions deploy get-admin-kpis
# supabase functions deploy get-tenant-stats
```

### 5.2 Verify Deployment

```bash
supabase functions list
```

Expected output:
```
create-payment    v1    https://your-project-ref.supabase.co/functions/v1/create-payment
wompi-webhook     v1    https://your-project-ref.supabase.co/functions/v1/wompi-webhook
```

### 5.3 Test Edge Functions

```bash
# Test create-payment (requires JWT)
curl -X POST https://your-project-ref.supabase.co/functions/v1/create-payment \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"token":"tok_test_123","amountInCents":80000,"tenantId":"uuid-here","planId":"uuid-here","customerEmail":"test@test.com","acceptanceToken":"tok_...","personalAuthToken":"tok_..."}'

# Test wompi-webhook (simulated)
curl -X POST https://your-project-ref.supabase.co/functions/v1/wompi-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"transaction.updated","data":{"transaction":{"id":"tx-test","reference":"VENX-test","amount_in_cents":80000,"status":"APPROVED","payment_source_id":"123"}},"signature":{"properties":["transaction.id","transaction.status","transaction.amount_in_cents"],"checksum":"test"},"timestamp":1234567890,"sent_at":"2026-06-19T00:00:00Z"}'
```

---

## 6. Vercel Deployment Steps

### 6.1 First Deployment

```bash
# Install Vercel CLI globally (optional)
npm install -g vercel

# Or use npx
npx vercel login

# Deploy to preview
npx vercel

# Deploy to production
npx vercel --prod
```

### 6.2 Environment Variables in Vercel

In Vercel Dashboard → Project Settings → Environment Variables, add:

| Name | Value | Environments |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://your-project-ref.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Production, Preview |
| `VITE_WOMPI_PUBLIC_KEY` | `pub_prod_...` | Production |
| `VITE_APP_URL` | `https://venxpos.com` | Production |
| `VITE_SUPERADMIN_EMAILS` | `admin@jgsoftworks.com` | Production |

For preview/staging, use sandbox Wompi keys:
| `VITE_WOMPI_PUBLIC_KEY` | `pub_test_...` | Preview |

### 6.3 Build Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | 20.x |

### 6.4 Vercel Configuration File

The `vercel.json` in the project root handles:
- SPA routing (all paths → index.html)
- Security headers (CSP, X-Frame-Options, etc.)
- Already configured in the repository.

---

## 7. Wompi Webhook URL Configuration

### 7.1 Production

In Wompi Dashboard (comercios.wompi.co → Configuración → Webhooks):

```
URL de producción: https://your-project-ref.supabase.co/functions/v1/wompi-webhook
Eventos: transaction.updated
```

### 7.2 Test the Webhook

Wompi provides a "Send Test Event" button in the webhook configuration page. Use it to send a test `transaction.updated` event and verify the Edge Function receives and processes it.

### 7.3 Verify Webhook in Supabase Logs

```bash
supabase functions logs wompi-webhook
```

Look for:
- `Tenant {id} activated` (successful activation)
- `Payment not found` (unknown reference)
- `Invalid signature` (events secret mismatch)
- `Amount mismatch` (tampering detected)

---

## 8. Post-Deploy Verification Checklist

### Authentication

- [ ] Visit `https://venxpos.com/login` — page loads
- [ ] Test registration flow with a test email
- [ ] Registration creates `tenants` record with `estado = pending_payment`
- [ ] Check Supabase Auth dashboard for the new user
- [ ] Email confirmation sent (if enabled)
- [ ] Test login with valid credentials → redirected to `/pago`
- [ ] Test login with invalid credentials → error message displayed

### Payment

- [ ] Visit `/pago` as a `pending_payment` tenant — payment page loads
- [ ] Wompi widget renders correctly
- [ ] Use test card `4242 4242 4242 4242` to make a payment
- [ ] Check Supabase: `payments` record created with `status = approved`
- [ ] Check Supabase: `empresas` record created
- [ ] Check Supabase: `subscriptions` record created with `estado = active`
- [ ] Check Supabase: `tenants.estado` changed to `active`
- [ ] User redirected to `/dashboard`

### Client Dashboard

- [ ] Dashboard loads with correct tenant info
- [ ] Subscription page shows plan details and billing dates
- [ ] Branches page shows branch list
- [ ] Can create a new branch account
- [ ] Branch account appears in `branch_accounts` table

### Superadmin Dashboard

- [ ] Login with superadmin email → redirected to `/admin`
- [ ] Admin dashboard shows KPIs (MRR, active clients, etc.)
- [ ] Clients table shows all tenants
- [ ] Payments table shows all payments

### Security Headers

- [ ] `curl -I https://venxpos.com` shows CSP header
- [ ] `X-Frame-Options: DENY` present
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present
- [ ] CSP includes Wompi domains for scripts and frames

### HTTPS

- [ ] `https://venxpos.com` serves with valid SSL certificate
- [ ] HTTP redirects to HTTPS
- [ ] No mixed content warnings in browser console

---

## 9. Domain Setup (venxpos.com)

### 9.1 Vercel Custom Domain

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add `venxpos.com`
3. Follow Vercel's instructions for DNS configuration

### 9.2 DNS Records

Add these DNS records at your domain registrar:

```
Type    Name    Value                        TTL
A       @       76.76.21.21                  Auto
CNAME   www     cname.vercel-dns.com         Auto
```

Or use Vercel's nameservers for automatic DNS management.

### 9.3 Resend Domain Verification

In Resend Dashboard → Domains → Add Domain:
1. Add `venxpos.com`
2. Follow the DNS verification instructions (TXT, MX, DKIM records)
3. Wait for verification (can take up to 24 hours)

### 9.4 Supabase Custom Domain (Optional)

Supabase supports custom domains for API endpoints. This is optional but recommended for production:
1. In Supabase Dashboard → Settings → Custom Domains
2. Add `api.venxpos.com`
3. Configure DNS accordingly

---

## 10. Go-Live Steps

### Step 1: Pre-Launch (1 Week Before)

- [ ] All P0 items in PRODUCTION_READINESS.md resolved
- [ ] Production environment fully configured
- [ ] Database migrations applied to production
- [ ] Edge Functions deployed and tested
- [ ] Wompi production keys acquired
- [ ] Resend domain verified
- [ ] Vercel production deploy tested
- [ ] SSL certificates active
- [ ] Backup strategy confirmed
- [ ] Rollback plan rehearsed

### Step 2: Launch Day

- [ ] Deploy Vercel to production domain
- [ ] Set Wompi webhook URL to production endpoint
- [ ] Update Wompi to production keys (Edge Function + Frontend)
- [ ] Verify registration + payment flow end-to-end
- [ ] Verify superadmin access
- [ ] Monitor logs for first 4 hours
- [ ] Announce launch to stakeholders

### Step 3: Post-Launch (First 48 Hours)

- [ ] Monitor Supabase dashboard for errors
- [ ] Monitor Wompi dashboard for transaction success rate
- [ ] Check Vercel analytics for traffic
- [ ] Respond to any user-reported issues
- [ ] Verify recurring payment cron is active (if implemented)

---

## 11. Rollback Procedure

If the production deployment causes critical issues:

### Frontend Rollback (Vercel)

```bash
# List deployments
npx vercel list

# Rollback to previous deployment
npx vercel rollback

# Or use Vercel Dashboard:
# Project → Deployments → Select previous deploy → "Promote to Production"
```

### Database Rollback

Supabase PITR (Point-in-Time Recovery):
1. Go to Supabase Dashboard → Database → Backups
2. Select a restore point before the problematic deployment
3. Restore to a new project (safer) or overwrite existing

### Edge Function Rollback

```bash
# Deploy previous version
supabase functions deploy function-name --no-verify-jwt
```

---

## 12. Monitoring Setup

### Supabase Dashboard

Monitor regularly:
- **Database**: Query performance, connection pool, disk usage
- **Auth**: Sign-up rate, login success rate, total users
- **Edge Functions**: Invocation count, error rate, response time
- **Logs**: PostgREST, Auth, Storage, Edge Functions

### Vercel Analytics

- Page views and unique visitors
- Core Web Vitals (LCP, FID, CLS)
- Function invocation counts

### External Monitoring (Recommended)

Set up an external health check:
- **Uptime**: `https://venxpos.com/api/health` (public endpoint)
- **Service**: UptimeRobot (free), Better Uptime, or Pingdom
- **Interval**: Every 60 seconds
- **Alert**: Email/Slack if down for > 2 minutes

---

*End of Deployment Guide*
