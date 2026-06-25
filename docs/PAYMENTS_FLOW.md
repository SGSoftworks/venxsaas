# VenxPOS — Payments Flow Documentation

**Version**: 1.0.0
**Date**: 2026-06-19
**Gateway**: Wompi

---

## 1. Complete Payment Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT LIFECYCLE                                      │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│  │REGISTER │───▶│ PAYMENT │───▶│PENDING  │───▶│APPROVED │───▶│ ACTIVE  │    │
│  │  TENANT │    │  PAGE   │    │ PAYMENT │    │  (web-  │    │ TENANT  │    │
│  │         │    │         │    │ (DB)    │    │  hook)  │    │         │    │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │
│       │              │              │              │              │          │
│       │              │              │              │              │          │
│       │              │              ▼              │              │          │
│       │              │         ┌─────────┐         │              │          │
│       │              │         │DECLINED │         │              │          │
│       │              │         │(retry?) │         │              │          │
│       │              │         └─────────┘         │              │          │
│       │              │                             │              │          │
│       │              │              ▼              │              │          │
│       │              │         ┌─────────┐         │              │          │
│       │              │         │ ERROR   │         │              │          │
│       │              │         │(manual) │         │              │          │
│       │              │         └─────────┘         │              │          │
│       │              │                             │              │          │
│       │              │  ┌──────────────────────────┘              │          │
│       │              │  │                                         │          │
│       │              │  │    ┌─────────────────────────────────────┘          │
│       │              │  │    │                                                │
│       ▼              ▼  ▼    ▼                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                   RECURRING CYCLE (monthly)                           │    │
│  │                                                                      │    │
│  │  ACTIVE ──▶ proximo_cobro reached ──▶ CREATE RECURRING PAYMENT       │    │
│  │    │                                       │                         │    │
│  │    │                                       ▼                         │    │
│  │    │                                  ┌─────────┐                    │    │
│  │    │                                  │APPROVED │──▶ UPDATE DATES    │    │
│  │    │                                  └─────────┘       │            │    │
│  │    │                                       │             │            │    │
│  │    │                                       ▼             │            │    │
│  │    │                                  ┌─────────┐        │            │    │
│  │    │                                  │DECLINED │        │            │    │
│  │    │                                  └────┬────┘        │            │    │
│  │    │                                       │             │            │    │
│  │    │                                       ▼             │            │    │
│  │    │                                  ┌──────────┐       │            │    │
│  │    │                                  │PAST_DUE  │       │            │    │
│  │    │                                  │(retry 3x)│       │            │    │
│  │    │                                  └────┬─────┘       │            │    │
│  │    │                                       │             │            │    │
│  │    │                              ┌────────▼──────┐      │            │    │
│  │    │                              │ All retries    │      │            │    │
│  │    │                              │ exhausted?     │      │            │    │
│  │    │                              └────┬──────┬────┘      │            │    │
│  │    │                              YES  │      │ NO        │            │    │
│  │    │                                   ▼      ▼           │            │    │
│  │    │                            ┌──────────┐ ┌──────────┐ │            │    │
│  │    │                            │SUSPENDED │ │ RETRY    │─┘            │    │
│  │    │                            │  TENANT  │ │ TOMORROW │              │    │
│  │    │                            └──────────┘ └──────────┘              │    │
│  │    │                                                                  │    │
│  │    └──▶ CANCEL ──▶ tenant.cancelled, subscription.cancelled           │    │
│  │                                                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Initial Payment Flow (Detailed)

### Step 1: Registration Creates Tenant

```
User submits registration form (RegisterPage.tsx)
         │
         ▼
1. supabase.auth.signUp({ email, password })
   └── Creates auth.users record
   └── Returns JWT session
         │
         ▼
2. INSERT INTO tenants {
     nombre_negocio,
     nit,
     email_propietario,
     telefono,
     estado: 'pending_payment',
     auth_user_id: user.id,
     plan_id: selectedPlanId
   }
   └── RLS policy: auth_user_id = auth.uid()
         │
         ▼
3. Redirect to /pago
```

### Step 2: PaymentPage Loads

```
PaymentPage mounts
         │
         ▼
1. Verify tenant.estado === 'pending_payment'
   └── If not, redirect to /login or /dashboard
         │
         ▼
2. Load plan details from store
   └── plan.precio_inicial → amount
         │
         ▼
3. Fetch Wompi acceptance tokens (public key, frontend-safe)
   └── WompiClient.getAcceptanceTokens()
   └── Returns: acceptanceToken, personalAuthToken, permalinks
         │
         ▼
4. Render WompiWidget component
```

