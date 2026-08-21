# Pre-Production Checklist — VenxPOS SaaS

## Logs y Monitoreo
- [ ] Configurar Supabase Logs para Edge Functions (errores + duracion)
- [ ] Revisar `console.log()` statements en produccion (limpiar o losear)
- [ ] Configurar alerta de errores > 5% en Edge Functions
- [ ] Monitorear uso de BD (conexiones, slow queries via pg_stat_statements)

## Backups
- [ ] Backup diario automatizado de Supabase (retencion 7 dias)
- [ ] Verificar RPO (Recovery Point Objective) ≤ 24h
- [ ] Probar restauracion en entorno staging

## Seguridad
- [ ] Verificar CSP en vercel.json (sin Wompi)
- [ ] Confirmar RLS activo en todas las tablas publicas
- [ ] Rotar claves de servicio (SUPABASE_SERVICE_ROLE_KEY, INTERNAL_API_KEY)
- [ ] Verificar que no hay secretos hardcodeados en el bundle
- [ ] Confirmar X-Frame-Options: DENY

## Performance
- [ ] Verificar code splitting (lazy loading de rutas)
- [ ] Revisar tamano de chunks (target < 200KB gzip por chunk)
- [ ] Cache headers para assets estaticos en Vercel
- [ ] Indices de BD para queries frecuentes

## DNS y Dominio
- [ ] Configurar dominio personalizado en Vercel
- [ ] SSL/TLS forzado (Vercel automatico)
- [ ] Rewrites SPA configurados (vercel.json)

## Edge Functions
- [ ] Verificar timeout (120s max en Vercel Pro)
- [ ] Confirmar CORS headers correctos
- [ ] Revisar manejo de errores con try/catch
- [ ] Verificar INTERNAL_API_KEY en secrets de Supabase

## Email
- [ ] Configurar Resend con dominio verificado
- [ ] Probar emails transaccionales (bienvenida, factura, renovacion)

## Post-Produccion
- [ ] Monitorear primeras 24h post-deploy
- [ ] Tener plan de rollback (git revert + redeploy)
- [ ] Notificar a usuarios sobre ventana de mantenimiento
