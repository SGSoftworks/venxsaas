# Wompi Integration Report — VenxPOS SaaS

**Fecha:** Julio 2026
**Modo:** Sandbox (https://sandbox.wompi.co/v1)

---

## Configuracion Requerida

### Variables de Entorno (Supabase)

| Variable | Estado | Proposito |
|----------|--------|-----------|
| `WOMPI_PUBLIC_KEY` | Configurada | Widget frontend |
| `WOMPI_PRIVATE_KEY` | Configurada | API backend |
| `WOMPI_INTEGRITY_SECRET` | Configurada | Firma de integridad |
| `WOMPI_EVENTS_SECRET` | **Verificar** | Firma de webhooks |
| `WOMPI_PRODUCTION` | `"false"` | Sandbox mode |
| `INTERNAL_API_KEY` | **Verificar** | Auth interna entre Edge Functions |
| `SUPABASE_URL` | Configurada | URL proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Configurada | Service role admin |

### Wompi Dashboard Sandbox

| Item | Estado |
|------|--------|
| URL Webhook | **Pendiente:** `https://beacnoxukkoellhecofm.supabase.co/functions/v1/wompi-webhook` |
| Eventos | `transaction.updated` |

---

## Flujos de Integracion

### 1. Creacion de Payment Link (initial/recurring/plan_change)

```
Edge Function → POST /payment_links
  {
    name: "Pago inicial VenxPOS",
    description: "Configuracion + primera sucursal + primer mes",
    amount_in_cents: 4000000,
    single_use: true,
    currency: "COP",
    reference: "PAY-{uuid}",
    expires_at: "2026-06-22T08:00:00Z"
  }
→ Response: { data: { id: "payment_link_id" } }
→ Frontend: window.open("https://checkout.wompi.co/l/{id}")
→ Polling: GET /transactions?payment_link_id=... cada 3s
```

### 2. Verificacion de Firma (Webhook)

```
Wompi → POST {url}/wompi-webhook
  Headers: X-Event-Checksum: {checksum}
  Body: {
    event: "transaction.updated",
    data: { transaction: { id, status, amount_in_cents, ... } },
    timestamp: 1719000000,
    signature: { properties: [...], checksum: "..." }
  }

Verificacion:
  1. Timestamp TTL < 5 min
  2. Concatenar valores de properties + timestamp + WOMPI_EVENTS_SECRET
  3. SHA-256 → comparar con checksum (case-insensitive)
```

### 3. Consulta de Transaccion (Polling)

```
Edge Function → GET /transactions?payment_link_id=...&from_date=...&until_date=...
  Headers: Authorization: Bearer {WOMPI_PRIVATE_KEY}
→ Response: { data: [{ id, status, amount_in_cents, ... }] }
```

### 4. Modo Produccion

Para cambiar a produccion:
1. `WOMPI_PRODUCTION=true`
2. Reemplazar llaves sandbox por llaves produccion
3. Actualizar URL webhook en dashboard Wompi produccion
4. Verificar endpoint con evento real

---

## Edge Functions que Usan Wompi

| Funcion | Endpoint Wompi | Metodo |
|---------|---------------|--------|
| `create-payment` | `/payment_links` | POST |
| `create-renewal-payment` | `/payment_links` | POST |
| `change-plan` | `/payment_links` | POST |
| `check-payment` | `/transactions` | GET |
| `reconcile-payments` | `/transactions` | GET |
| `renew-subscriptions` | `/transactions` | POST |
| `wompi-webhook` | Recibe webhook | — |
