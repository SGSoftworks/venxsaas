# 09. Informe de Auditoría y Brechas — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta — VenxPOS

---

## 1. Objetivo

Documentar los hallazgos de la auditoría técnica realizada sobre el código fuente y el esquema de base de datos en vivo, con severidad, evidencia, impacto y recomendación, así como las brechas y limitaciones reconocidas del sistema.

## 2. Metodología

- Revisión de ambos repositorios (`venxpos-saas` y `venxpos`), 74 migraciones, 11 Edge Functions y componentes de interfaz.
- Introspección del esquema en vivo con `supabase gen types typescript --linked` (29 tablas, ~50 funciones).
- Lectura de políticas RLS, restricciones CHECK y funciones RPC en las migraciones.
- Alcance diagnóstico: no se modificó código.

## 3. Hallazgos

### H-001 — Ticket calculado en cliente (condición de carrera) — Severidad Alta
- **Evidencia:** `venxpos/src/components/PaymentModal.tsx` calcula `MAX(ticket_number)+1` en el navegador.
- **Impacto:** dos cajas concurrentes podrían generar el mismo ticket.
- **Recomendación:** asignar el ticket con la RPC `next_ticket_number` (ya existente) de forma atómica.

### H-002 — Validación de PIN de override en cliente — Severidad Alta (seguridad)
- **Evidencia:** `venxpos/src/components/AdminOverrideModal.tsx` valida el PIN en el navegador; `usuarios.pin_acceso` se maneja en cliente.
- **Impacto:** el PIN podría evadirse manipulando el cliente.
- **Recomendación:** validar en servidor (RPC/Edge Function) y almacenar con hash.

### H-003 — Ausencia de pruebas automatizadas — Severidad Media
- **Evidencia:** existe `venxpos-saas/src/lib/utils.test.ts` pero sin runner ni script `test`; el POS no tiene pruebas.
- **Impacto:** riesgo de regresiones no detectadas.
- **Recomendación:** configurar el runner (Vitest/Jest) y automatizar los casos `CP-xxx`.

### H-004 — Plantilla de notificación desactualizada — Severidad Media
- **Evidencia:** `supabase/functions/_shared/notify.ts` no es usada por ninguna función; `send-email` no la consume.
- **Impacto:** comportamiento de correo inconsistente (RF-101 Parcial).
- **Recomendación:** unificar el envío de correo y actualizar o retirar `notify.ts`.

### H-005 — URLs de despliegue inconsistentes — Severidad Baja
- **Evidencia:** `venxpos/src/components/Login.tsx` apunta a `venxpos-saas.vercel.app`; `App.tsx`/`Receipt.tsx` usan `venxpos.vercel.app`.
- **Impacto:** confusión de configuración entre entornos.
- **Recomendación:** centralizar URLs en variables de entorno.

### H-006 — Residuo histórico de pago con tarjeta — Severidad Baja
- **Evidencia:** `venxpos-saas/src/components/dashboard/DashboardHome.tsx:50` conserva `TARJETA: 'Tarjeta'`, ya no permitido por RN-001.
- **Impacto:** inconsistencia visual; sin efecto en datos (el CHECK impide `TARJETA`).
- **Recomendación:** eliminar la etiqueta residual.

### H-007 — Claves legacy de pasarela en entorno local — Severidad Media (seguridad)
- **Evidencia:** `.env.local` conserva claves Wompi (módulo eliminado).
- **Impacto:** superficie de riesgo si el archivo se filtra.
- **Recomendación:** depurar las claves obsoletas del entorno.

## 4. Brechas y limitaciones reconocidas

1. **Pagos manuales:** no hay pasarela integrada; el superadmin registra/aprueba pagos (RN-009).
2. **Sin componente fiscal:** no se emiten facturas electrónicas DIAN ni se calculan impuestos (RN-002).
3. **Pruebas automatizadas:** inexistentes/no configuradas (H-003).
4. **PIN de override en cliente:** validación no confiable (H-002).
5. **Notificaciones por correo:** plantilla desactualizada (H-004).

## 5. Resumen por severidad

| Severidad | Hallazgos |
|---|---|
| Alta | H-001, H-002 |
| Media | H-003, H-004, H-007 |
| Baja | H-005, H-006 |

## 6. Conclusión

El núcleo funcional (ventas, devoluciones, caja, inventario con concurrencia optimista, RLS multi-inquilino y suscripciones) está implementado y es coherente con las reglas de negocio. Las brechas críticas se concentran en **concurrencia de ticket** y **validación de PIN en cliente**, además de la deuda de **pruebas automatizadas**.

---

*Hallazgos referenciados desde `01_Requerimientos_Sistema.md` (sección 7) y `08_Plan_y_Casos_de_Prueba.md`.*
