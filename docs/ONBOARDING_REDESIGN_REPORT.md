# Onboarding Redesign Report — VenxPOS SaaS

**Fecha:** Julio 2026
**Alcance:** Rediseno completo del flujo de registro, activacion y pagos

---

## Flujo Anterior (problemas identificados)

```
Landing → Registro → AUTO-LOGIN → /pago → Wompi → Polling → Dashboard
                ↓
        register-tenant (crea auth.user + tenant ANTES del pago)
```

| Problema | Impacto |
|----------|---------|
| Auth user y tenant creados antes del pago | Registros huerfanos si usuario abandona |
| Auto-login post-registro fallaba intermitentemente | Usuario iba a /login sin saber que hacer |
| Session nullificada en RegisterPage stage 4 | Race condition con AuthGuard |
| URL /pago exponia que el usuario ya tenia cuenta | Mala experiencia |

---

## Nuevo Flujo

```
Landing → /signup → Seleccion plan → Formulario → create-signup
                                                       ↓
                                          pending_signups (NO auth user)
                                                       ↓
                                          Wompi Payment Link generado
                                                       ↓
                                          /checkout/pay/:reference
                                                       ↓
                                          Wompi checkout (nueva pestana)
                                                       ↓
                                          Polling check-signup c/3s
                                                       ↓
                              ┌───────────────────────────┐
                              │  APPROVED (webhook o poll) │
                              │  → check-signup crea:      │
                              │    - auth.user             │
                              │    - tenants (activo)      │
                              │    - empresas + sucursal   │
                              │    - subscriptions (activa)│
                              │    - payments (approved)   │
                              │    - facturas_saas         │
                              └───────────────────────────┘
                                                       ↓
                                          /payment/success/:reference
                                                       ↓
                                          Login → Dashboard
```

**Regla principal:** NO se crea `auth.users` ni `tenants` antes de que Wompi confirme el pago.

---

## Tablas Creadas

| Tabla | Proposito |
|-------|-----------|
| `pending_signups` | Almacen temporal pre-pago. Contiene: email, password_hash (bcrypt), nombre_negocio, nit, telefono, plan_id, estado (draft/pending_payment/approved/expired/cancelled), payment_reference, wompi_payment_link_id, expires_at |

### RPCs Nuevas

| RPC | Proposito |
|-----|-----------|
| `hash_password(p_password)` | Hashea password con bcrypt via pgcrypto |
| `verify_password(p_password, p_hash)` | Verifica password contra hash |
| `clean_expired_signups()` | Expira registros abandonados |

---

## Edge Functions Modificadas/Creadas

| Funcion | Tipo | Cambios |
|---------|------|---------|
| `create-signup` | **Nueva** | Valida plan, email duplicado, hashea password, INSERT en pending_signups, crea Wompi payment link. Retorna reference + paymentLinkId. SIN crear auth user |
| `check-signup` | **Nueva** | Busca pending_signup por reference. Verifica Wompi. Si APPROVED: crea auth user + tenant + empresa + sucursal + subscription + payment + invoice |
| `wompi-webhook` | **Modificada** | Agregado fallback a pending_signups cuando no encuentra payment. Marca approved/cancelled en pending_signups |
| `register-tenant` | **Deprecada** | Ya no se usa en el flujo principal |

---

## Rutas Modificadas

| Ruta | Antes | Despues |
|------|-------|---------|
| `/registro/:planId?` | RegisterPage | SignupPage (mismo componente, nuevo flujo) |
| `/pago` | PaymentPage | SignupPage (redirigido) |
| `/signup` | No existia | **Nueva** — SignupPage |
| `/checkout/pay/:reference` | No existia | **Nueva** — CheckoutPage |
| `/payment/success/:reference` | No existia | **Nueva** — PaymentSuccess |
| `/payment/pending/:reference` | No existia | **Nueva** — PaymentPending |
| `/payment/failed/:reference` | No existia | **Nueva** — PaymentFailed |

---

## Validaciones Implementadas

| Validacion | Donde |
|------------|-------|
| Email duplicado (pending_signups) | `create-signup` — busca drafts/pending del mismo email |
| Email duplicado (auth.users) | `create-signup` — busca en auth.users existentes |
| NIT duplicado | `create-signup` — no implementado en pending_signups (post-activacion) |
| Plan existe y activo | `create-signup` — query a plans |
| Password >= 8 caracteres | `create-signup` — validacion explicita |
| Expiration 1 hora | `pending_signups.expires_at` + `clean_expired_signups()` |
| Rate limiting | Pendiente |

---

## Checklist de Funcionamiento

- [x] DB migration `pending_signups` aplicada
- [x] RPC `hash_password` desplegado
- [x] Edge Function `create-signup` desplegada
- [x] Edge Function `check-signup` desplegada
- [x] Edge Function `wompi-webhook` actualizada con fallback pending_signups
- [x] `SignupPage.tsx` creado
- [x] `CheckoutPage.tsx` creado
- [x] `PaymentSuccess.tsx` creado
- [x] `PaymentPending.tsx` creado
- [x] `PaymentFailed.tsx` creado
- [x] `AuthGuard.tsx` reforzado (sin bypass /pago, pending_payment muestra StatusMessage)
- [x] `App.tsx` rutas actualizadas
- [x] Build sin errores TypeScript

---

## Pendientes

| Item | Estado |
|------|--------|
| Actualizar LandingPage links a /signup | Pendiente |
| Test end-to-end con tarjeta sandbox Wompi | Pendiente |
| Rate limiting en create-signup | Pendiente |
| Job cron para clean_expired_signups() | Pendiente |
| Eliminar codigo legacy RegisterPage | Pendiente (conservado por si hay tenants pre-migracion) |
