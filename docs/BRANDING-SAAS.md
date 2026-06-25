# Branding Corporativo — VenxPOS / VenxPOS SaaS

> **Versión:** 1.0  
> **Última actualización:** Julio 2026  
> **Propósito:** Esta es la única paleta oficial. No se permiten colores fuera de esta especificación.

---

## Filosofía de diseño

Plataforma SaaS profesional de gestión comercial tipo POS. El diseño debe transmitir:

- **Confiabilidad** — azul corporativo como ancla visual
- **Profesionalismo** — grises neutros, tipografía limpia, espaciado generoso
- **Claridad** — estados claros (verde = bueno, amarillo = atención, rojo = solo error)
- **Unidad** — misma identidad en POS (Tauri) y SaaS (web)

---

## Paleta oficial

### Colores primarios

| Token | Hex | Tailwind | Uso |
|-------|-----|----------|-----|
| `primary` | `#6D3CF5` | `brand-600` | Botones principales, CTA, links, activo, navegación activa |
| `primary-dark` | `#5B2EE0` | `brand-800` | Hover de botones primarios, badges secundarios, tarjetas destacadas |
| `primary-light` | `#EDE9FE` | `brand-100` | Fondos de iconos, badges informativos |
| `primary-border` | `#C4B5FD` | `brand-300` | Bordes de elementos destacados |

### Colores accent

| Token | Hex | Tailwind | Uso |
|-------|-----|----------|-----|
| `accent` | `#16D6C1` | `teal-400` | Gráficos, highlights, indicadores secundarios, CTAs alternativos |

### Colores oscuros

| Token | Hex | Tailwind | Uso |
|-------|-----|----------|-----|
| `navy` | `#0F172A` | `slate-900` | Textos principales, headers, sidebar, footer, fondos oscuros, títulos |
| `text-secondary` | `#64748B` | `slate-500` / `gray-500` | Textos secundarios, placeholders, información auxiliar |

### Colores de estado

| Token | Hex | Tailwind | Uso |
|-------|-----|----------|-----|
| `success` | `#10B981` | `green-500` / `emerald-500` | Caja abierta, pago aprobado, stock correcto, turno activo |
| `success-light` | `#D1FAE5` | `green-100` | Fondos de badges éxito |
| `success-border` | `#A7F3D0` | `green-200` | Bordes de elementos éxito |
| `warning` | `#F59E0B` | `amber-500` | Stock bajo, por vencer, atención |
| `warning-light` | `#FEF3C7` | `amber-100` | Fondos de badges warning |
| `warning-border` | `#FDE68A` | `amber-200` | Bordes de elementos warning |
| `danger` | `#EF4444` | `red-500` | Solo errores críticos, sin stock, delete |
| `danger-light` | `#FEE2E2` | `red-100` | Fondos de error |
| `danger-border` | `#FECACA` | `red-200` | Bordes de error |

### Colores neutros

| Token | Hex | Tailwind | Uso |
|-------|-----|----------|-----|
| `surface` | `#FFFFFF` | `white` | Fondos de tarjetas, modales, paneles |
| `surface-alt` | `#F8FAFC` | `slate-50` | Fondos alternos, body |
| `border` | `#E2E8F0` | `slate-200` | Bordes suaves, divisores, inputs |
| `icon` | `#94A3B8` | `slate-400` | Iconos neutros, hints |

---

## Botones

### Primario (acción principal)
```
background: #6D3CF5
hover:      #5B2EE0
text:       #FFFFFF
padding:    10px 20px
radius:     10px
font:       14px semibold
```

### Secundario (acción alternativa)
```
background: #FFFFFF
border:     1px solid #E2E8F0
hover:      #F8FAFC
text:       #0F172A
```

### Éxito (confirmar, activar)
```
background: #10B981
hover:      darken 10%
text:       #FFFFFF
```

### Peligro (solo eliminar/desactivar)
```
background: #EF4444
hover:      darken 10%
text:       #FFFFFF
```

---

## Tarjetas

```
background: #FFFFFF
border:     1px solid #E2E8F0
radius:     16px
shadow:     0 4px 12px rgba(15,23,42,0.06)
hover:      translateY(-2px) + shadow más notorio
```

No usar tarjetas genéricas ni sombras exageradas.

---

## Formularios

| Elemento | Normal | Focus |
|----------|--------|-------|
| Borde | `#E2E8F0` | `#6D3CF5` |
| Ring | — | `rgba(37,99,235,0.15)` 3px |
| Placeholder | `#64748B` | — |
| Label | `#0F172A` 13px semibold | — |

---

## Sidebar (Dashboard)