### Step 3: WompiWidget Tokenization

```
WompiWidget mounts
         │
         ▼
1. Load Wompi.js script dynamically
   └── https://widget.wompi.co/wompi.js
         │
         ▼
2. Initialize widget:
   const wompi = new WompiWidget({
     publicKey: VITE_WOMPI_PUBLIC_KEY,
     currency: 'COP',
     amountInCents
   })
         │
         ▼
3. User fills card form in iframe:
   └── Card number, expiration, CVV, cardholder name
         │
         ▼
4. Wompi iframe returns token:
   └── wompi.on('token', (cardToken) => { ... })
   └── token = "tok_test_XXXXX_xxxxxxxxxxxxx"
         │
         ▼
5. Call Edge Function with JWT + card token
```

### Step 4: Edge Function create-payment

```
Edge Function: create-payment
         │
         ▼
1. Verify JWT:
   └── supabaseAdmin.auth.getUser(jwt)
   └── If invalid → 401
         │
         ▼
2. Extract body: { token, amountInCents, tenantId, planId, customerEmail, acceptanceToken, personalAuthToken }
         │
         ▼
3. Create Wompi payment source:
   POST /payment_sources (private key)
   Body: {
     type: 'CARD',
     token,
     customer_email,
     acceptance_token,
     accept_personal_auth
   }
   Response: { id: paymentSourceId, status: 'AVAILABLE' }
         │
         ▼
4. Generate reference: VENX-{tenantId[0:8]}-{Date.now()}
         │
         ▼
5. Generate integrity signature:
   SHA256(reference + amountInCents + 'COP' + integritySecret)
         │
         ▼
6. Create Wompi transaction:
   POST /transactions (private key)
   Body: {
     amount_in_cents,
     currency: 'COP',
     customer_email,
     reference,
     signature,
     payment_source_id: paymentSourceId
   }
   Response: { id: transactionId, status: 'PENDING' }
         │
         ▼
7. INSERT INTO payments {
     tenant_id: tenantId,
     wompi_transaction_id: transactionId,
     wompi_reference: reference,
     amount: amountInCents / 100,
     currency: 'COP',
     status: 'pending',
     payment_method_type: 'CARD',
     tipo: 'initial',
     metadata: { payment_source_id: paymentSourceId }
   }
         │
         ▼
8. UPSERT subscriptions {
     tenant_id: tenantId,
     plan_id: planId,
     estado: 'pending',
     payment_source_id: paymentSourceId
   }
         │
         ▼
9. Return { transactionId, reference, paymentId }
```

### Step 5: Webhook Processing

```
Wompi processes transaction asynchronously
  - Fraud check
  - Authorization
  - Result: APPROVED / DECLINED / ERROR
         │
         ▼
Wompi sends POST to /wompi-webhook
         │
         ▼
Edge Function: wompi-webhook
         │
         ▼
1. Verify webhook signature:
   └── compute SHA256(properties.join('') + timestamp + eventsSecret)
   └── Compare with X-Event-Checksum header
   └── If invalid → 401 "Invalid signature"
         │
         ▼
2. Check event type:
   └── if event !== 'transaction.updated' → 200 OK (ignore)
         │
         ▼
3. Find payment by wompi_reference:
   └── SELECT * FROM payments WHERE wompi_reference = tx.reference
   └── If not found → 404
         │
         ▼
4. Idempotency check:
   └── if payment.status === 'approved' AND tx.status === 'APPROVED'
   └── → 200 OK { already_processed: true }
         │
         ▼
5. Amount verification:
   └── expectedAmount = Math.round(payment.amount * 100)
   └── if tx.amount_in_cents !== expectedAmount
   └── → Mark payment as error, 400 "Amount mismatch"
         │
         ▼
6a. If APPROVED + tipo === 'initial':
   └── supabaseAdmin.rpc('activate_tenant', {
         p_tenant_id: payment.tenant_id,
         p_payment_id: payment.id,
         p_wompi_transaction_id: tx.id,
         p_payment_source_id: String(tx.payment_source_id)
       })
   └── Inside activate_tenant():
       1. UPDATE payments SET status = 'approved'
       2. INSERT INTO empresas (tenant_id, nombre, nit, email, telefono)
       3. INSERT INTO subscriptions (active, dates set)
       4. INSERT INTO subscription_events (tipo='activated')
       5. UPDATE tenants SET estado = 'active'
         │
         ▼
6b. If APPROVED + tipo === 'recurring':
   └── supabaseAdmin.rpc('process_renewal', {
         p_tenant_id: payment.tenant_id,
         p_payment_id: payment.id,
         p_wompi_transaction_id: tx.id
       })
   └── Inside process_renewal():
       1. UPDATE payments SET status = 'approved'
       2. UPDATE subscriptions SET fecha_renovacion = NOW(),
          proximo_cobro = NOW() + 1 month
       3. INSERT INTO subscription_events (tipo='renewed')
         │
         ▼
6c. If DECLINED:
   └── UPDATE payments SET status = 'declined'
   └── If tipo='recurring':
       └── UPDATE subscriptions SET estado = 'past_due'
         │
         ▼
7. Return 200 OK { ok: true }
```

