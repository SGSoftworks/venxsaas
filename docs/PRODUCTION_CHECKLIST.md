# VenxPOS — Production Launch Checklist

**Version**: 1.0.0
**Target Launch Date**: TBD
**This checklist must be fully completed before going live.**

---

## How to Use

- [ ] = Not completed / Not started
- [x] = Completed and verified
- [~] = In progress / Partially complete
- **P0** = Launch blocker (must be done)
- **P1** = Required within first week post-launch
- **P2** = Required within first month

---

## 1. Infrastructure & Hosting

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 1.1 | Supabase production project created | [ ] | **P0** | | Separate from staging |
| 1.2 | Supabase Pro plan active (for PITR backups) | [ ] | **P0** | | Required for backup strategy |
| 1.3 | Database migrations deployed to production | [ ] | **P0** | | `supabase db push` |
| 1.4 | Migrations verified (7 tables, 5 functions, 3 triggers, 22 indexes) | [ ] | **P0** | | Check Table Editor |
| 1.5 | Seed data verified (4 plans present) | [ ] | **P0** | | Check `plans` table |
| 1.6 | Vercel project created and linked | [ ] | **P0** | | |
| 1.7 | Vercel production deployment tested | [ ] | **P0** | | `npx vercel --prod` |
| 1.8 | Custom domain configured (venxpos.com) | [ ] | **P0** | | Vercel → Settings → Domains |
| 1.9 | DNS records configured | [ ] | **P0** | | A record + CNAME for www |
| 1.10 | SSL certificates active | [ ] | **P0** | | Auto-provisioned by Vercel |
| 1.11 | Environment variables set in Vercel | [ ] | **P0** | | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WOMPI_PUBLIC_KEY`, `VITE_APP_URL`, `VITE_SUPERADMIN_EMAILS` |
| 1.12 | Edge Function secrets set in Supabase | [ ] | **P0** | | All 6 secrets verified |
| 1.13 | Edge Functions deployed to production | [ ] | **P0** | | `create-payment`, `wompi-webhook` |
| 1.14 | Edge Functions tested (curl) | [ ] | **P0** | | |
| 1.15 | CORS configured for production domain | [ ] | **P0** | | |

---

## 2. Security

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 2.1 | RLS policies verified on all 22 tables | [ ] | **P0** | | Run RLS audit |
| 2.2 | RLS cross-tenant isolation tested | [ ] | **P0** | | Tenant A cannot see Tenant B data |
| 2.3 | CSP headers verified in production | [ ] | **P0** | | `curl -I https://venxpos.com` |
| 2.4 | Security headers present (X-Frame-Options, X-Content-Type-Options, etc.) | [ ] | **P0** | | |
| 2.5 | CSP includes Wompi domains | [ ] | **P0** | | Script, frame, connect |
| 2.6 | Supabase anon key is production key | [ ] | **P0** | | Not staging/dev key |
| 2.7 | Supabase service_role key not in frontend | [ ] | **P0** | | Verify: `npm run build` → search bundle for `service_role` |
| 2.8 | Wompi private key only in Edge Function secrets | [ ] | **P0** | | Never in frontend env |
| 2.9 | Wompi events secret set | [ ] | **P0** | | |
| 2.10 | Wompi integrity secret set | [ ] | **P0** | | |
| 2.11 | Resend API key set | [ ] | **P0** | | |
| 2.12 | Source maps disabled in production build | [ ] | P1 | | `vite.config.ts: sourcemap: false` |
| 2.13 | `.env` files not included in build | [x] | **P0** | | `.gitignore` already configured |
| 2.14 | Rate limiting configured (Supabase Auth) | [ ] | P1 | | |
| 2.15 | Password minimum length ≥ 10 | [ ] | P1 | | Supabase Auth settings |
| 2.16 | Password complexity requirements enforced | [ ] | P1 | | |
| 2.17 | CAPTCHA enabled on signup | [ ] | P1 | | |
| 2.18 | Email confirmations enabled | [ ] | P1 | | |

---

## 3. Payments (Wompi)

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 3.1 | Wompi production keys acquired | [ ] | **P0** | | Requires business verification |
| 3.2 | Production public key in Vercel env | [ ] | **P0** | | `VITE_WOMPI_PUBLIC_KEY=pub_prod_*` |
| 3.3 | Production private key in Supabase secrets | [ ] | **P0** | | |
| 3.4 | Production events secret in Supabase secrets | [ ] | **P0** | | |
| 3.5 | Production integrity secret in Supabase secrets | [ ] | **P0** | | |
| 3.6 | Webhook URL configured in Wompi dashboard | [ ] | **P0** | | `https://{ref}.supabase.co/functions/v1/wompi-webhook` |
| 3.7 | Webhook signature verification tested | [ ] | **P0** | | Use Wompi's test webhook feature |
| 3.8 | End-to-end payment flow tested (production keys) | [ ] | **P0** | | Real card, real transaction |
| 3.9 | Declined payment flow tested | [ ] | P1 | | |
| 3.10 | Webhook idempotency verified | [ ] | P1 | | Send duplicate webhook |
| 3.11 | Amount mismatch detection tested | [ ] | P1 | | |
| 3.12 | Payment reconciliation procedure documented | [ ] | P1 | | |

