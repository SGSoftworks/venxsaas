# 08. Plan y Casos de Prueba — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta — VenxPOS

---

## 1. Objetivo y alcance

Definir la estrategia de verificación del sistema VenxPOS y los casos de prueba que cubren los requerimientos, reglas de negocio y procesos documentados en los entregables 01, 04, 05 y 07. Los casos `CP-xxx` son referenciados por la matriz de trazabilidad.

## 2. Estrategia de pruebas

| Nivel | Técnica | Herramienta / medio | Estado actual |
|---|---|---|---|
| Unitaria | Caja blanca de funciones puras | Jest/Vitest (por configurar) | **Brecha**: existe `venxpos-saas/src/lib/utils.test.ts` pero no hay runner ni script `test` |
| Integración | API/BD (RLS, RPC) | Supabase (`gen types`, SQL manual) | Manual |
| Sistema (E2E) | Caja negra funcional | Ejecución manual en navegador | Manual |
| Regresión | Casos funcionales clave | Manual | Manual |

> **Brecha declarada:** el POS no posee pruebas automatizadas y el panel SaaS no tiene runner configurado. El plan describe pruebas **manuales** ejecutables y sirve como base para automatizar.

### Entornos

- **Producción:** `venxpos-saas.vercel.app` / `venxpos.vercel.app`.
- **Backend:** Supabase (proyecto `beacnoxukkoellhecofm`).
- **Datos:** ejecutar en sucursal/tenant de prueba y, cuando aplique, revertir transacciones.

### Convenciones

- Cada caso: precondiciones, pasos, resultado esperado, criterio de aceptación.
- Prioridad: **Alta** (núcleo), **Media**, **Baja**.
- Tipo: funcional, seguridad, integridad de datos, usabilidad.

---

## 3. Casos de prueba

### CP-001 — Registro de negocio
- **Requerimientos:** RF-001, RF-002, RF-005, RF-007. **Prioridad:** Alta.
- **Precondiciones:** landing pública accesible.
- **Pasos:** completar formulario (negocio, NIT, correo, teléfono, plan) → enviar.
- **Esperado:** se crea `auth.users`, `tenants` en `pending_approval` y `client_id` legible.
- **Aceptación:** registro persistido y visible para superadmin.

### CP-002 — Duplicados de correo/NIT
- **Requerimientos:** RF-003, RN-013. **Prioridad:** Alta.
- **Pasos:** registrar dos negocios con el mismo NIT o correo.
- **Esperado:** el segundo registro es rechazado por las restricciones UNIQUE.
- **Aceptación:** error controlado; sin duplicados.

### CP-003 — Aprobación de tenant y pago inicial
- **Requerimientos:** RF-004, RF-006, RN-009. **Prioridad:** Alta.
- **Pasos:** como superadmin, aprobar tenant pendiente y registrar pago inicial.
- **Esperado:** `tenants.estado` pasa a `active`, se crea pago `MANUAL` y suscripción.
- **Aceptación:** acceso habilitado para el dueño.

### CP-004 — Login y control de acceso por rol
- **Requerimientos:** RF-010, RF-011, RF-014, RNF-001. **Prioridad:** Alta.
- **Pasos:** iniciar sesión con cada rol (superadmin, admin de negocio, cajero) e intentar rutas no autorizadas.
- **Esperado:** cada rol accede solo a sus rutas (`/admin`, `/dashboard`, POS).
- **Aceptación:** redirección/bloqueo correcto.

### CP-005 — Cambio de contraseña forzado
- **Requerimientos:** RF-012. **Prioridad:** Media.
- **Pasos:** iniciar sesión con cuenta de contraseña temporal.
- **Esperado:** se exige cambio antes de operar.
- **Aceptación:** `must_change_password` se limpia tras el cambio.

### CP-006 — Restablecer contraseña
- **Requerimientos:** RF-013. **Prioridad:** Media.
- **Pasos:** como superadmin, restablecer contraseña de un usuario.
- **Esperado:** Edge Function `admin-reset-password` actualiza la credencial.
- **Aceptación:** el usuario ingresa con la nueva contraseña.

### CP-007 — PIN de autorización (override)
- **Requerimientos:** RF-015. **Prioridad:** Media. **Tipo:** seguridad.
- **Pasos:** ejecutar una operación administrativa en el POS e ingresar PIN.
- **Esperado:** la operación se autoriza con el PIN correcto.
- **Aceptación:** **Parcial** — la validación se realiza en cliente con PIN almacenado en texto; debe migrarse a validación server-side.

