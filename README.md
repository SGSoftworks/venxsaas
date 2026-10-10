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

docs/                 # Arquitectura del sistema
Entrega_tecnica/      # Documentación técnica completa
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
- `service_role` solo en Edge Functions (nunca en el bundle)
- Pagos registrados manualmente por el administrador
- Cabeceras HTTP (CSP, `X-Frame-Options: DENY`, etc.) y CORS
- Auditoría en las tablas `audit_logs` y `eventos_auditoria`

## Documentación

| Documento | Contenido |
|---|---|
| `Entrega_tecnica/` | Documentación técnica completa: requerimientos, stack, arquitectura, modelo de datos, BPMN, C4, matriz de trazabilidad, plan de pruebas e informe de auditoría. |
| `docs/ARCHITECTURE.md` | Resumen de la arquitectura del sistema. |

## Licencia

MIT — Venx Tecnología SAS / JGSoftworks 2026