---

## 4. Email (Resend)

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 4.1 | Resend account created | [ ] | P1 | | |
| 4.2 | Domain verified (venxpos.com) | [ ] | P1 | | DNS TXT + DKIM + MX |
| 4.3 | Supabase SMTP configured with Resend | [ ] | P1 | | |
| 4.4 | Test email sent and received | [ ] | P1 | | Password reset, confirmation |
| 4.5 | Email templates created/approved | [ ] | P1 | | Welcome, activation, renewal, invoice |
| 4.6 | Bounce/complaint handling configured | [ ] | P2 | | Resend webhook |

---

## 5. Application Functionality

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 5.1 | Registration flow tested end-to-end | [ ] | **P0** | | Full QA test cases |
| 5.2 | Initial payment + activation tested | [ ] | **P0** | | |
| 5.3 | Client dashboard loads correctly | [ ] | **P0** | | |
| 5.4 | Subscription page shows correct data | [ ] | **P0** | | |
| 5.5 | Branch creation and management works | [ ] | **P0** | | |
| 5.6 | Plan limit enforcement works | [ ] | **P0** | | |
| 5.7 | Superadmin dashboard loads correctly | [ ] | **P0** | | |
| 5.8 | Admin KPIs display correct values | [ ] | **P0** | | |
| 5.9 | Client management (filter, view) works | [ ] | **P0** | | |
| 5.10 | Payment history visible and filterable | [ ] | **P0** | | |
| 5.11 | Login/logout flow tested | [ ] | **P0** | | |
| 5.12 | Route protection verified (all guards) | [ ] | **P0** | | |
| 5.13 | Landing page loads with animations | [ ] | P1 | | |
| 5.14 | All forms validate correctly | [ ] | P1 | | |
| 5.15 | Error states handled gracefully | [ ] | P1 | | |
| 5.16 | Loading states present | [ ] | P1 | | |
| 5.17 | Toast notifications work | [ ] | P1 | | |
| 5.18 | Mobile responsive (all pages) | [ ] | P2 | | |

---

## 6. Data & Backups

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 6.1 | Supabase PITR enabled and active | [ ] | **P0** | | Requires Pro plan |
| 6.2 | Daily pg_dump backup script configured | [ ] | P1 | | GitHub Actions or external |
| 6.3 | Backup storage configured (S3) | [ ] | P1 | | |
| 6.4 | Backup restoration tested | [ ] | P1 | | | Restore to staging |
| 6.5 | Critical CSV export configured | [ ] | P2 | | Weekly |
| 6.6 | RPO defined (≤ 5 min with PITR) | [ ] | P1 | | |
| 6.7 | RTO defined (≤ 4 hours) | [ ] | P1 | | |
| 6.8 | Disaster recovery runbook written | [ ] | P1 | | |

---

## 7. Monitoring & Observability

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 7.1 | Supabase health monitoring active | [ ] | P1 | | Dashboard |
| 7.2 | Vercel analytics enabled | [ ] | P1 | | Web Vitals + traffic |
| 7.3 | Uptime monitoring configured | [ ] | P1 | | UptimeRobot, Better Uptime |
| 7.4 | Error alerting configured | [ ] | P2 | | Sentry, LogRocket |
| 7.5 | Database connection pool monitored | [ ] | P2 | | Supabase Dashboard |
| 7.6 | Edge Function logs monitored | [ ] | P1 | | `supabase functions logs` |
| 7.7 | Payment failure alert configured | [ ] | P1 | | |
| 7.8 | Security alerting pipeline | [ ] | P2 | | |
| 7.9 | Dashboard for key metrics (internal) | [ ] | P2 | | |

---

## 8. SEO & Analytics

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 8.1 | Meta tags complete (title, description, og, twitter) | [ ] | P1 | | |
| 8.2 | JSON-LD structured data added | [ ] | P1 | | |
| 8.3 | `sitemap.xml` generated | [ ] | P1 | | Place in `public/` |
| 8.4 | `robots.txt` configured | [ ] | P1 | | Place in `public/` |
| 8.5 | Google Search Console registered | [ ] | P1 | | Submit sitemap |
| 8.6 | Google Analytics / Vercel Analytics active | [ ] | P1 | | |
| 8.7 | OG image created (1200×630px) | [ ] | P2 | | |

---

## 9. Legal & Compliance

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 9.1 | Terms of service page deployed | [ ] | P1 | | `/terminos` |
| 9.2 | Privacy policy page deployed | [ ] | P1 | | `/privacidad` |
| 9.3 | Cookie policy (if applicable) | [ ] | P2 | | |
| 9.4 | Data processing agreement (for EU customers) | [ ] | P2 | | |
| 9.5 | Wompi terms acceptance flow in checkout | [x] | **P0** | | Acceptance tokens fetched and displayed |
| 9.6 | Colombian data protection (Ley 1581) compliance review | [ ] | P2 | | |
| 9.7 | Dian electronic invoicing compliance path documented | [ ] | P2 | | |

