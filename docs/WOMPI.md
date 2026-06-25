# VenxPOS — Wompi Integration Guide

**Version**: 1.0.0
**Date**: 2026-06-19
**Gateway**: Wompi (Colombia)

---

## 1. Sandbox vs Production Configuration

| Setting | Sandbox | Production |
|---------|---------|------------|
| API Base URL | `https://sandbox.wompi.co/v1` | `https://production.wompi.co/v1` |
| Widget URL | `https://checkout.wompi.co` | `https://checkout.wompi.co` |
| Public Key | `pub_test_*` | `pub_prod_*` |
| Private Key | `prv_test_*` | `prv_prod_*` |
| Events Secret | `test_events_*` | `prod_events_*` |
| Integrity Secret | `test_integrity_*` | `prod_integrity_*` |
| Webhook Source IPs | Same as production | `34.196.85.2`, `3.225.110.72`, `52.87.190.255` |
| Dashboard | `https://comercios.wompi.co` | `https://comercios.wompi.co` |

### Identifying Key Types

```
Public:  starts with "pub_test_" or "pub_prod_"
Private: starts with "prv_test_" or "prv_prod_"
Events:  starts with "test_events_" or "prod_events_"
Integrity: starts with "test_integrity_" or "prod_integrity_"
```

---

## 2. Required API Keys

| Key | Environment Variable | Where Used | Exposure |
|-----|---------------------|------------|----------|
| Public Key | `VITE_WOMPI_PUBLIC_KEY` | Frontend (WompiWidget) | Safe for client |
| Private Key | `WOMPI_PRIVATE_KEY` | Edge Functions only | NEVER expose |
| Events Secret | `WOMPI_EVENTS_SECRET` | Edge Functions only | NEVER expose |
| Integrity Secret | `WOMPI_INTEGRITY_SECRET` | Edge Functions only | NEVER expose |

### VenxPOS Configuration

```
# Frontend (.env)
VITE_WOMPI_PUBLIC_KEY=pub_test_xxxxxxxxxxxxx

# Edge Function secrets (set via Supabase CLI)
supabase secrets set WOMPI_PRIVATE_KEY=prv_test_xxxxxxxxxxxxx
supabase secrets set WOMPI_EVENTS_SECRET=test_events_xxxxxxxxxxxxx
supabase secrets set WOMPI_INTEGRITY_SECRET=test_integrity_xxxxxxxxxxxxx
```

---

## 3. How to Get Keys from comercios.wompi.co

### Step-by-Step

