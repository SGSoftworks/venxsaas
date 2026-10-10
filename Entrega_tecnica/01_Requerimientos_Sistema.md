# 01. Requerimientos del Sistema — VenxPOS

**Proyecto:** Sistema de Gestión Comercial y Punto de Venta Centralizado para Pequeños Negocios de Retail en Colombia
**Producto:** VenxPOS (panel SaaS + aplicación de punto de venta)
**Programa:** Ingeniería de Software — UNINPAHU, Bogotá D.C., 2026
**Integrantes:** Juan Manuel Pinzon Aunta, Juan David Gomez Ruidiaz, Ivan Jair Mendoza Solano
**Directora:** Luisa Fernanda Loza Muñeton

> Documento técnico. No usa formato APA (la portada y referencias APA se reservan para `documentacion_metodologica.txt`).

---

## 1. Propósito y alcance

VenxPOS es un sistema de dos aplicaciones web que comparten una única base de datos en Supabase:

- **VenxPOS SaaS** (panel administrativo multi-inquilino): gestiona negocios (*tenants*), planes, suscripciones, pagos manuales, sucursales, inventario consolidado, facturación y analítica. Routed en `/dashboard` (dueño de negocio) y `/admin` (superadministrador).
- **VenxPOS POS** (terminal de punto de venta): registra ventas por sucursal, controla inventario, gestiona apertura/cierre de caja y devoluciones. Es una SPA que consume la misma base de datos.

El alcance de esta entrega cubre las funcionalidades **realmente implementadas y verificables** en el código y el esquema. Los requerimientos se clasifican con trazabilidad hacia el código y la base de datos en el documento `07_Matriz_Trazabilidad.md`.

**Fuera de alcance (excluido explícitamente):** pasarelas de pago en línea (Wompi y similares), facturación electrónica fiscal ante la DIAN, cálculo de impuestos (IVA/impoconsumo) y automatizaciones tributarias. Estos módulos no forman parte del sistema y no se describen como requisitos.

---

## 2. Actores y roles

| Actor | Descripción | Evidencia |
|---|---|---|
| **Superadministrador** | Operador de la plataforma VenxPOS. Gestiona clientes/tenants, aprueba solicitudes, registra pagos manuales, emite facturas SaaS y consulta analítica global. | `src/components/auth/GerenteGuard.tsx`; `src/components/admin/*`; tabla `superadmins` |
| **Dueño de negocio / Gerente** | Propietario del negocio (tenant). Administra sucursales, inventario, configuración y su suscripción. | `src/components/auth/AdminNegocioGuard.tsx`; `src/components/dashboard/*`; rol `admin_negocio` en `branch_accounts` |
| **Cajero** | Opera la terminal POS: inicia turno, registra ventas y devoluciones, cierra caja. | `src/components/POSLayout.tsx`; `usuarios.rol = 'cajero'`; `branch_accounts.rol = 'cajero'` |
| **Cliente final** | Comprador. No interactúa con el sistema; recibe el ticket impreso. | `src/components/Receipt.tsx` |

Roles técnicos detectados:
- `usuarios.rol` admite `'cajero'` y `'admin'` (`supabase/migrations/20260617043200_init_schema.sql`, tabla `usuarios`).
- `branch_accounts.rol` admite `'admin_negocio'` y `'cajero'` (`20260729000001_roles_permisos.sql`).
- La función `get_my_role()` devuelve el rol del usuario en `branch_accounts` (por defecto `'cajero'`), y `es_admin_negocio()` valida `rol = 'admin_negocio' AND activo = true`.

---

## 3. Requerimientos funcionales (RF)