---

## 10. Admin & Seed Data

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 10.1 | Superadmin user created in production | [ ] | **P0** | | Insert into `superadmins` table |
| 10.2 | Superadmin login tested | [ ] | **P0** | | |
| 10.3 | Default plans seeded (4 plans) | [x] | **P0** | | Migration handles this |
| 10.4 | Plan prices verified for production | [ ] | P1 | | Adjust if needed |
| 10.5 | Test data cleaned from production DB | [ ] | **P0** | | |

---

## 11. Performance

| # | Item | Status | Priority | Owner | Notes |
|---|------|--------|----------|-------|-------|
| 11.1 | Lighthouse audit (Performance > 90) | [ ] | P1 | | |
| 11.2 | Lighthouse audit (Accessibility > 90) | [ ] | P1 | | |
| 11.3 | Lighthouse audit (Best Practices > 90) | [ ] | P1 | | |
| 11.4 | Lighthouse audit (SEO > 90) | [ ] | P1 | | |
| 11.5 | Bundle size analyzed | [~] | P2 | | Code splitting configured |
| 11.6 | Image optimization verified | [ ] | P2 | | |
| 11.7 | Cache headers verified | [ ] | P2 | | Vercel defaults |
| 11.8 | Database queries EXPLAIN ANALYZE verified | [ ] | P2 | | Index usage confirmed |
| 11.9 | Load testing baseline (100 concurrent users) | [ ] | P2 | | |

---

## 12. Pre-Launch Verification

### 12.1 Critical Path Test (Run 24h Before Launch)

| # | Step | Result | Tester | Date |
|---|------|--------|--------|------|
| 1 | Register new tenant with real email | PASS / FAIL | | |
| 2 | Complete payment (production Wompi) | PASS / FAIL | | |
| 3 | Verify tenant activation (empresa, subscription, events) | PASS / FAIL | | |
| 4 | Login to client dashboard | PASS / FAIL | | |
| 5 | Create branch account | PASS / FAIL | | |
| 6 | Verify plan limit enforcement | PASS / FAIL | | |
| 7 | Login as superadmin | PASS / FAIL | | |
| 8 | View admin KPIs (correct values) | PASS / FAIL | | |
| 9 | View clients list (all tenants visible) | PASS / FAIL | | |
| 10 | View payments list (all payments visible) | PASS / FAIL | | |
| 11 | Logout and session clear | PASS / FAIL | | |
| 12 | Verify all route guards | PASS / FAIL | | |
| 13 | Verify CSP and security headers | PASS / FAIL | | |
| 14 | Verify HTTPS (no mixed content) | PASS / FAIL | | |

### 12.2 Security Sign-Off

| # | Item | Sign-off |
|---|------|----------|
| 1 | All P0 security items resolved | |
| 2 | RLS audit complete | |
| 3 | Cross-tenant isolation verified | |
| 4 | Webhook signature verification active | |
| 5 | Secrets rotated (production keys) | |
| 6 | No secrets in frontend bundle | |

---

## 13. Rollback Plan

| # | Step | Time | Owner |
|---|------|------|-------|
| 1 | Declare incident | T+0 | On-call |
| 2 | Assess: fix forward or rollback? | T+15 min | Tech lead |
| 3 | Revert Vercel deployment | T+20 min | DevOps |
| 4 | Restore DB via PITR (if needed) | T+30 min | DevOps |
| 5 | Verify system functionality | T+45 min | QA |
| 6 | Communicate "all clear" | T+60 min | Tech lead |
| 7 | Post-mortem scheduled | T+48h | Engineering manager |

### Rollback Decision Triggers
- Critical security vulnerability discovered post-launch
- Data corruption detected
- Wompi integration fails with > 5% failure rate
- Authentication service unavailable for > 15 minutes
- > 5 user-reported data integrity issues in first 24 hours

---

## 14. Go-Live Decision

### Decision Matrix

| Condition | Required | Status |
|-----------|----------|--------|
| All P0 items completed | YES | [ ] |
| Critical path test passed (all steps) | YES | [ ] |
| Security sign-off obtained | YES | [ ] |
| Rollback plan rehearsed | YES | [ ] |
| Backup verified (restore tested) | YES | [ ] |
| Team on standby for 48h post-launch | YES | [ ] |

### Decision

- [ ] **APPROVED** — All conditions met, proceed with launch
- [ ] **CONDITIONAL** — Launch with noted exceptions (document below)
- [ ] **REJECTED** — Critical blocking issues, reschedule launch

### Exceptions / Conditions (if conditional)

```
[Document any exceptions here]
```

### Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| CTO / Technical Lead | | | |
| Lead Backend Engineer | | | |
| Lead Frontend Engineer | | | |
| DevOps Engineer | | | |
| Security Reviewer | | | |
| Product Manager | | | |
| CEO / Stakeholder | | | |

---

*This checklist must be archived after launch for audit purposes.*