---

## 3. Recurring Payment Flow

### Trigger: Cron Job (Daily)

```
Cron trigger (pg_cron or external scheduler)
         │
         ▼
1. Query subscriptions due for renewal:
   SELECT * FROM subscriptions
   WHERE estado = 'active'
     AND proximo_cobro <= CURRENT_DATE
         │
         ▼
2. For each subscription:
   │
   ├── 2a. Look up tenant email:
   │     SELECT email_propietario FROM tenants WHERE id = subscription.tenant_id
   │
   ├── 2b. Look up plan price:
   │     SELECT precio_mensual FROM plans WHERE id = subscription.plan_id
   │
   ├── 2c. Generate reference + signature
   │
   ├── 2d. Call Wompi API:
   │     POST /transactions
   │     { amount_in_cents, currency, customer_email,
   │       reference, signature,
   │       payment_source_id: subscription.payment_source_id }
   │
   ├── 2e. Record payment:
   │     INSERT INTO payments (tenant_id, subscription_id,
   │       wompi_transaction_id, wompi_reference, amount,
   │       status='pending', tipo='recurring')
   │
   └── 2f. Wompi processes → webhook → process_renewal()
```

### Failed Recurring Payment Strategy

```
Attempt | Action
────────┼──────────────────────────────────────────
  1     │ Charge, if DECLINED → retry in 3 days
  2     │ Charge, if DECLINED → retry in 5 days
  3     │ Charge, if DECLINED → mark past_due
  4+    │ Past_due for 14 days → suspend tenant
────────┼──────────────────────────────────────────
        │ On any APPROVED → reset cycle, advance dates
```

---

## 4. Webhook Event Processing

### Supported Events

| Event | Action | Idempotent? |
|-------|--------|-------------|
| `transaction.updated` → `APPROVED` + `tipo=initial` | Activate tenant | Yes (checks payment status) |
| `transaction.updated` → `APPROVED` + `tipo=recurring` | Process renewal | Yes (checks payment status) |
| `transaction.updated` → `APPROVED` + `tipo=manual` | Activate if needed | Yes |
| `transaction.updated` → `DECLINED` | Mark payment declined | Yes |
| `transaction.updated` → `VOIDED` | Mark payment voided | Yes |
| `transaction.updated` → `ERROR` | Log error, manual review | Yes |
| All other events | Ignore (return 200 OK) | N/A |

### Webhook Retry Behavior

Wompi retries failed webhooks with exponential backoff:
- 1st retry: 5 minutes
- 2nd retry: 15 minutes
- 3rd retry: 40 minutes
- 4th retry: 2 hours
- 5th retry: 6 hours
- 6th+ retry: 12 hours

The webhook handler is fully idempotent — it's safe to receive the same event multiple times.

---

## 5. Idempotency Strategy

### Database Level
```sql
-- Unique constraint prevents duplicate references
wompi_reference TEXT UNIQUE

-- Payment status check prevents re-processing
IF payment.status = 'approved' AND tx.status = 'APPROVED' THEN
  RETURN already_processed
END IF
```

### Application Level
1. **Reference generation**: Each payment gets a unique `VENX-{tenant_prefix}-{timestamp}` reference.
2. **UNIQUE constraint**: Database rejects duplicate references.
3. **Status check**: Webhook handler checks if payment is already approved before activating/renewing.
4. **Atomic functions**: `activate_tenant()` and `process_renewal()` run in a single PostgreSQL transaction.