1. Go to [https://comercios.wompi.co](https://comercios.wompi.co)
2. Create an account or log in
3. Navigate to **Configuración** → **Llaves API**
4. You will see two environments: **Sandbox** (Pruebas) and **Producción**

### Sandbox Keys (Available Immediately)

- **Llave pública (Public Key)**: `pub_test_*` — visible by default
- **Llave privada (Private Key)**: `prv_test_*` — click to reveal
- **Eventos (Events Secret)**: Click to configure webhooks, copy secret
- **Integridad (Integrity Secret)**: Click to configure, copy secret

### Production Keys (Requires Business Verification)

Wompi requires:
- Completed business profile (legal name, NIT, address)
- Bank account for payouts
- Valid email and phone verification
- Signed contract/terms acceptance

Production keys are issued after Wompi reviews and approves the account.

---

## 4. Integration Flow Diagrams

### 4.1 Initial Payment Flow

```
  REGISTRATION          FRONTEND                EDGE FUNCTION              WOMPI API              WEBHOOK
────────────────────────────────────────────────────────────────────────────────────────────────────────────
  User signs up
  tenant created
  (estado=pending)
        │
        ▼
  Redirect to /pago
        │
        ▼
  ┌──────────────────┐
  │ Get acceptance   │
  │ tokens from      │
  │ Wompi public key │────────────────────────────────────────────────────>
  │ (frontend safe)  │                              GET /merchants/{pub_key}
  └────────┬─────────┘                              Return: acceptance_token,
           │                                        personal_auth_token,
           ▼                                        permalinks
  ┌──────────────────┐
  │ Mount Wompi      │
  │ Widget iframe    │
  │                  │
  │ Parameters:      │
  │  - public_key    │
  │  - amount_in_c   │
  │  - currency=COP  │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ User enters card │
  │ details in       │
  │ Wompi iframe     │
  │ (card #, exp,    │
  │  cvv, name)      │
  └────────┬─────────┘
           │
           ▼
  Widget returns
  card token
  (tok_test_*)
           │
           ▼
  ┌──────────────────┐
  │ POST to Edge     │
  │ Function         │
  │ /create-payment  │
  │                  │
  │ Body:             │
  │  token            │
  │  tenantId         │
  │  planId           │
  │  amountInCents    │
  │  customerEmail    │
  │  acceptanceToken  │
  │  personalAuthTok  │
  │                  │
  │ Headers:          │
  │  Authorization:   │
  │    Bearer {JWT}   │
  └────────┬─────────┘
           │
           ▼
           ┌─────────────────────────────────────┐
           │ 1. Validate JWT + get user           │
           │ 2. POST /payment_sources             │
           │    { type: CARD, token,              │
           │      customer_email,                 │
           │      acceptance_token,               │
           │      accept_personal_auth }          │
           │                                     │
           │ 3. Receive payment_source_id         │
           │                                     │
           │ 4. Generate reference:               │
           │    VENX-{tenant[0:8]}-{timestamp}    │
           │                                     │
           │ 5. Generate integrity signature:     │
           │    SHA256(ref + amount + COP + sec)  │
           │                                     │
           │ 6. POST /transactions                │
           │    { amount_in_cents, currency,      │
           │      customer_email, reference,      │
           │      signature,                      │
           │      payment_source_id }             │
           │                                     │
           │ 7. Receive transaction_id            │
           │                                     │
           │ 8. INSERT INTO payments              │
           │    (tenant_id, wompi_tx_id,           │
           │     wompi_reference, amount,         │
           │     status=pending, tipo=initial)     │
           │                                     │
           │ 9. INSERT/UPDATE subscriptions       │
           │    (tenant_id, plan_id,              │
           │     estado=pending,                  │
           │     payment_source_id)               │
           │                                     │
           │ 10. Return { transactionId,          │
           │     reference, paymentId }           │
           └─────────────────────────────────────┘
           │
           ▼
  Show pending
  status to user
           │
  ┌────────▼────────────────────────────────────┐
  │ Wompi processes transaction (async)         │
  │ - Fraud check                                │
  │ - Authorization                              │
  │ - Result: APPROVED / DECLINED / ERROR        │
  └────────┬────────────────────────────────────┘
           │
           ▼
  Wompi sends webhook
  POST /wompi-webhook
  { event: "transaction.updated",
    data: { transaction: {...} },
    signature: { properties: [...], checksum: "..." },
    timestamp, sent_at }
           │
           ▼
  ┌──────────────────────────────────────────────┐
  │ Edge Function: wompi-webhook                 │
  │ 1. Verify signature (SHA256 with events sec) │
  │ 2. Check event type = transaction.updated    │
  │ 3. Find payment by wompi_reference           │
  │ 4. Check idempotency (already processed?)    │
  │ 5. Verify amount matches DB                  │
  │ 6. If APPROVED + tipo=initial:               │
  │     → activate_tenant()                      │
  │       - payment.status=approved              │
  │       - INSERT empresas                      │
  │       - INSERT subscriptions (active)        │
  │       - INSERT subscription_events           │
  │       - tenants.estado=active                │
  │ 7. If DECLINED:                              │
  │     → payment.status=declined                │
  │ 8. Return 200 OK                             │
  └──────────────────────────────────────────────┘
           │
           ▼
  User refreshes →
  tenant active →
  redirected to
  /dashboard
```

### 4.2 Recurring Payment Flow (Planned)

```
  CRON TRIGGER               EDGE FUNCTION              WOMPI API              WEBHOOK
──────────────────────────────────────────────────────────────────────────────────────────
  Schedule: daily
  (pg_cron or external)
        │
        ▼
  ┌────────────────────┐
  │ Find subscriptions │
  │ WHERE estado=active│
  │   AND proximo_cobro│
  │   <= CURRENT_DATE  │
  └────────┬───────────┘
           │
           ▼
  For each subscription:
           │
           ▼
  ┌──────────────────────────────────────────┐
  │ Edge Function: process-renewals          │
  │                                          │
  │ 1. Look up payment_source_id             │
  │    from subscription                     │
  │                                          │
  │ 2. Generate reference + signature        │
  │                                          │
  │ 3. POST /transactions                    │
  │    { amount_in_cents, currency,          │
  │      customer_email, reference,          │
  │      signature, payment_source_id }     │
  │                                          │
  │ 4. INSERT INTO payments                  │
  │    (tenant_id, subscription_id,          │
  │     wompi_tx_id, wompi_reference,        │
  │     amount, status=pending,              │
  │     tipo=recurring)                      │
  └──────────────────────────────────────────┘
           │
           ▼
  Wompi processes (asynchronous)
           │
           ▼
  Webhook arrives:
  transaction.updated → APPROVED
           │
           ▼
  ┌──────────────────────────────────────────┐
  │ Edge Function: wompi-webhook             │
  │ (tipo=recurring path)                    │
  │                                          │
  │ → process_renewal()                      │
  │   - payment.status=approved              │
  │   - subscriptions.fecha_renovacion=now   │
  │   - subscriptions.proximo_cobro=now+1mo  │
  │   - INSERT subscription_events (renewed) │
  └──────────────────────────────────────────┘
```

---

## 5. Webhook Setup and Signature Verification

### Webhook URL Configuration

In the Wompi dashboard (comercios.wompi.co):
1. Go to **Configuración** → **Webhooks**
2. Set **URL de producción**: `https://{project-ref}.supabase.co/functions/v1/wompi-webhook`
3. Set **URL de pruebas**: Same URL (the Edge Function checks sandbox flag)
4. Select events: `transaction.updated`
5. Copy the **Events Secret** displayed

### Signature Verification Algorithm

Wompi computes the HMAC as:

```
concatenated = properties[0].value + properties[1].value + ... + properties[N].value + timestamp + events_secret
checksum = SHA256(concatenated)
```

VenxPOS verification (`supabase/functions/_shared/wompi.ts:47-76`):
```typescript
function verifyWebhookSignature(body, checksum) {
  const { properties } = body.signature  // e.g., ["transaction.id", "transaction.status", "transaction.amount_in_cents"]
  const transaction = body.data.transaction

  // Resolve each property path from the body
  const values = properties.map(path => {
    const parts = path.split('.')
    let current = body
    for (const part of parts) current = current[part]
    return String(current ?? '')
  })

  // Concatenate: values + timestamp + events_secret
  const data = values.join('') + String(body.timestamp) + eventsSecret

  // Compute SHA256 and compare (case-insensitive)
  const computed = SHA256(data).toUpperCase()
  return computed === checksum.toUpperCase()
}
```

### Webhook Events Processed

| Event | Action |
|-------|--------|
| `transaction.updated` → `APPROVED` + `tipo=initial` | Activate tenant (`activate_tenant()`) |
| `transaction.updated` → `APPROVED` + `tipo=recurring` | Process renewal (`process_renewal()`) |
| `transaction.updated` → `DECLINED` | Mark payment declined; set subscription past_due if recurring |
| `transaction.updated` → `VOIDED` | Mark payment voided |
| `transaction.updated` → `ERROR` | Mark payment error, log metadata |
| All other events | Ignore (return 200 OK) |

---

## 6. Test Data

### Sandbox Test Cards

| Card Number | Type | Result | Description |
|-------------|------|--------|-------------|
| `4242 4242 4242 4242` | Visa | APPROVED | Standard success |
| `4000 0000 0000 0077` | Visa | APPROVED | Alternative success |
| `4111 1111 1111 1111` | Visa | APPROVED | Alternative success |
| `5364 6800 0000 0262` | Mastercard | APPROVED | Mastercard success |
| `4111 1111 1111 1000` | Visa | PENDING | Simulates async processing |
| `4000 0000 0000 0127` | Visa | DECLINED | Insufficient funds |
| `4000 0000 0000 0119` | Visa | DECLINED | Stolen card |
| `4000 0000 0000 0101` | Visa | DECLINED | Generic decline |

### Test Card Details

| Field | Value |
|-------|-------|
| Expiration Date | Any future date (e.g., 12/30) |
| CVV/CVC | Any 3 digits (e.g., 123) |
| Cardholder Name | Any name (e.g., "Juan Perez") |

### Test Amounts

| Amount (COP) | Description |
|-------------|-------------|
| 80000 | Básico monthly fee |
| 150000 | Básico initial fee |
| 150000 | Estándar monthly fee |
| 250000 | Estándar initial fee |
| 250000 | Pro monthly fee |
| 400000 | Pro initial fee |

### Transaction Status Codes

| Status | Meaning | Action by VenxPOS |
|--------|---------|-------------------|
| `PENDING` | Awaiting processing | Wait for webhook |
| `APPROVED` | Payment successful | Activate / renew |
| `DECLINED` | Payment rejected | Mark declined, notify user |
| `VOIDED` | Transaction voided (by merchant) | Mark voided |
| `ERROR` | Processing error | Log error, manual review |

---

## 7. Common Error Scenarios and Solutions

### Error 1: "Invalid signature" on webhook

**Cause:** Events secret mismatch or signature computation error.

**Solution:**
1. Verify the events secret in Edge Function secrets matches Wompi dashboard.
2. Check that all `properties` fields are resolved correctly (nested paths like `transaction.id`).
3. Ensure timestamp is cast to string properly.
4. Compare computed checksum with received checksum.

### Error 2: "Amount mismatch" on webhook

**Cause:** The amount in the webhook doesn't match the recorded payment.

**Solution:**
1. Edge Function compares `tx.amount_in_cents` vs `Math.round(payment.amount * 100)`.
2. Check for floating-point precision issues in amount conversion.
3. Verify that the plan price hasn't changed between payment creation and webhook arrival.

### Error 3: Wompi API returns 401 Unauthorized

**Cause:** Invalid or expired API key.

**Solution:**
1. Check that the private key is correct (hasn't been regenerated in Wompi dashboard).
2. Verify `Authorization: Bearer {private_key}` header format.
3. Ensure correct environment: sandbox keys don't work with production API and vice versa.

### Error 4: Widget doesn't load

**Cause:** Missing or invalid public key, or CSP blocking.

**Solution:**
1. Verify `VITE_WOMPI_PUBLIC_KEY` in frontend environment.
2. Check CSP in `vercel.json` includes `https://checkout.wompi.co` and `https://widget.wompi.co`.
3. Check CSP `frame-src` allows `https://checkout.wompi.co`.
4. Ensure `script-src` allows Wompi domains.

### Error 5: Payment source creation fails

**Cause:** Invalid card token or missing acceptance tokens.

**Solution:**
1. Verify the card token from the widget is fresh (tokens expire quickly).
2. Acceptance tokens must be obtained before creating the payment source.
3. `acceptance_token` and `accept_personal_auth` must both be provided.

### Error 6: Duplicate payment processing

**Cause:** Wompi sends webhook multiple times (retry).

**Solution:**
1. Edge Function checks `payment.status === 'approved'` — if already processed, returns `{ already_processed: true }`.
2. `wompi_reference` has a UNIQUE constraint preventing duplicate DB entries.
3. Wompi webhooks are idempotent — safe to receive multiple times.

### Error 7: Transaction declined by Wompi

**Cause:** Insufficient funds, stolen card, fraud detection.

**Solution:**
1. For `tipo=initial`: User must retry with a different card. Tenant stays in `pending_payment`.
2. For `tipo=recurring`: Subscription marked `past_due`. User notified to update payment method.
3. After configurable retries (3 attempts), subscription may be suspended.

---

## 8. Environment Setup

### Local Development

```bash
# .env file in project root
VITE_WOMPI_PUBLIC_KEY=pub_test_your-key-here

# Set Edge Function secrets (each time you reset Supabase CLI)
supabase secrets set WOMPI_PRIVATE_KEY=prv_test_your-key-here
supabase secrets set WOMPI_EVENTS_SECRET=test_events_your-key-here
supabase secrets set WOMPI_INTEGRITY_SECRET=test_integrity_your-key-here
```

### Production Deployment

```bash
# Set secrets in production Supabase project
supabase secrets set --env production \
  WOMPI_PRIVATE_KEY=prv_prod_your-key-here \
  WOMPI_EVENTS_SECRET=prod_events_your-key-here \
  WOMPI_INTEGRITY_SECRET=prod_integrity_your-key-here

# In Vercel dashboard, set:
VITE_WOMPI_PUBLIC_KEY=pub_prod_your-key-here
```

### Webhook URL

| Environment | URL |
|-------------|-----|
| Sandbox | `https://{project-ref}.supabase.co/functions/v1/wompi-webhook` |
| Production | `https://{project-ref}.supabase.co/functions/v1/wompi-webhook` |

**Important:** The Edge Function detects sandbox vs production via `WOMPI_SANDBOX` or `WOMPI_PRODUCTION` environment variable. Ensure this is set correctly.

---

## 9. Idempotency Strategy

1. **wompi_reference UNIQUE constraint**: Prevents duplicate payment records in the database.
2. **Webhook handler checks payment status**: If payment is already `approved`, returns `{ already_processed: true }`.
3. **Database transactions**: `activate_tenant()` and `process_renewal()` are atomic PostgreSQL functions.
4. **Retry safety**: Wompi webhooks can be retried safely — the handler is idempotent.

---

## 10. Monitoring and Alerting

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Payment success rate | `payments` table | < 90% over 24h |
| Webhook delivery rate | Wompi dashboard | Missed > 5 in 1h |
| Webhook response time | Edge Function logs | > 5s p95 |
| Amount mismatches | `payments.metadata` | > 0 in 24h |
| Signature verification failures | Edge Function logs | > 0 in 24h (may indicate attack) |

### Wompi Dashboard Monitoring

Regularly check in [comercios.wompi.co](https://comercios.wompi.co):
- Transaction volume and approval rate
- Webhook delivery status
- Failed webhook logs
- Payout status (for production)

---

*End of Wompi Integration Guide*
