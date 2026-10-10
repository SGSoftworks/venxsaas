# 02. Stack Tecnológico — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta Centralizado para Pequeños Negocios de Retail en Colombia
**Producto:** VenxPOS (panel SaaS + POS)
**UNINPAHU — Ingeniería de Software — Bogotá D.C., 2026**

> Documento técnico. El formato APA se reserva para `documentacion_metodologica.txt`.

---

## 1. Resumen ejecutivo

VenxPOS se construye sobre una arquitectura **cliente-servidor por capas** con **backend como servicio (BaaS, Supabase)** y **una única base de datos PostgreSQL compartida**. Dos frontends independientes (panel SaaS y POS) consumen el mismo backend. No se usa un servidor de aplicación propio (no hay Node/Express/Java en runtime de producción): la lógica de negocio privilegiada vive en **funciones RPC de PostgreSQL** y en **Edge Functions de Deno**; el frontend consume el resto directamente mediante PostgREST + RLS.

---

## 2. Stack por capa

### 2.1 Frontend

| Tecnología | Versión | Uso | Evidencia |
|---|---|---|---|
| React | ^19.2.6 | Biblioteca de UI (ambos repos) | `package.json` |
| React DOM | ^19.2.6 | Render | `package.json` |
| TypeScript | ~6.0.2 | Lenguaje (modo estricto en build) | `package.json`, `tsconfig.json` |
| Vite | ^8.0.12 | Bundler / dev server | `vite.config.ts` |
| TailwindCSS | ^4.3.1 | Estilos utilitarios | `@tailwindcss/postcss`, `src/index.css` |
| Zustand | ^5.0.14 | Estado global | `src/store/*` |
| Lucide React | ^1.20.0 | Iconografía (declarada; el POS usa SVGs propios en `Icons.tsx`) | `package.json` |

**Específicos del panel SaaS:**

| Tecnología | Versión | Uso |
|---|---|---|
| react-router-dom | ^7.4.0 | Enrutamiento (rutas declarativas en `App.tsx`) |
| react-hook-form | ^7.54.2 | Formularios |
| @hookform/resolvers | ^3.9.1 | Integración RHF + Zod |
| Zod | ^3.24.2 | Validación de esquemas |
| Recharts | ^3.8.1 | Gráficos (analítica) |
| GSAP | ^3.13.0 | Animaciones de la landing |
| xlsx | ^0.18.5 | Exportación a Excel |

**Específicos del POS:**

| Tecnología | Versión | Uso |
|---|---|---|
| jspdf | ^4.2.1 | Exportación PDF (reportes/cierre) |
| jspdf-autotable | ^5.0.8 | Tablas en PDF |
| xlsx | ^0.18.5 | Exportación a Excel |

### 2.2 Backend (BaaS Supabase)

| Componente | Servicio | Uso |
|---|---|---|
| Autenticación | Supabase Auth | Login email/contraseña, sesión con JWT, refresh token |
| Base de datos | PostgreSQL (Supabase) | 29 tablas, RLS, RPCs, triggers |
| API | PostgREST | Acceso a datos desde el frontend con RLS |
| Realtime | Supabase Realtime | No confirmado en el código revisado (sin suscripciones `channel().on()` detectadas) |
| Storage | Supabase Storage | Bucket `invoices` (PDFs de facturas) |
| Edge Functions | Supabase Edge Functions (Deno) | Lógica privilegiada con `service_role` |
| Correo | Resend | Envío de correos vía Edge Function `send-email` |

Proyecto Supabase (ref): `beacnoxukkoellhecofm` (`https://beacnoxukkoellhecofm.supabase.co`), consultado en `.env.production`, `supabase/.temp/linked-project.json`.

### 2.3 Edge Functions (Deno)

| Función | Propósito | Auth |
|---|---|---|
| `create-signup` | Registro público de negocio desde la landing | Pública (sin verificación) |
| `register-tenant` | Variante de registro (legacy) | Pública (sin verificación) — no usada por el frontend actual |
| `create-client` | Alta de cliente/tenant por superadmin | `verifySuperAdmin` |
| `approve-tenant` | Aprobación de tenant + registro de pago manual + factura | `verifySuperAdmin` |
| `admin-reset-password` | Restablecer contraseña de usuario | `verifySuperAdmin` |
| `create-branch` | Crear sucursal + cuenta de acceso | `verifyAuth` + verificación de propiedad del tenant |
| `update-branch` | Actualizar datos de sucursal | `verifyAuth` + superadmin o dueño |
| `generate-invoice` | Generar factura desde un pago | `verifyInternalKey` |
| `generate-pdf` | Renderizar el PDF de la factura | `verifyInternalKey` o `verifySuperAdmin` |
| `log-audit` | Registrar auditoría | `verifyInternalKey` |
| `send-email` | Enviar correo (Resend) | `verifyInternalKey` |