```
background: #0F172A
text:       #FFFFFF
active:     #6D3CF5
hover:      rgba(255,255,255,0.05)
```

---

## Landing page (SaaS)

```
hero fondo: #FFFFFF
detalles:   #6D3CF5
botones:    #6D3CF5
hover:      #5B2EE0
```

Prohibido: gradientes exagerados, efectos visuales distractores.

---

## Estados POS

| Estado | Color |
|--------|-------|
| Caja abierta | `#10B981` |
| Caja cerrada | `#64748B` |
| Stock bajo | `#F59E0B` |
| Sin stock | `#EF4444` |
| Venta completada | `#10B981` |
| Venta anulada | `#EF4444` |
| Sin turno | `#F59E0B` (pulse) |

---

## PDFs (facturas, cierres, reportes)

- Logo VenxPOS en header
- `#0F172A` para títulos
- `#6D3CF5` para destacados (montos, IDs)
- `#10B981` para estados positivos
- `#E2E8F0` para líneas divisoras

---

## Animaciones

| Tipo | Duración | Timing |
|------|----------|--------|
| fadeIn | 0.4s | ease-out |
| slideUp | 0.5s | ease-out |
| scaleIn | 0.25s | ease-out |
| fadeUp | 0.5s | ease-out |
| pulse-soft | 2s | ease-in-out infinite |

---

## Colores PROHIBIDOS

| Color | Razón |
|-------|-------|
| `emerald` / `teal` | Usar `success` (`#10B981`) |
| `violet` / `purple` | Usar `primary` (`#6D3CF5`) |
| `rose` / `pink` | Usar `primary` |
| `cyan` / `sky` | Usar `primary` |
| `orange` | Usar `warning` o `primary` |
| `lime` / `fuchsia` | No usar |
| Amarillos saturados | Usar `warning` |
| Rojos no-error | Solo para `danger` |

---

## Implementación técnica

### CSS Variables (ambos proyectos)

```css
:root {
  --color-primary: #6D3CF5;
  --color-primary-dark: #5B2EE0;
  --color-primary-light: #EDE9FE;
  --color-primary-border: #C4B5FD;
  --color-accent: #16D6C1;
  --color-navy: #0F172A;
  --color-success: #10B981;
  --color-success-light: #D1FAE5;
  --color-success-border: #A7F3D0;
  --color-warning: #F59E0B;
  --color-warning-light: #FEF3C7;
  --color-warning-border: #FDE68A;
  --color-danger: #EF4444;
  --color-danger-light: #FEE2E2;
  --color-danger-border: #FECACA;
  --color-surface: #FFFFFF;
  --color-surface-alt: #F8FAFC;
  --color-border: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-icon: #94A3B8;
}
```

### SaaS `@theme` (Tailwind v4)

```css
@theme {
  --color-brand-50: #f5f3ff;
  --color-brand-100: #ede9fe;
  --color-brand-200: #ddd6fe;
  --color-brand-300: #c4b5fd;
  --color-brand-400: #a78bfa;
  --color-brand-500: #8b5cf6;
  --color-brand-600: #6D3CF5;
  --color-brand-700: #5B2EE0;
  --color-brand-800: #4c1d95;
  --color-brand-900: #3b1e7e;
  --color-accent-400: #16D6C1;
  --color-success-50: #ecfdf5;
  --color-success-100: #d1fae5;
  --color-success-200: #a7f3d0;
  --color-success-500: #10b981;
  --color-success-600: #059669;
  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-200: #fde68a;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-200: #fecaca;
  --color-danger-500: #ef4444;
  --color-surface: #f8fafc;
}
```

---

## Chart colors

Para gráficos (Recharts), usar esta paleta en orden:

```js
const CHART_COLORS = ['#6D3CF5', '#16D6C1', '#10B981', '#F59E0B', '#5B2EE0', '#94A3B8']
```

---

## QA Checklist

- [ ] Todos los `bg-emerald-*` reemplazados por `bg-success-*` o `bg-green-*`
- [ ] Todos los `bg-violet-*` / `bg-rose-*` / `bg-cyan-*` / `bg-teal-*` reemplazados
- [ ] Botones primarios usan `#6D3CF5` / hover `#5B2EE0`
- [ ] Sidebar usa `#0F172A`
- [ ] Inputs focus ring usa `#6D3CF5` con opacidad 0.15
- [ ] Tarjetas usan `border: #E2E8F0`, `radius: 16px`, `shadow` correcto
- [ ] Sin rojos en contextos no-error
- [ ] Sin amarillos saturados
- [ ] Contraste AA en todos los textos
- [ ] Build sin errores
