# Evidencias — VenxPOS

Índice de evidencias de la auditoría y de la documentación técnica.

## Fuentes primarias

| Evidencia | Ubicación | Uso |
|---|---|---|
| Código del panel SaaS | `venxpos-saas/src/**` | RF de suscripciones, sucursales, inventario, facturación, reportes, auditoría. |
| Código del POS | `venxpos/src/**` | Venta, cobro, ticket, devoluciones, caja, turnos. |
| Migraciones | `venxpos-saas/supabase/migrations/**` (74) | Esquema, RLS, CHECKs, RPC. |
| Edge Functions | `venxpos-saas/supabase/functions/**` (11) | Registro/aprobación, facturación, PDF, correo, auditoría. |
| Esquema en vivo | `supabase gen types typescript --linked` | 29 tablas, ~50 funciones; extraído a `db_types.ts` (temporal). |

## Evidencias de código destacadas

| Tema | Archivo |
|---|---|
| Venta y cobro (métodos, ticket, hash, stock) | `venxpos/src/components/PaymentModal.tsx` |
| Ticket impreso | `venxpos/src/components/Receipt.tsx` |
| Devolución y restock | `venxpos/src/components/ReturnModal.tsx` |
| Apertura / cierre de caja | `venxpos/src/components/AperturaTurnoModal.tsx`, `CashRegisterClose.tsx` |
| Guard de conexión (sin offline) | `venxpos/src/components/ConnectionGuard.tsx` |
| PIN override (cliente) | `venxpos/src/components/AdminOverrideModal.tsx` |
| CHECK de método de pago | `venxpos-saas/supabase/migrations/20260901000000_remove_taxes_wompi_dian.sql` |
| Guards de rol | `venxpos-saas/src/components/auth/*Guard.tsx` |
| Cliente Supabase (browser) | `venxpos-saas/src/lib/supabase/client.ts` |
| Residuo TARJETA | `venxpos-saas/src/components/dashboard/DashboardHome.tsx:50` |

## Diagramas

Las fuentes editables y sus formatos se listan en el `README.md` de esta entrega y en `diagramas/`.

> Las rutas con `venxpos/` corresponden al repositorio del POS y las de `venxpos-saas/` al repositorio del panel SaaS.
