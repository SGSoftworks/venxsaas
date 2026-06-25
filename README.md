# VenxPOS SaaS

Plataforma SaaS de gestión multi-tenant para VenxPOS — Punto de Venta colombiano.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Zustand |
| Router | React Router v7 |
| Backend | Supabase (Auth, Database, Edge Functions) |
| Pagos | Wompi (Sandbox API) |
| Email | Resend |
| Hosting | Vercel |
| Animaciones | GSAP + ScrollTrigger |

## Estructura

```
src/
├── components/
│   ├── landing/      # Landing page pública
│   ├── auth/         # Login, registro, guards
│   ├── payment/      # Flujo de pago Wompi
│   ├── dashboard/    # Panel del cliente
│   └── admin/        # Panel superadmin
├── lib/
│   ├── supabase/     # Cliente Supabase
│   ├── wompi/        # Cliente Wompi + tipos
│   ├── validators.ts # Zod schemas
│   └── utils.ts      # Utilidades
├── store/            # Zustand stores
├── types/            # TypeScript interfaces
├── App.tsx           # Router principal
└── main.tsx          # Entry point

supabase/
├── migrations/       # Migraciones SQL
└── functions/        # Edge Functions (Deno)
    ├── _shared/      # Código compartido
    ├── create-payment/
    ├── wompi-webhook/
    ├── create-branch/
    ├── check-payment/
    ├── send-email/
    └── renew-subscriptions/

docs/                 # Documentación completa
```

## Scripts

```bash
npm install          # Instalar dependencias
npm run dev          # Desarrollo (http://localhost:5174)
npm run build        # Build producción
npm run preview      # Previsualizar build
npm run lint         # Lint TypeScript
```

## Variables de Entorno

```env
VITE_SUPABASE_URL=https://beacnoxukkoellhecofm.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_WOMPI_PUBLIC_KEY=pub_test_
VITE_APP_URL=http://localhost:5174
VITE_SUPERADMIN_EMAILS=admin@jgsoftworks.com
```

Las llaves privadas (Wompi Private, Events, Integrity, Resend, Supabase Service Role) se configuran como **secrets en Supabase** para las Edge Functions. Nunca se exponen al frontend.

## Edge Functions

| Función | Propósito |
|---|---|
| `create-payment` | Crea payment source + transacción en Wompi |
| `wompi-webhook` | Recibe eventos, verifica firma, activa tenants |
| `create-branch` | Crea usuario auth + sucursal + branch account |
| `check-payment` | Consulta estado de transacción en Wompi |
| `send-email` | Envía emails transaccionales con Resend |
| `renew-subscriptions` | Cobro recurrente mensual de suscripciones |

## Despliegue

```bash
# 1. Desplegar migraciones Supabase
supabase db push

# 2. Desplegar Edge Functions
supabase functions deploy create-payment
supabase functions deploy wompi-webhook
supabase functions deploy create-branch
supabase functions deploy check-payment
supabase functions deploy send-email
supabase functions deploy renew-subscriptions

# 3. Desplegar frontend
npm run deploy
```

## Seguridad

- RLS en todas las tablas (aislamiento multi-tenant)
- Edge Functions con `SECURITY DEFINER`
- Webhooks Wompi verificados con SHA-256
- CSP, CORS, CSRF configurados
- Llaves privadas solo en Edge Functions
- Auditoría completa documentada en `docs/SECURITY_REPORT.md`

## Documentación

| Documento | Contenido |
|---|---|
| `ARCHITECTURE.md` | Arquitectura general del sistema |
| `SAAS_ARCHITECTURE.md` | Arquitectura detallada del SaaS |
| `POS_ARCHITECTURE.md` | Arquitectura del POS desktop |
| `DATABASE.md` | Esquema de base de datos |
| `SECURITY_REPORT.md` | Auditoría de seguridad |
| `RISK_ANALYSIS.md` | Matriz de riesgos |
| `PRODUCTION_READINESS.md` | Checklist de producción |
| `WOMPI.md` | Integración Wompi |
| `PAYMENTS_FLOW.md` | Flujo de pagos |
| `DEPLOY_GUIDE.md` | Guía de despliegue |
| `BACKUP_RECOVERY.md` | Backup y recuperación |
| `RLS_AUDIT.md` | Auditoría de políticas RLS |
| `PRODUCTION_CHECKLIST.md` | Checklist pre-lanzamiento |

## Licencia

MIT — Venx Tecnología SAS / JGSoftworks 2026