### CP-008 — Bloqueo por suscripción inactiva
- **Requerimientos:** RF-023, RN-007. **Prioridad:** Alta.
- **Pasos:** pausar la suscripción del tenant e intentar operar.
- **Esperado:** POS y panel bloquean el acceso operativo.
- **Aceptación:** mensaje claro de cuenta pausada.

### CP-009 — Información de suscripción y estados
- **Requerimientos:** RF-021, RF-022, RN-008. **Prioridad:** Alta.
- **Pasos:** consultar `get_subscription_info`; simular vencimiento.
- **Esperado:** estado y próximo cobro correctos; vencida pasa a `past_due` y a `expired` tras 14 días.
- **Aceptación:** transición de estados conforme a la regla.

### CP-010 — Renovación / cambio de plan manual
- **Requerimientos:** RF-024, RF-025. **Prioridad:** Media.
- **Pasos:** generar solicitud de renovación/cambio y aprobarla como superadmin.
- **Esperado:** suscripción renovada/cambiada y evento registrado.
- **Aceptación:** `subscription_requests` y `subscription_events` actualizados.

### CP-011 — Límite de sucursales por plan
- **Requerimientos:** RF-030, RF-033, RN-010. **Prioridad:** Media.
- **Pasos:** intentar crear sucursales por encima de `max_sucursales`.
- **Esperado:** creación rechazada al alcanzar el límite.
- **Aceptación:** conteo correcto con `count_branches_for_tenant`.

### CP-012 — Crear/actualizar sucursal y su cuenta
- **Requerimientos:** RF-031, RF-032. **Prioridad:** Alta.
- **Pasos:** crear sucursal y editar sus datos.
- **Esperado:** se crea usuario de sucursal (`rol=admin`) y se persisten los cambios.
- **Aceptación:** cuenta operativa en el POS.

### CP-013 — Productos y categorías
- **Requerimientos:** RF-040, RF-041, RN-011. **Prioridad:** Alta.
- **Pasos:** crear categoría (con jerarquía) y productos; repetir código de barras en la misma sucursal.
- **Esperado:** alta exitosa; código duplicado rechazado.
- **Aceptación:** UNIQUE(`sucursal_id`,`codigo_barras`) aplica.

### CP-014 — Stock por sucursal y concurrencia
- **Requerimientos:** RF-042, RNF-013. **Prioridad:** Alta.
- **Pasos:** ejecutar dos ventas concurrentes sobre el mismo producto.
- **Esperado:** el versionado evita sobreventa; una falla por conflicto.
- **Aceptación:** stock consistente (`version`).

### CP-015 — Movimientos de inventario
- **Requerimientos:** RF-043, RN-012. **Prioridad:** Media.
- **Pasos:** realizar entrada, ajuste y salida manual.
- **Esperado:** cada movimiento queda con tipo válido y stock resultante.
- **Aceptación:** kardex consistente.

### CP-016 — Venta en efectivo y cambio
- **Requerimientos:** RF-050–RF-055, RF-061, RN-001, RN-002. **Prioridad:** Alta.
- **Pasos:** agregar ítems, seleccionar EFECTIVO, ingresar monto y confirmar.
- **Esperado:** venta registrada, `total = subtotal` (sin impuestos) y cambio correcto.
- **Aceptación:** ticket emitido con datos correctos.

### CP-017 — Venta QR / billetera
- **Requerimientos:** RF-054. **Prioridad:** Media.
- **Pasos:** cobrar con método QR o BILLETERA.
- **Esperado:** venta registrada con el método seleccionado.
- **Aceptación:** método persistido correctamente.

### CP-018 — Venta MIXTO
- **Requerimientos:** RF-056, RN-003. **Prioridad:** Alta.
- **Pasos:** cobrar MIXTO con efectivo + QR que no suman el total; luego con suma exacta.
- **Esperado:** primera intento bloqueado; segundo confirmado.
- **Aceptación:** validación `mixOk` correcta.

### CP-019 — Stock insuficiente
- **Requerimientos:** RF-057, RN-005. **Prioridad:** Alta.
- **Pasos:** intentar vender más unidades que el stock disponible.
- **Esperado:** venta bloqueada con error.
- **Aceptación:** sin descuento de stock.