### 3.1 Gestión de negocios (tenants) y registro

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-001 | El sistema debe permitir el registro de un nuevo negocio desde la landing pública, capturando nombre de negocio, NIT, correo, teléfono y plan. | Implementado | Edge Function `create-signup/index.ts` |
| RF-002 | El sistema debe crear la cuenta de autenticación del propietario y un registro de tenant en estado `pending_approval`. | Implementado | `create-signup/index.ts` (inserta `tenants` con `estado: 'pending_approval'`) |
| RF-003 | El sistema debe validar que el correo y el NIT no estén duplicados al registrar. | Implementado | `create-signup/index.ts`; unicidad `tenants.nit`, `tenants.client_id` (`20260623000000_nit_unique.sql`, `20260726000000_client_id_and_invoice.sql`) |
| RF-004 | El superadministrador debe poder aprobar un tenant pendiente, activarlo y registrar el pago inicial como pago manual. | Implementado | Edge Function `approve-tenant`; RPC `approve_tenant` (`20260718000002_fix_approve_rpc.sql`); `payments.payment_method_type = 'MANUAL'` |
| RF-005 | El superadministrador debe poder crear clientes/negocios directamente. | Implementado | Edge Function `create-client/index.ts` |
| RF-006 | El sistema debe permitir cambiar el estado del negocio (`pending_payment`, `pending_approval`, `active`, `suspended`, `cancelled`). | Implementado | `tenants.estado` CHECK (`20260714000000_pending_approval.sql`) |
| RF-007 | El sistema debe generar un identificador de cliente legible (`client_id`) por negocio. | Implementado | `generate_client_id()` + trigger `trg_client_id` (`20260726000000_client_id_and_invoice.sql`) |

### 3.2 Autenticación y control de acceso

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-010 | El sistema debe permitir el inicio de sesión con correo y contraseña (Supabase Auth). | Implementado | `src/components/auth/LoginPage.tsx`; `src/components/Login.tsx` (POS) |
| RF-011 | El sistema debe restringir rutas según rol (superadmin, admin de negocio, cajero). | Implementado | `AuthGuard`, `GerenteGuard`, `AdminNegocioGuard` |
| RF-012 | El sistema debe forzar el cambio de contraseña cuando el usuario fue creado con contraseña temporal. | Implementado | `tenants.must_change_password`, `temp_password` (`20260728000000_add_temp_password.sql`, `20260730000000_must_change_password.sql`); `ChangePasswordPage.tsx` |
| RF-013 | El superadministrador debe poder restablecer la contraseña de un usuario. | Implementado | Edge Function `admin-reset-password/index.ts` |
| RF-014 | El POS debe exigir una sesión válida y pertenencia a una sucursal. | Implementado | `src/components/Login.tsx` (consulta `usuarios` por `user_id`); `src/App.tsx` |
| RF-015 | El POS debe validar un PIN de autorización para operaciones administrativas (anulación/override). | Parcial | `src/components/AdminOverrideModal.tsx` (validación de PIN en cliente) |

### 3.3 Suscripciones y planes

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-020 | El sistema debe ofrecer planes con precio de activación, mensualidad y límite de sucursales. | Implementado | tabla `plans` (`precio_inicial`, `precio_mensual`, `max_sucursales`, `max_administradores`); `generate-pdf/_shared/plans.ts` |
| RF-021 | El sistema debe mantener una suscripción por tenant con estados `pending`, `active`, `past_due`, `cancelled`, `expired`. | Implementado | tabla `subscriptions` CHECK (`20260619000000_saas_core.sql`) |
| RF-022 | El sistema debe exponer la información de suscripción al POS y al panel (`plan`, `estado`, `próximo cobro`, `max_sucursales`). | Implementado | RPC `get_subscription_info()` (`20260628000000_fix_subscription_info_rpc.sql`) |
| RF-023 | El sistema debe bloquear el acceso operativo (POS y panel) cuando la suscripción no está activa. | Implementado | `src/App.tsx` (POS) y `AuthGuard.tsx` (SaaS) usan `get_subscription_info` / `subscription.estado` |
| RF-024 | El sistema debe permitir registrar un pago y renovar la suscripción (flujo manual aprobado por superadmin). | Implementado | RPC `renew_subscription`/`process_renewal`; `approve_renewal` (`20260731000003_subscription_requests.sql`) |
| RF-025 | El sistema debe permitir solicitar un cambio de plan y aprobarlo. | Implementado | RPC `change_subscription_plan`, `process_plan_change`, `approve_plan_change` |
| RF-026 | El sistema debe marcar como `past_due` las suscripciones vencidas y expirarlas tras un periodo de gracia (14 días). | Implementado | `mark_subscription_past_due`, `process_expired_subscriptions` (`20260702000000_fix_renewal_handling.sql`) |
| RF-027 | El sistema debe permitir cancelar y reactivar una suscripción. | Implementado | `cancel_subscription`, `reactivate_subscription` |
| RF-028 | El sistema debe mantener un historial de eventos de suscripción. | Implementado | tabla `subscription_events` (tipos `created, activated, renewed, cancelled, expired, plan_changed, suspended, reactivated, payment_failed, past_due, pending_approval`) |

