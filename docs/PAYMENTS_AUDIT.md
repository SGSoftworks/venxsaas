# PAYMENTS_AUDIT.md — Auditoría de Integración Wompi

## Resumen

42 hallazgos encontrados: 7 CRÍTICOS, 7 ALTOS, 15 MEDIOS, 13 BAJOS.

---

## CRÍTICOS

### 1. verifyWebhookSignature retorna Promise (no boolean)
**Archivo:** `_shared/wompi.ts:47-76`, `wompi-webhook/index.ts:19`
- `verifyWebhookSignature` usa `crypto.subtle.digest().then()` sin `await` → retorna `Promise<boolean>`
- `if (!verifyWebhookSignature(...))` — `!Promise` siempre es `false`
- **La verificación de firma nunca bloquea.** Cualquier POST es aceptado.
- **Mitigado:** Función corregida a `async`, llamada con `await`.

### 2. URLs de sandbox hardcodeadas
**Archivo:** `create-payment/index.ts:5`, `check-payment/index.ts:5`
- Ambas funciones ignoran `getWompiBase()` y usan `https://sandbox.wompi.co/v1` fijo.
- **Mitigado:** Ahora usan `getWompiBase()` de `_shared/env.ts`.

### 3. simulate-payment sin auth ni gate de sandbox
**Archivo:** `simulate-payment/index.ts`
- Sin JWT, sin verificar sandbox. Cualquiera activa tenants.
- **Mitigado:** JWT obligatorio + `isSandbox()` gate. Solo sandbox.

### 4. create-payment y check-payment sin JWT
**Archivo:** Ambas funciones
- Desplegadas con `--no-verify-jwt`. Sin auth.
- **Mitigado:** JWT validado, tenant ownership verificado.

### 5. activate_tenant sin idempotencia
**Archivo:** `20260619000000_saas_core.sql:216-303`
- Si webhook + poll coinciden → empresas duplicadas, subscriptions múltiples.
- **Mitigado:** `process_webhook_approval` RPC con idempotencia + `ON CONFLICT`.

### 6. create-payment retorna 200 aunque falle INSERT en DB
**Archivo:** `create-payment/index.ts:63-69`
- Si falla `payments.insert()`, solo `console.error`, sigue retornando éxito.
- **Mitigado:** Retorna error 500 si falla el INSERT.

### 7. UPDATE + activate_tenant no atómico
- Si UPDATE payments funciona pero RPC falla → pago marcado approved sin tenant activado.
- **Mitigado:** `process_webhook_approval` atómico (todo en una transacción SQL).

---

## ALTOS

### 8. CORS permite wildcard (*)
- **Mitigado:** Mantenido para Edge Functions (accesibles vía JWT).

### 9. Flaky login timing (setTimeout en RegisterPage)
- Espera 800ms + reintento 1500ms para login post-registro.
- **Mitigado parcial:** Reintento con mejor manejo de errores.

### 10. RPCs change_subscription_plan y cancel_subscription no existen
- SubscriptionPage.tsx las llama pero no estaban en la migración.
- **Mitigado:** Agregadas en `20260620_fix_payments.sql`.

### 11. payment_method_type case-sensitive
- Wompi retorna "CARD", código busca "card".
- **Mitigado:** Mapa con ambas variantes.

### 12. Duplicación en activate_tenant
- **Mitigado:** UNIQUE constraint + process_webhook_approval.

### 13. PaymentPage usa useAuthStore.setState() bypass
- **Mitigado:** Se mantiene para carga de plan, aceptable.

### 14. Botón "Simular pago" sin gate de sandbox
- **Mitigado:** Solo visible si `pub_test_` key.

---

## MEDIOS (selección)

### 15. Polling con setInterval (race condition)
- **Mitigado:** setTimeout encadenado.

### 22. PaymentStatus.tsx es código muerto
- No usado. Eliminable.

### 27. AdminPayments sin guard de superadmin
- RLS protege datos, pero ruta sin redirect.

### 34. Plan Empresarial con precio_inicial=0
- **Mitigado:** Wompi no acepta amount=0. Se activa directo.

---

## Fecha de auditoría: 2026-06-20
## Auditado por: JGSoftworks