Módulos compartidos en `supabase/functions/_shared/`: `cors.ts`, `supabase.ts` (cliente `service_role`), `env.ts`, `notify.ts`, `email-template.ts`.

### 2.4 Persistencia: PostgreSQL

- **29 tablas** en el esquema `public` (introspección en vivo con `supabase gen types typescript --linked`).
- **Sin tipos ENUM**: los dominios se implementan con columnas `TEXT` + `CHECK` (evidencia: 0 `CREATE TYPE ... AS ENUM` en las migraciones).
- **RLS habilitada en todas las tablas**.
- **~50 funciones** (RPCs/helpers) en `public`.

### 2.5 Infraestructura y despliegue

| Aspecto | Detalle | Evidencia |
|---|---|---|
| Hosting frontend | Vercel (SPA con rewrites a `index.html`) | `vercel.json` |
| CI/CD | Deploy manual vía `npm run build && npx vercel --prod` (SaaS); Netlify en el POS | `package.json`, `src/lib/appConfig.ts` (`POS_WEB_URL`) |
| Repositorios | `github.com/SGSoftworks/venxsaas`, `github.com/SGSoftworks/venxpos` | `git remote -v` |
| Base de datos | Supabase administrado | CLI Supabase |

### 2.6 Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| ESLint ^10 + typescript-eslint ^8 | Linting (`npm run lint`) |
| PostCSS + Autoprefixer | Pipeline CSS |
| Supabase CLI | Migraciones, introspección, deploy de Edge Functions |
| TypeScript Compiler (`tsc -b`) | Verificación de tipos en build |

---

## 3. Seguridad del stack

| Control | Implementación |
|---|---|
| RLS | Todas las tablas públicas; políticas por tenant (`get_tenant_id`) y por sucursal (`get_user_sucursal`) |
| service_role | Solo en Edge Functions (`_shared/supabase.ts`), nunca en el bundle |
| CORS | Lista blanca de orígenes + regex de previews Vercel (`_shared/cors.ts`) |
| Cabeceras HTTP | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (`vercel.json`) |
| Validación | Zod (login); validaciones en RPC y CHECK de base de datos |
| Auditoría | `audit_logs` y `eventos_auditoria` |

---

## 4. Diagrama de stack (referencia)

```
┌──────────────┐        ┌──────────────┐
│  VenxPOS POS │        │ VenxPOS SaaS │
│ React 19+Vite│        │ React 19+Vite│
│  TypeScript  │        │ React Router │
│   Zustand    │        │  RHF + Zod   │
└──────┬───────┘        └──────┬───────┘
       │ @supabase/supabase-js │
       └───────────┬───────────┘
                   ▼
        ┌────────────────────────┐
        │  Supabase (BaaS)       │
        │  Auth │ PostgREST │ RL │
        │  Storage │ Edge Fns   │
        └───────────┬────────────┘
                    ▼
        ┌────────────────────────┐
        │ PostgreSQL (single DB) │
        │ 29 tablas · RLS · RPCs │
        └────────────────────────┘
                    ▲
                    │ Resend (email) · Vercel/Netlify (hosting)
```

---

## 5. Versiones clave (verificadas en `package.json`)

- React `^19.2.6`, React DOM `^19.2.6`, TypeScript `~6.0.2`, Vite `^8.0.12`, TailwindCSS `^4.3.1`, Zustand `^5.0.14`, `@supabase/supabase-js` `^2.108.2`.
- SaaS: `react-router-dom ^7.4.0`, `react-hook-form ^7.54.2`, `zod ^3.24.2`, `recharts ^3.8.1`, `gsap ^3.13.0`.
- POS: `jspdf ^4.2.1`, `jspdf-autotable ^5.0.8`.

---

## 6. Decisiones tecnológicas y justificación

1. **BaaS Supabase en lugar de backend propio**: reduce el costo operativo y el tiempo de desarrollo; aporta Auth, base de datos con RLS, storage y funciones serverless. Adecuado para un producto SaaS multi-inquilino de un equipo pequeño.
2. **Lógica en RPCs**: garantiza que operaciones sensibles (venta, inventario, suscripciones) se ejecuten de forma atómica y controlada cerca de los datos.
3. **Edge Functions para privilegios**: aísla operaciones que requieren `service_role` (creación de usuarios, facturación, correo).
4. **Dos frontends, un backend**: separa la experiencia del operador SaaS (gestión) de la del cajero (operación), compartiendo datos en tiempo real por medio de la misma base de datos.

---

*Las versiones exactas y los scripts de build/lint/typecheck están verificados en los `package.json` de ambos repositorios. Las funcionalidades no confirmadas (p. ej., Realtime) se marcan como no confirmadas.*