### 3.4 Sucursales y cuentas de sucursal

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-030 | El dueño debe poder crear sucursales respetando el límite del plan. | Implementado | Edge Function `create-branch`; RPC stub `create_branch` (`20260622000000_fix_searchpath.sql`) |
| RF-031 | El sistema debe crear una cuenta de acceso (usuario + registro en `usuarios`) por sucursal. | Implementado | `create-branch/index.ts` (crea usuario, PIN aleatorio, `usuarios.rol='admin'`) |
| RF-032 | El dueño/superadmin debe poder actualizar datos de una sucursal (nombre, NIT, dirección, teléfono). | Implementado | Edge Function `update-branch`; tabla `sucursales` |
| RF-033 | El sistema debe listar y contar sucursales por tenant. | Implementado | `count_branches_for_tenant`; `BranchesPage.tsx` |

### 3.5 Inventario y productos

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-040 | El sistema debe gestionar productos por sucursal (código de barras, descripción, costo, precio, stock mínimo, categoría, requiere peso). | Implementado | tabla `productos`; RPCs `create_tenant_product`, `update_tenant_product`, `delete_tenant_product` |
| RF-041 | El sistema debe gestionar categorías (con jerarquía padre). | Implementado | tabla `categorias` (`parent_id`); RPC `get_tenant_categories` |
| RF-042 | El sistema debe mantener stock por sucursal con control de versión (concurrencia optimista). | Implementado | `inventario_sucursal.stock_actual` + `version` |
| RF-043 | El sistema debe registrar movimientos de inventario (venta, ajuste, entrada/salida manual, devolución, inventario inicial). | Implementado | tabla `movimientos_inventario` CHECK de `tipo` |
| RF-044 | El sistema debe descontar stock al registrar una venta. | Implementado | RPC `decrementar_inventario` invocada por `PaymentModal.tsx` |
| RF-045 | El sistema debe restaurar stock al registrar una devolución. | Implementado | RPC `incrementar_inventario` invocada por `ReturnModal.tsx` |
| RF-046 | El sistema debe permitir ajustes manuales de stock. | Implementado | RPC `adjust_tenant_product_stock`; `StockAdjustmentModal.tsx` |
| RF-047 | El sistema debe entregar listado de productos con bajo stock respecto al mínimo. | Implementado | RPC `get_low_stock_products` |
| RF-048 | El sistema debe permitir importación/exportación masiva de inventario. | Implementado | `InventoryPage.tsx` (uso de `xlsx`) |

