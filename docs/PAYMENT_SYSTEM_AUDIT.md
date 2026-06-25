# Payment System Audit — VenxPOS SaaS

**Fecha:** Julio 2026
**Estado:** Auditoria completa del sistema de pagos, suscripciones y facturacion

---

## Errores Encontrados y Corregidos

| # | Error | Archivo | Estado |
|---|-------|---------|--------|
| 1 | `deleted_at` no existe en `subscriptions` — rompe webhook y check-payment | `check-payment`, `wompi-webhook`, `_shared/notify.ts` | **Corregido** |
| 2 | `process_webhook_approval` no crea sucursal principal | Migration `20260630000000` | **Corregido** — migration `20260710000000` restaura sucursal |
| 3 | Polling `check-payment` ignora respuesta — 500 invisible al usuario | `PaymentPage.tsx` | **Corregido** — lee `cpData.status` |
| 4 | `INTERNAL_API_KEY` safety improved | `_shared/supabase.ts` | **Corregido** (session anterior) |
| 5 | `register-tenant` sin validacion de plan | `register-tenant/index.ts` | **Corregido** (session anterior) |
| 6 | Admin activaba `pending_payment` sin pago | `AdminClients.tsx` | **Corregido** (session anterior) |
| 7 | `isSubscriptionPastDue` retornaba false para `past_due` | `utils.ts` | **Corregido** (session anterior) |
| 8 | Facturas duplicadas en recurring via webhook | `wompi-webhook` | **Corregido** — solo initial/plan_change |
| 9 | Facturas faltantes en plan_change via check-payment | `check-payment` | **Corregido** — agregado generate-invoice |

---

## Flujo Final

```
Registro (register-tenant)
  → Valida plan existe
  → Crea auth user
  → Crea tenant (estado: pending_payment)
  → Retorna userId + tenantId

Login → AuthGuard → redirect /pago

PaymentPage
  → create-payment (Wompi Payment Link)
  → Polling check-payment c/3s × 100 (5 min)
  → Aprobado → refreshTenant → /dashboard
  → Rechazado → pantalla declined
  → Expirado → pantalla expired

Webhook Wompi (transaction.updated)
  → Verifica firma (WOMPI_EVENTS_SECRET)
  → Busca payment por reference
  → Idempotencia (ya approved? skip)
  → Verifica monto
  → APPROVED:
    initial → process_webhook_approval → activa tenant + crea sucursal + suscripcion
    recurring → process_renewal → reactiva tenant + avanza billing + factura
    plan_change → process_plan_change → actualiza plan
    → generate-invoice (fire-and-forget)
  → DECLINED:
    recurring → mark_subscription_past_due
    otros → payment.status = 'declined'
  → VOIDED/ERROR → payment.status actualizado

Reconciliacion (reconcile-payments, cron c/5min)
  → Busca pagos pending > 15 min
  → Consulta Wompi → actualiza estado

Cancelacion (cancel_subscription RPC)
  → is_tenant_owner() check
  → tenants.estado = 'cancelled'
  → subscriptions.estado = 'cancelled'
  → subscription_events INSERT

Cambio de plan (change-plan Edge Function)
  → Valida tenant + plan
  → Calcula prorrateo
  → Si upgrade: crea Wompi payment link → polling
  → Si downgrade/free: process_plan_change directo
```

---

## Riesgos Pendientes

| Riesgo | Severidad | Mitigacion |
|--------|-----------|------------|
| `INTERNAL_API_KEY` no configurada | Media | Verificar en Supabase Dashboard |
| `WOMPI_EVENTS_SECRET` no configurada | Alta | Configurar en Supabase + dashboard Wompi |
| URL webhook no registrada en Wompi | Alta | Configurar en dashboard Wompi Sandbox |
| Deno.land timeout en deploy | Baja | Reintentar; no afecta funciones ya desplegadas |
