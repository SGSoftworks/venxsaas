# AGENTS.md — Convenciones para agentes de código

## Stack tecnológico

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v4, Zustand
- **Routing**: React Router v7
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React
- **Animaciones**: GSAP + ScrollTrigger (solo landing), Motion (microinteracciones)
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **Pagos**: Manual (administrador registra pagos)
- **Email**: Resend
- **Hosting**: Vercel (SPA rewrites)

## Estilo de código

### General
- TypeScript estricto (`"strict": true`)
- Sin `enum`, usar `type` o `const as const`
- `snake_case` para columnas de base de datos, `camelCase` para JS/TS
- Importaciones con alias `@/` → `src/`
- Sin comentarios dentro de JSX o lógica (solo para documentación)
- Código en español (nombres de variables, funciones, UI)

### Componentes
- `export function ComponentName()` en archivos `.tsx`
- Props tipadas en interfaz inline o type
- TailwindCSS para estilos (sin CSS modules ni styled-components)
- Estados: loading, error, empty, success
- Sin cards genéricas ni sombras exageradas
- Tablas compactas, formularios limpios, badges de estado

### Stores (Zustand)
- Una store por dominio (auth, ui)
- Acciones asíncronas con try/catch
- Estado inicial explícito

### Supabase
- Cliente browser: `@/lib/supabase/client.ts` (anon key)
- Cliente admin: solo en Edge Functions (service_role)
- Queries con `.select()`, `.eq()`, `.single()`, `.maybeSingle()`
- Siempre usar RLS-aware queries (sin bypass)

### Edge Functions
- Deno TypeScript en `supabase/functions/`
- Código compartido en `_shared/`
- Validar auth con `supabaseAdmin.auth.getUser(jwt)`
- Manejar CORS con `corsHeaders`
- Retornar JSON con status codes apropiados

### Pagos
- Los pagos se registran manualmente por el administrador. No hay pasarela de pagos integrada (se eliminó Wompi y toda columna `gateway_*` de la BD).

## Estructura de archivos

```
src/components/{domain}/{Component}.tsx
src/lib/{domain}/{file}.ts
src/store/{store}.ts
src/types/{types}.ts
```

## UI/UX

- Estilo profesional tipo POS comercial (Loyverse, Shopify POS)
- Sin emojis
- Animaciones solo en landing page (GSAP) y microinteracciones (Motion)
- Dashboard: priorizar performance y claridad
- Estados visuales claros con badges de colores
- Tablas con buen espaciado y tipografía monoespaciada para números
- Formularios compactos con validación Zod

## Seguridad

- CSRF tokens donde sea necesario
- CSP configurado en vercel.json
- X-Frame-Options: DENY
- Nunca exponer llaves privadas en el bundle
- RLS en todas las tablas
- Zod en todos los inputs de API

## Testing

- `npm run build` debe compilar sin errores
- `npm run lint` debe pasar sin errores