### 3.6 Punto de venta (POS)

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-050 | El POS debe permitir buscar/agregar productos al carrito (por código, descripción o selección). | Implementado | `POSLayout.tsx`, `useAppStore.ts` (`addToCart`) |
| RF-051 | El POS debe soportar productos por peso (cantidad decimal). | Implementado | `WeightModal.tsx`; `productos.requiere_peso`; `venta_detalles.cantidad_o_peso` |
| RF-052 | El POS debe permitir aplicar descuentos por ítem y editar precio. | Implementado | `useAppStore.ts` (`setItemDiscount`, `setItemPrice`) |
| RF-053 | El POS debe calcular subtotal y total del carrito. | Implementado | `useAppStore.ts` (`calculateTotals`; total = subtotal, sin impuestos) |
| RF-054 | El POS debe registrar la venta con método de pago `EFECTIVO`, `BILLETERA`, `QR` o `MIXTO`. | Implementado | `PaymentModal.tsx`; `ventas.metodo_pago` CHECK (`20260901000000_remove_taxes_wompi_dian.sql`) |
| RF-055 | En pago `EFECTIVO`, el POS debe calcular el cambio entregado. | Implementado | `PaymentModal.tsx` (`change = receivedAmount - cartTotal`) |
| RF-056 | En pago `MIXTO`, el POS debe validar que la suma efectivo + QR iguale el total. | Implementado | `PaymentModal.tsx` (`mixOk`) |
| RF-057 | El POS debe verificar stock antes de confirmar la venta. | Implementado | `PaymentModal.tsx` (consulta `inventario_sucursal`) |
| RF-058 | El POS debe asignar un número de ticket incremental por sucursal. | Implementado | `PaymentModal.tsx` (`nextTicketNumber` = MAX+1); RPC `next_ticket_number` |
| RF-059 | El POS debe generar un hash de integridad de la venta. | Implementado | `PaymentModal.tsx` (`computeVentaHash`, SHA-256) |
| RF-060 | El POS debe imprimir un ticket con datos de la sucursal, ítems, totales y método de pago. | Implementado | `Receipt.tsx` (`window.print()`) |
| RF-061 | El POS debe permitir vender productos libres (no catalogados). | Implementado | `FreeSaleModal.tsx` |

### 3.7 Caja: apertura y cierre

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-070 | El POS debe exigir la apertura de turno con fondo inicial antes de operar. | Implementado | `AperturaTurnoModal.tsx`; tabla `aperturas_caja` |
| RF-071 | El sistema debe calcular el efectivo esperado (fondo + ventas en efectivo). | Implementado | `CashRegisterClose.tsx` |
| RF-072 | El cierre de caja debe clasificar el resultado como CUADRADO, SOBRANTE o FALTANTE. | Implementado | `CashRegisterClose.tsx` |
| RF-073 | El cierre debe registrar un `cierres_caja` y actualizar la apertura a `cerrada`, además de un evento de auditoría. | Implementado | `CashRegisterClose.tsx`; tablas `cierres_caja`, `eventos_auditoria` |
| RF-074 | El cierre debe poder exportarse a PDF. | Implementado | `CashRegisterClose.tsx` (`exportPdf`) |

### 3.8 Devoluciones

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-080 | El POS debe permitir buscar una venta por número de ticket dentro de la sucursal. | Implementado | `ReturnModal.tsx` |
| RF-081 | El POS debe registrar la devolución (cabecera y detalle) con valores negativos. | Implementado | `ReturnModal.tsx`; tablas `devoluciones`, `devolucion_detalles` |
| RF-082 | La devolución debe restaurar el stock de los productos devueltos. | Implementado | `ReturnModal.tsx` invoca `incrementar_inventario` |

### 3.9 Facturación SaaS y reportes

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-090 | El sistema debe generar un número de factura secuencial por año (`VENX-AAAA-NNNNNN`). | Implementado | `generar_numero_factura()` + tabla `invoice_counter` (`20260821000001_fix_invoice_functions.sql`) |
| RF-091 | El sistema debe generar la factura SaaS a partir de un pago (sin impuestos; subtotal = total). | Implementado | `generar_factura_desde_pago()` (`20260901000000_remove_taxes_wompi_dian.sql`) |
| RF-092 | El sistema debe generar el PDF de la factura y almacenarlo. | Implementado | Edge Function `generate-pdf` (pdf-lib; bucket `invoices`) |
| RF-093 | El sistema debe permitir consultar y exportar facturas. | Implementado | `InvoicesPage.tsx`, `AdminBillingPage.tsx`, `export.ts` (`xlsx`) |
| RF-094 | El sistema debe ofrecer KPIs de ventas por periodo (total, transacciones, ticket promedio, ganancia). | Implementado | RPC `get_ventas_periodo`; `AnalyticsPage.tsx` |
| RF-095 | El sistema debe ofrecer métricas de facturación (MRR/ARR, mensual/anual, pagos pendientes). | Implementado | RPCs `get_mrr`, `get_arr`, `get_facturacion_mensual`, `get_facturacion_anual`, `get_pagos_pendientes` |
| RF-096 | El sistema debe permitir exportar listados a Excel. | Implementado | `src/lib/export.ts` (librería `xlsx`) |