### CP-020 — Ticket incremental e integridad
- **Requerimientos:** RF-058, RF-059, RN-004. **Prioridad:** Alta.
- **Pasos:** registrar varias ventas en la misma sucursal.
- **Esperado:** ticket = `MAX+1` por sucursal y hash SHA-256 generado.
- **Aceptación:** sin colisiones de ticket en secuencia.

### CP-021 — Impresión de ticket
- **Requerimientos:** RF-060. **Prioridad:** Media.
- **Pasos:** imprimir el ticket de una venta.
- **Esperado:** ticket con sucursal, ítems, totales y método de pago.
- **Aceptación:** `window.print()` genera salida correcta.

### CP-022 — Apertura de turno
- **Requerimientos:** RF-070. **Prioridad:** Alta.
- **Pasos:** iniciar turno con fondo inicial.
- **Esperado:** se exige apertura antes de operar; `aperturas_caja` creado.
- **Aceptación:** POS operativo solo tras apertura.

### CP-023 — Cierre de caja
- **Requerimientos:** RF-071–RF-074. **Prioridad:** Alta.
- **Pasos:** ingresar efectivo contado en escenarios cuadrado, sobrante y faltante.
- **Esperado:** clasificación correcta; `cierres_caja` creado y apertura cerrada; evento de auditoría; PDF disponible.
- **Aceptación:** diferencia calculada correctamente.

### CP-024 — Devolución y restock
- **Requerimientos:** RF-080–RF-082, RN-006. **Prioridad:** Alta.
- **Pasos:** buscar venta por ticket, registrar devolución.
- **Esperado:** devolución con valores negativos y stock restaurado.
- **Aceptación:** `incrementar_inventario` ejecutado.

### CP-025 — Factura SaaS y número secuencial
- **Requerimientos:** RF-090, RF-091, RN-002. **Prioridad:** Media.
- **Pasos:** generar factura desde un pago.
- **Esperado:** número `VENX-AAAA-NNNNNN` secuencial; subtotal = total.
- **Aceptación:** `invoice_counter` incrementado.

### CP-026 — PDF de factura
- **Requerimientos:** RF-092. **Prioridad:** Media.
- **Pasos:** generar el PDF de una factura.
- **Esperado:** PDF almacenado en el bucket `invoices` y enlazado.
- **Aceptación:** PDF descargable.

### CP-027 — KPIs, reportes y exportación
- **Requerimientos:** RF-093, RF-094, RF-095, RF-096, RF-102. **Prioridad:** Media.
- **Pasos:** consultar KPIs y exportar a Excel; abrir enlace de WhatsApp.
- **Esperado:** métricas y archivos correctos.
- **Aceptación:** exportación válida (`xlsx`).

### CP-028 — Auditoría
- **Requerimientos:** RF-100, RNF-014. **Prioridad:** Media.
- **Pasos:** ejecutar acciones sensibles (aprobación, cierre de caja).
- **Esperado:** registros en `audit_logs` / `eventos_auditoria`.
- **Aceptación:** trazabilidad de la acción.

### CP-029 — Aislamiento RLS multi-tenant
- **Requerimientos:** RNF-002, RNF-003. **Prioridad:** Alta. **Tipo:** seguridad.
- **Pasos:** con la sesión del tenant A, intentar leer datos del tenant B.
- **Esperado:** RLS impide el acceso entre tenants y entre sucursales.
- **Aceptación:** solo datos propios visibles.

### CP-030 — Correos transaccionales
- **Requerimientos:** RF-101. **Prioridad:** Baja. **Tipo:** integración.
- **Pasos:** invocar el envío de correo de notificación.
- **Esperado:** correo despachado vía Resend.
- **Aceptación:** **Parcial** — la plantilla `_shared/notify.ts` está desactualizada y no es usada por ninguna función; requiere revisión.

---

## 4. Criterios de salida

- Todos los casos de prioridad **Alta** ejecutados y aprobados.
- Sin defectos bloqueantes abiertos en venta, caja, devolución y aislamiento (RLS).
- Las brechas declaradas (pruebas automatizadas, PIN en cliente, `notify.ts`) permanecen documentadas en `09_Informe_Auditoria_y_Brechas.md`.

---

*Los `CP-xxx` están referenciados en `07_Matriz_Trazabilidad.md`.*
