# PAYMENTS_QA.md — Casos de Prueba Wompi Sandbox

## Requisitos previos
- `VITE_WOMPI_PUBLIC_KEY=pub_test_...` en `.env.local`
- Edge Functions desplegadas
- Migración `20260620_fix_payments.sql` aplicada

---

## Caso 1: Registro + Pago aprobado (tarjeta válida)
1. Ir a `/registro` → seleccionar plan → completar formulario
2. Click "Pagar" → se abre pestaña Wompi
3. Usar tarjeta: `4242 4242 4242 4242`, fecha futura, CVC `123`, nombre cualquiera
4. Completar pago en Wompi
5. Volver a la app → click "Ya pagué, verificar"
6. **Esperado:** Tenant activado, redirige a `/dashboard`

## Caso 2: Pago rechazado (tarjeta inválida)
1. Crear pago, usar tarjeta: `4111 1111 1111 1111`
2. **Esperado:** Wompi rechaza, la app muestra "Pago rechazado" con botón reintentar

## Caso 3: Simular pago (sandbox)
1. En página de pago, click "Simular pago aprobado"
2. **Esperado:** Tenant activado instantáneamente, redirige a `/dashboard`

## Caso 4: Polling timeout (5 minutos)
1. Crear pago pero NO pagar en Wompi
2. Esperar 5 minutos en la página de processing
3. **Esperado:** Muestra "Tiempo de espera agotado" con botones "Verificar ahora" y "Volver"

## Caso 5: Cerrar navegador durante pago
1. Crear pago → abrir Wompi → cerrar pestaña de la app
2. Pagar en Wompi (pestaña abierta)
3. Volver a `/login` → iniciar sesión
4. **Esperado:** Redirige a `/dashboard` (tenant ya activado por webhook o reconcile)

## Caso 6: Webhook duplicado
1. Wompi envía 2 eventos `transaction.updated` con APPROVED
2. **Esperado:** `process_webhook_approval` es idempotente. Solo se procesa una vez.

## Caso 7: Reconciliación manual
1. Crear pago → pagar en Wompi → NO verificar en la app
2. Llamar a `reconcile-payments` Edge Function (desde admin o curl)
3. **Esperado:** Pago encontrado, tenant activado.

## Caso 8: Plan Empresarial (precio=0)
1. Seleccionar plan Empresarial en registro
2. **Esperado:** Se activa directo sin pasar por Wompi (manejar amount=0)

## Caso 9: Verificación de monto en webhook
1. Modificar manualmente amount del payment en DB
2. Simular webhook con amount_in_cents diferente
3. **Esperado:** Webhook detecta mismatch, marca payment como 'error'

## Caso 10: Login superadmin sin pago
1. Login con `juan.dev1809@gmail.com`
2. **Esperado:** Redirige directo a `/admin`, nunca ve `/pago`

## Caso 11: Cambio de plan
1. Cliente activo → `/dashboard/suscripcion` → Cambiar plan
2. Seleccionar otro plan → confirmar
3. **Esperado:** Plan actualizado, toast success, datos refrescados

## Caso 12: Cancelar suscripción
1. Cliente activo → Cancelar suscripción
2. Confirmar
3. **Esperado:** Tenant estado 'cancelled', toast success, redirige a login

---

## Estados cubiertos

| Estado | Caso |
|---|---|
| PENDING → APPROVED | 1, 3 |
| PENDING → DECLINED | 2 |
| PENDING → EXPIRED (timeout) | 4 |
| PENDING → APPROVED (post-cierre) | 5 |
| Webhook duplicado | 6 |
| Reconciliación | 7 |
| Plan gratuito | 8 |
| Amount mismatch | 9 |
| Superadmin bypass | 10 |
| Change plan | 11 |
| Cancel subscription | 12 |

---

Fecha: 2026-06-20