### 3.10 Auditoría y notificaciones

| ID | Requerimiento | Estado | Evidencia |
|---|---|---|---|
| RF-100 | El sistema debe registrar eventos de auditoría (acciones administrativas y eventos de caja). | Implementado | `log_audit()`; tablas `audit_logs` y `eventos_auditoria` |
| RF-101 | El sistema debe enviar correos transaccionales (por ejemplo, notificaciones de cuenta). | Parcial | Edge Function `send-email` (Resend) existe, pero la plantilla `_shared/notify.ts` está desactualizada y no es usada por ninguna función |
| RF-102 | El sistema debe exponer enlaces de contacto por WhatsApp. | Implementado | `src/lib/appConfig.ts` (`buildWhatsAppUrl`) |

---

## 4. Requerimientos no funcionales (RNF)

| ID | Categoría | Requerimiento | Estado | Evidencia |
|---|---|---|---|---|
| RNF-001 | Arquitectura | Aplicaciones SPA React 19 + TypeScript + Vite, con backend BaaS Supabase. | Implementado | `package.json` de ambos repos |
| RNF-002 | Seguridad | Aislamiento multi-inquilino mediante Row Level Security (RLS) en todas las tablas públicas. | Implementado | `ENABLE ROW LEVEL SECURITY` en las 29 tablas; migraciones `20260801000000`, `20260802000000`, `20260730000001` |
| RNF-003 | Seguridad | Aislamiento por sucursal en operaciones POS. | Implementado | Policies basadas en `get_user_sucursal()` (`init_schema.sql`) |
| RNF-004 | Seguridad | Las llaves `service_role` no deben exponerse al frontend; el acceso privilegiado se realiza en Edge Functions. | Implementado | `_shared/supabase.ts`; `AGENTS.md` |
| RNF-005 | Seguridad | Cabeceras HTTP seguras (CSP, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). | Implementado | `vercel.json` |
| RNF-006 | Seguridad | Validación de entradas con Zod en el formulario de login. | Parcial | `src/lib/validators.ts` (solo `loginSchema`) |
| RNF-007 | Rendimiento | Carga diferida (code-splitting) de páginas pesadas del panel. | Implementado | `src/App.tsx` (`lazy`, `Suspense`) |
| RNF-008 | Rendimiento | División manual de chunks de vendor en el build. | Implementado | `vite.config.ts` (`manualChunks`) |
| RNF-009 | Disponibilidad | La aplicación opera en línea sobre el backend en la nube (arquitectura cliente-servidor). | Implementado | `src/components/ConnectionGuard.tsx` |
| RNF-010 | Usabilidad | Interfaz en español, estilo POS comercial, sin emojis, con estados visuales (badges). | Implementado | Componentes UI; `AGENTS.md` |
| RNF-011 | Compatibilidad | Codificación de moneda/formato local Colombia (COP, es-CO). | Implementado | `src/lib/utils.ts` (`formatCurrency`) |
| RNF-012 | Mantenibilidad | TypeScript estricto y `npm run build`/`npm run lint` sin errores. | Implementado | `tsconfig.json`; scripts de build/lint |
| RNF-013 | Confiabilidad | Control de concurrencia de inventario mediante versionado (optimistic locking). | Implementado | `inventario_sucursal.version`; RPCs con `FOR UPDATE` |
| RNF-014 | Observabilidad | Registro de auditoría de acciones sensibles. | Implementado | `audit_logs`, `eventos_auditoria` |
| RNF-015 | Portabilidad | Hosting en Vercel con rewrites SPA. | Implementado | `vercel.json` |

---

## 5. Reglas de negocio (RN)