### Timeout Handling

If a Wompi API call times out:
1. The Edge Function returns an error to the client.
2. If the payment source was created but the transaction wasn't, the payment source can be voided.
3. If the transaction was created but the DB insert failed, Wompi will still process it and send a webhook.
4. The webhook will find the payment by reference (or create a record if needed — future enhancement).

---

## 6. Error Handling and Retry Logic

### Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| **Network Error** | Wompi API timeout, DNS failure | Retry up to 3x with exponential backoff (1s, 2s, 4s) |
| **Auth Error** | Invalid Wompi API key, expired JWT | Return error to client, do not retry |
| **Validation Error** | Missing required field, invalid amount | Return error to client, fix input |
| **Card Error** | Card declined, expired card | Return status to client, user retries with different card |
| **DB Error** | Unique constraint violation, FK error | Log error, return to client |
| **Webhook Error** | Invalid signature, amount mismatch | Log and alert, mark payment as error |

### Client-Side Error Handling

```
WompiWidget callback receives error
         │
         ▼
  ┌──────────────────────┐
  │ Error handled in     │
  │ PaymentPage:         │
  │                      │
  │ - Show toast message │
  │ - Allow retry        │
  │ - Log to console     │
  │ - (Future: Sentry)   │
  └──────────────────────┘
```

### Server-Side Error Handling

```
Edge Function catches error
         │
         ▼
  ┌──────────────────────────────┐
  │ Return 500 with error message │
  │ Log full error to Supabase    │
  │ Edge Function logs            │
  └──────────────────────────────┘
```

---

## 7. Manual Payment Override for Superadmin

### Use Cases
- Customer paid via bank transfer (outside Wompi)
- Wompi transaction failed but customer has proof of payment
- Manual plan change with prorated amount
- Enterprise plan with custom billing

### Implementation (Planned)

```
AdminPayments page → "Register Manual Payment" button
         │
         ▼
  ┌──────────────────────────────────┐
  │ Manual Payment Form              │
  │                                  │
  │ - Select tenant                  │
  │ - Enter amount (COP)             │
  │ - Payment type (initial/manual)  │
  │ - Payment method (transfer/other)│
  │ - Reference/notes                │
  │ - Admin authorization (PIN/JWT)  │
  └──────────────┬───────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────┐
  │ INSERT INTO payments:            │
  │   tenant_id                      │
  │   amount                         │
  │   status = 'approved'            │
  │   tipo = 'manual'                │
  │   wompi_reference = MANUAL-{UUID}│
  │   metadata: { admin_id, notes }  │
  │                                  │
  │ If tenant was pending_payment:   │
  │   → activate_tenant()            │
  └──────────────────────────────────┘
```

**Security Considerations:**
- Only superadmins can create manual payments.
- All manual payments logged to `eventos_auditoria`.
- Manual payment references use `MANUAL-` prefix to distinguish from Wompi transactions.
- Future: require second superadmin approval for large manual payments.

---

## 8. Payment States Reference

| DB Status | Wompi Status | Meaning | Next Action |
|-----------|-------------|---------|-------------|
| `pending` | `PENDING` | Awaiting Wompi processing | Wait for webhook |
| `approved` | `APPROVED` | Payment completed successfully | Tenant active / renewal processed |
| `declined` | `DECLINED` | Payment rejected by bank | User retries or contact support |
| `voided` | `VOIDED` | Transaction voided by merchant | Manual review |
| `error` | `ERROR` | Processing error | Manual review |

---

## 9. Reconciliation

### Daily Reconciliation Process

```sql
-- Compare VenxPOS payments with Wompi transactions
-- (Run daily via Edge Function or manual script)

-- 1. Find payments approved in Wompi but not in VenxPOS
SELECT p.id, p.wompi_reference, p.amount, p.status, p.created_at
FROM payments p
WHERE p.status = 'pending'
  AND p.created_at < NOW() - INTERVAL '1 hour';

-- 2. Verify amounts match (for approved payments)
-- Check payments.metadata for amount_mismatch entries

-- 3. Identify orphan payments (no matching tenant)
SELECT * FROM payments WHERE tenant_id IS NULL;

-- 4. Check for duplicate references
SELECT wompi_reference, COUNT(*) FROM payments
GROUP BY wompi_reference HAVING COUNT(*) > 1;
```

---

*End of Payments Flow Documentation*
