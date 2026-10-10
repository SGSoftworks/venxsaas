# 06. Modelo C4 — VenxPOS

**Proyecto:** Sistema de Gestión de Punto de Venta — VenxPOS

---

## 1. Resumen

El sistema se modela con el estándar C4 en cuatro niveles. Se compone de dos aplicaciones SPA (panel SaaS y POS) que consumen un backend BaaS (Supabase: Auth, PostgreSQL con RLS, Storage y Edge Functions), desplegadas en Vercel.

## 2. Nivel 1 — Contexto

Diagrama: `diagramas/c4/C4_Contexto.puml`.

| Actor / Sistema | Tipo | Rol |
|---|---|---|
| Cajero | Persona | Registra ventas, devoluciones y cierres de caja en el POS. |
| Dueño / Admin de negocio | Persona | Administra sucursales, usuarios, productos, inventario y suscripción. |
| Superadministrador | Persona | Aprueba negocios y gestiona planes, pagos y facturas de la plataforma. |
| VenxPOS | Sistema | Plataforma SaaS de punto de venta. |
| Supabase | Sistema externo | Auth, PostgreSQL, Storage y Edge Functions. |
| Resend | Sistema externo | Correo transaccional (invitaciones, notificaciones). |
| Vercel | Sistema externo | Hosting de las SPA con rewrites. |

## 3. Nivel 2 — Contenedores

Diagrama: `diagramas/c4/C4_Contenedores.puml`.

| Contenedor | Tecnología | Responsabilidad |
|---|---|---|
| Panel SaaS (SPA) | React 19 + Vite + TS + Tailwind + Zustand | Dashboard de negocio y panel superadmin. |
| POS (SPA) | React 19 + Vite + TS + Tailwind + Zustand | Carrito, cobro, ticket, devoluciones, caja y turnos. |
| Supabase Auth | GoTrue / JWT | Autenticación de los tres roles. |
| Base de datos | PostgreSQL + RLS | 29 tablas y ~50 funciones RPC; aislamiento por tenant/sucursal. |
| Edge Functions | Deno TypeScript | 11 funciones: aprobación de tenants, facturación, correo, PDF, auditoría. |
| Storage | Supabase Storage | PDF de facturas y comprobantes de pago. |
| Resend | Externo | Envío de correos. |

Relaciones clave: las SPA se autentican contra Auth, leen/escriben en PostgreSQL vía PostgREST y ejecutan RPC; invocan Edge Functions, que a su vez usan `service_role` sobre la base y Resend para correo.

## 4. Nivel 3 — Componentes (Panel SaaS)

Diagrama: `diagramas/c4/C4_Componentes.puml`.

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Enrutador y Guards | React Router v7 | Rutas `/dashboard` y `/admin`; `AuthGuard`, `AdminNegocioGuard`, `GerenteGuard`. |
| Store de autenticación | Zustand | Sesión, rol y contexto de tenant/sucursal. |
| Store de UI | Zustand | Estado global de interfaz. |
| Módulo Dashboard | React + RHF + Zod | Sucursales, usuarios, productos, inventario, caja, reportes, suscripción. |
| Módulo Superadmin | React + RHF + Zod | Tenants, planes, solicitudes, pagos, facturas, auditoría global. |
| Cliente Supabase | supabase-js | Acceso RLS a Auth, PostgREST y Functions. |
| Servicios de dominio | TypeScript | Encapsulan queries y RPC. |

## 5. Nivel 4 — Código (flujo de venta en el POS)

Diagrama: `diagramas/c4/C4_Codigo.puml`.

Componentes: `POSLayout` (con `ConnectionGuard`), vista de carrito, `useAppStore` (carrito y totales), `PaymentModal` (cobro, ticket `MAX+1`, hash SHA-256), `Receipt` (impresión), `ReturnModal` (devoluciones) y apertura/cierre de caja. `PaymentModal` hace `SELECT` de `inventario_sucursal`, `INSERT` en `ventas`/`venta_detalles` y ejecuta la RPC `decrementar_inventario`; `ReturnModal` inserta `devoluciones`/`devolucion_detalles` y ejecuta `incrementar_inventario`.

## 6. Trazabilidad C4 → código

| Elemento C4 | Evidencia |
|---|---|
| Enrutador y Guards | `src/App.tsx`, `src/components/auth/*Guard.tsx` |
| Store de autenticación | `src/store/useAuthStore.ts` |
| Módulo Dashboard | `src/components/dashboard/*` |
| Módulo Superadmin | `src/components/admin/*` |
| Cliente Supabase (browser) | `src/lib/supabase/client.ts` |
| Edge Functions | `supabase/functions/*` |
| POS: cobro/hash/ticket | `venxpos/src/components/PaymentModal.tsx` |
| POS: caja | `venxpos/src/components/AperturaTurnoModal.tsx`, `CashRegisterClose.tsx` |
| Guard de conexión (POS) | `venxpos/src/components/ConnectionGuard.tsx` |

---

*Fuentes en `diagramas/c4/`: `C4_Contexto.puml`, `C4_Contenedores.puml`, `C4_Componentes.puml`, `C4_Codigo.puml`.*
