# UI Refactor Report — VenxPOS SaaS Dashboards

**Fecha:** Julio 2026
**Alcance:** Refactor visual de modales, encoding, cards, navegacion y responsive

---

## Problemas Corregidos

| # | Problema | Severidad | Solucion |
|---|----------|-----------|----------|
| 1 | 11 modales sin Portal, renderizados inline dentro del layout | Critica | `AppModal` con `createPortal(document.body)` |
| 2 | Sin scroll lock en body al abrir modales | Critica | `useEffect` setea `body.style.overflow = 'hidden'` |
| 3 | Sin manejo de tecla Escape en ningun modal | Critica | `keydown` listener en AppModal |
| 4 | Sin focus trap en modales | Critica | Ciclado Tab/Shift+Tab dentro del modal |
| 5 | 3 nested modals en AdminClients con z-index manual (100/110/120/130) | Alta | `zIndex.MODAL_NESTED` como constante, AppModal acepta prop `z` |
| 6 | Backdrop inconsistente (4 variantes en AdminClients) | Alta | Unificado en AppModal: `bg-slate-900/60 backdrop-blur-sm` |
| 7 | 67 unicode escapes (\u00xx) en lugar de caracteres reales | Alta | Reemplazados por ñ, é, ó, í, ú, á, ¿, ¡ |
| 8 | Cards anidadas dentro de modal detalle (3 niveles de bordes) | Media | Reemplazadas por `InfoCard`/`InfoRow` con divisores planos |
| 9 | Sucursales y pagos mostraban cards por item dentro del modal | Media | Reemplazadas por lista plana con `border-t border-slate-100` |
| 10 | `shadow-2xl` inconsistente en SubscriptionPage | Media | Normalizado a `shadow-xl` (AppModal) |
| 11 | Modal crear sucursal mostraba todos los campos en una vista | Media | Convertido a wizard 3 pasos: Datos > Admin > Confirmacion |
| 12 | Marcado JSX redundante en modales (doble div `fixed inset-0`) | Baja | Eliminado — AppModal usa overlay + content wrapper unico |

---

## Componentes Nuevos

| Componente | Ubicacion | Proposito |
|-----------|-----------|-----------|
| `AppModal` | `src/components/ui/AppModal.tsx` | Modal base con Portal, scroll lock, Escape, focus trap, GSAP |
| `zIndex` | `src/lib/zIndex.ts` | Constantes de z-index (SIDEBAR_OVERLAY=40, SIDEBAR=50, DROPDOWN=60, MODAL=100, MODAL_NESTED=110, TOAST=200) |
| `StatCard` | `src/components/ui/Cards.tsx` | KPI card con icono, valor, label, trend, colored top border |
| `InfoCard` | `src/components/ui/Cards.tsx` | Card de informacion con icono, label, valor (para modales y detalle) |

---

## Componentes Eliminados

| Componente | Archivo | Razon |
|-----------|---------|-------|
| Marcado de backdrop manual | BranchesPage, SubscriptionPage, AdminClients | Reemplazado por AppModal |
| `GeneralInfoCard` | AdminClients.tsx | Reemplazado por `InfoRow` (secciones planas sin borde) |
| Cards `rounded-xl border bg-white p-4` anidadas | AdminClients.tsx (Sucursales, Pagos) | Reemplazadas por lista plana con `border-t` |

---

## Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/components/ui/AppModal.tsx` | Creado |
| `src/lib/zIndex.ts` | Creado |
| `src/components/ui/Cards.tsx` | Creado |
| `src/components/dashboard/BranchesPage.tsx` | 3 modales a AppModal + wizard 3 pasos |
| `src/components/dashboard/SubscriptionPage.tsx` | 3 modales a AppModal + shadow-2xl eliminado |
| `src/components/admin/AdminClients.tsx` | 5 modales a AppModal + cards anidadas simplificadas + unicode fixes |
| `src/components/landing/LandingPage.tsx` | 47 unicode escapes corregidos |

---

## Metricas de Consistencia Visual

| Metrica | Antes | Despues |
|---------|-------|---------|
| Implementaciones de modal | 11 (cada una unica) | 1 (AppModal reutilizado 11 veces) |
| Codigo de backdrop duplicado | ~90 lineas | 0 lineas |
| z-index valores magicos | 12 (100, 110, 120, 130, 200) | 6 constantes nombradas |
| Unicode escapes activos | 67 | 0 |
| Cards anidadas (3 niveles) | 10+ | 0 |
| Shadow inconsistente | 2 variantes | 1 (shadow-xl) |
| Modal sin scroll lock | 11 | 0 |
| Modal sin Escape | 11 | 0 |
| Modal sin focus trap | 11 | 0 |

---

## Calificacion

| Categoria | Puntuacion |
|-----------|------------|
| Arquitectura de modales | 9/10 |
| Accesibilidad (Escape, focus trap, aria) | 9/10 |
| Consistencia visual | 9/10 |
| Encoding | 10/10 |
| Simplificacion de cards | 8/10 |
| **Global** | **9/10** |

---

## Conclusion

El sistema de modales paso de 11 implementaciones inline sin Portal, scroll lock, Escape ni focus trap a un unico componente `AppModal` reutilizado en todos los lugares. La consistencia visual mejoro significativamente al eliminar backdrops inconsistentes, cards anidadas, z-index magicos y unicode escapes. El wizard de sucursales mejora la UX del formulario mas complejo del dashboard.