| ID | Regla | Evidencia |
|---|---|---|
| RN-001 | Una venta solo puede registrarse con método de pago `EFECTIVO`, `BILLETERA`, `QR` o `MIXTO`. El valor `TARJETA` no está permitido. | `20260901000000_remove_taxes_wompi_dian.sql` (CHECK en `ventas` y `devoluciones`) |
| RN-002 | El total de una venta es igual a su subtotal; el sistema no calcula ni almacena impuestos. | `venxpos/src/store/useAppStore.ts`; `remove_taxes` |
| RN-003 | Un pago `MIXTO` se compone únicamente de efectivo + QR, y su suma debe igualar el total. | `PaymentModal.tsx` (`mixOk`) |
| RN-004 | El número de ticket es incremental por sucursal y se calcula como `MAX(ticket_number) + 1`. | `PaymentModal.tsx`; RPC `next_ticket_number` |
| RN-005 | El stock no puede quedar por debajo de lo solicitado: la venta falla si no hay existencias suficientes. | `PaymentModal.tsx` (validación previa) |
| RN-006 | Una devolución restaura el stock de los ítems devueltos y se registra con valores negativos. | `ReturnModal.tsx` |
| RN-007 | El acceso operativo requiere una suscripción en estado `active`. | `src/App.tsx`; `AuthGuard.tsx` |
| RN-008 | Las suscripciones vencidas pasan a `past_due` y, tras 14 días, a `expired`, suspendiendo el servicio. | `20260702000000_fix_renewal_handling.sql` |
| RN-009 | Los pagos de suscripción son registrados/aprobados manualmente por el superadministrador (no hay pasarela). | `approve-tenant`; `payments.payment_method_type = 'MANUAL'` |
| RN-010 | El número de sucursales está limitado por el plan contratado. | `create-branch/index.ts`; `count_branches_for_tenant` |
| RN-011 | El código de barras es único por sucursal. | `productos` UNIQUE(`sucursal_id`, `codigo_barras`) |
| RN-012 | Los movimientos de inventario deben registrarse con un tipo válido. | `movimientos_inventario.tipo` CHECK |
| RN-013 | El NIT del negocio es único a nivel de plataforma. | `tenants.nit` UNIQUE (`20260623000000_nit_unique.sql`) |

---

## 6. Matriz de actores × funcionalidades (resumen)

| Funcionalidad | Superadmin | Dueño/Gerente | Cajero |
|---|---|---|---|
| Aprobar tenants / registrar pagos | ✔ | ✖ | ✖ |
| Gestionar planes/suscripciones globales | ✔ | ✖ | ✖ |
| Consultar analítica global | ✔ | ✖ | ✖ |
| Administrar suscripción propia | ✔ | ✔ | ✖ |
| Gestionar sucursales | ✔ | ✔ | ✖ |
| Gestionar inventario consolidado | ✔ | ✔ | ✖ |
| Configurar negocio | ✔ | ✔ | ✖ |
| Abrir/cerrar caja | ✔ | ✔ | ✔ |
| Registrar ventas | ✖ | ✖ | ✔ |
| Registrar devoluciones | ✖ | ✖ | ✔ |

---

## 7. Supuestos y limitaciones declaradas

1. **Pagos manuales.** No hay integración con pasarela; el cobro de la suscripción se registra/aprueba manualmente.
2. **Sin componente fiscal.** No se emiten documentos equivalentes a factura electrónica DIAN ni se calculan impuestos.
3. **Pruebas automatizadas: brecha.** Existe `venxpos-saas/src/lib/utils.test.ts` pero no hay runner configurado; el POS no tiene pruebas.
4. Las funcionalidades marcadas como **Parcial** (RF-015, RF-101, RNF-006) se detallan con sus brechas en `09_Informe_Auditoria_y_Brechas.md`.

---

*Los identificadores RF/RNF/RN se reutilizan en `07_Matriz_Trazabilidad.md` (cadena Necesidad → Requerimiento → Regla → Proceso → Arquitectura → Datos → Código → Prueba).*
