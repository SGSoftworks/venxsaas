# VenxPOS SaaS

Plataforma SaaS de gestión multi-tenant para VenxPOS — Punto de Venta colombiano.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, Zustand |
| Router | React Router v7 |
| Backend | Supabase (Auth, Database, Edge Functions) |
| Pagos | Manual (admin registra pagos) |
| Email | Resend |
| Hosting | Vercel |
| Animaciones | GSAP + ScrollTrigger |

## Estructura

```
src/
├── components/
│   ├── landing/      # Landing page pública
│   ├── auth/         # Login, registro, guards
│   ├── dashboard/    # Panel del cliente
│   └── admin/        # Panel superadmin
├── lib/
│   ├── supabase/     # Cliente Supabase
│   ├── payment/      # Registro manual de pagos
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
    ├── approve-tenant/
    ├── create-branch/
    ├── generate-invoice/
    ├── generate-pdf/
    └── send-email/

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

VITE_APP_URL=http://localhost:5174
VITE_SUPERADMIN_EMAILS=admin@jgsoftworks.com
```

Las llaves privadas (Resend, Supabase Service Role) se configuran como **secrets en Supabase** para las Edge Functions. Nunca se exponen al frontend.

## Edge Functions

| Función | Propósito |
|---|---|
| `approve-tenant` | Activa tenant y genera factura |
| `generate-pdf` | Genera PDF de factura |
| `generate-invoice` | Genera factura desde pago |
| `send-email` | Envía emails transaccionales con Resend |

> Nota MVP: renovaciones y cambios de plan self-service están **próximamente**. Se gestionan manualmente por WhatsApp y el administrador registra el pago con factura automática.

## Despliegue

```bash
# 1. Desplegar migraciones Supabase
supabase db push

# 2. Desplegar Edge Functions
supabase functions deploy approve-tenant
supabase functions deploy create-branch
supabase functions deploy send-email

# 3. Desplegar frontend
npm run deploy
```

## Seguridad

- RLS en todas las tablas (aislamiento multi-tenant)
- Edge Functions con `SECURITY DEFINER`
- Pagos registrados manualmente por el administrador
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
| `PAYMENTS_FLOW.md` | Flujo de pagos |
| `DEPLOY_GUIDE.md` | Guía de despliegue |
| `BACKUP_RECOVERY.md` | Backup y recuperación |
| `RLS_AUDIT.md` | Auditoría de políticas RLS |
| `PRODUCTION_CHECKLIST.md` | Checklist pre-lanzamiento |

## Licencia

MIT — Venx Tecnología SAS / JGSoftworks 2026
