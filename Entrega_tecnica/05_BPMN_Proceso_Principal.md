# 05. Proceso Principal (BPMN) — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta Centralizado
**UNINPAHU — Ingeniería de Software — Bogotá D.C., 2026**

Diagrama BPMN 2.0 (XML) en `diagramas/bpmn/BPMN_Venta_POS.bpmn`.

---

## 1. Alcance del proceso

El proceso principal del sistema es **"Realizar venta en el Punto de Venta"**, que abarca desde la apertura del turno del cajero hasta el cierre de caja, incluyendo el registro de la venta, el descuento de inventario, la impresión del ticket y las devoluciones. Se modela en BPMN 2.0.

---

## 2. Actores y participantes (pools/lanes)

| Carril (lane) | Responsable |
|---|---|
| **Cajero** | Operación en la terminal POS |
| **Sistema POS** | Aplicación de punto de venta (validaciones, impresión) |
| **Base de datos (Supabase/PostgreSQL)** | Persistencia, RPCs de inventario, RLS |

---

## 3. Descripción del flujo — Venta

1. **Inicio**: el cajero inicia sesión (validación de credenciales y de suscripción activa).
2. **Apertura de turno**: ingresa el fondo inicial; el sistema registra la apertura (`aperturas_caja`, estado `abierta`).
3. **Escaneo/agregado de productos**: el cajero agrega ítems al carrito; el sistema calcula subtotal y total (sin impuestos).
4. **Gateway de acciones**: ¿agregar más ítems, aplicar descuento, o proceder al pago?
5. **Procesar pago**: el cajero selecciona método (`EFECTIVO`, `BILLETERA`, `QR`, `MIXTO`).
6. **Gateways de validación**:
   - Pago `EFECTIVO`: ¿el monto recibido cubre el total? Calcular cambio.
   - Pago `MIXTO`: ¿efectivo + QR iguala el total?
7. **Verificación de stock**: el sistema consulta `inventario_sucursal`.
   - Si stock insuficiente → error, vuelve al carrito.
8. **Registro de venta**: se genera número de ticket (MAX+1) y hash SHA-256; se inserta la venta y el detalle.
9. **Descuento de inventario**: por cada ítem se invoca `decrementar_inventario` (concurrencia optimista `version`).
10. **Impresión del ticket** (`Receipt`).
11. **Fin de transacción**.

## 4. Descripción del flujo — Devolución

1. El cajero busca la venta por número de ticket.
2. El sistema recupera la venta y su detalle.
3. El cajero confirma la devolución (motivo opcional).
4. El sistema registra `devoluciones` y `devolucion_detalles` (importes negativos) y **restaura el stock** con `incrementar_inventario`.
5. Fin.

## 5. Descripción del flujo — Cierre de caja

1. El cajero ingresa el efectivo contado.
2. El sistema calcula el efectivo esperado (fondo + ventas en efectivo) y clasifica: **CUADRADO / SOBRANTE / FALTANTE**.
3. El sistema registra `cierres_caja`, actualiza la apertura a `cerrada` y genera un evento de auditoría.
4. Opcionalmente exporta el cierre a PDF y cierra la sesión.

---

## 6. Reglas de negocio aplicadas en el proceso

- **RN-001**: método de pago ∈ {EFECTIVO, BILLETERA, QR, MIXTO}.
- **RN-002**: total = subtotal (sin impuestos).
- **RN-003**: MIXTO = efectivo + QR (suma = total).
- **RN-005**: no se puede vender sin stock suficiente.
- **RN-058**: ticket incremental por sucursal.

---

## 7. Estructura del modelo BPMN

El archivo `BPMN_Venta_POS.bpmn` contiene:

- Un proceso con pools para **Cajero**, **Sistema POS** y **Base de datos**.
- Evento de inicio, tareas de usuario (`userTask`) y de servicio (`serviceTask`), gateways exclusivos (`exclusiveGateway`) para método de pago y validación de stock, y eventos de fin.
- Compatible con BPMN 2.0 (namespace `http://www.omg.org/spec/BPMN/20100524/MODEL`).

> Validación: el XML es bien formado y usa únicamente elementos del estándar BPMN 2.0. La renderización a imagen requiere una herramienta BPMN (p. ej. bpmn.io / Camunda Modeler), no disponible en el entorno de generación; se entrega el XML, que puede abrirse en dichas herramientas.

---

## 8. Trazabilidad proceso → sistema

| Paso BPMN | Evidencia en el sistema |
|---|---|
| Inicio de sesión | `venxpos/src/components/Login.tsx` |
| Verificación de suscripción | RPC `get_subscription_info`; `venxpos/src/App.tsx` |
| Apertura de turno | `AperturaTurnoModal.tsx`; tabla `aperturas_caja` |
| Carrito y totales | `useAppStore.ts` (`addToCart`, `calculateTotals`) |
| Procesar pago / método | `PaymentModal.tsx` |
| Verificación de stock | `PaymentModal.tsx` (SELECT `inventario_sucursal`) |
| Registro de venta | `PaymentModal.tsx` (INSERT `ventas`, `venta_detalles`) |
| Descuento de inventario | RPC `decrementar_inventario` |
| Impresión de ticket | `Receipt.tsx` |
| Devolución | `ReturnModal.tsx`; RPC `incrementar_inventario` |
| Cierre de caja | `CashRegisterClose.tsx`; tablas `cierres_caja`, `eventos_auditoria` |

---

*Diagrama fuente en `diagramas/bpmn/BPMN_Venta_POS.bpmn`.*
