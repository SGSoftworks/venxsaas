# 07. Matriz de Trazabilidad — VenxPOS

**Proyecto:** Sistema de Gestion Comercial y Punto de Venta — VenxPOS

Cadena de trazabilidad: Necesidad -> Requerimiento (RF/RNF/RN) -> Regla de negocio -> Proceso (BPMN/C4) -> Arquitectura -> Datos -> Codigo -> Prueba.

## 1. Matriz

| ID | Tipo | Requerimiento | Regla | Proceso | Arquitectura (C4) | Dato (tabla/RPC) | Codigo | Prueba | Estado |
|---|---|---|---|---|---|---|---|---|---|
| RF-001 | RF | Registro de negocio desde landing (nombre, NIT, correo, telefono, plan) |  | Alta y aprobacion de negocio | SPA SaaS; Edge Functions | tenants | supabase/functions/create-signup/index.ts | CP-001 | Implementado |
| RF-002 | RF | Crear cuenta de auth del propietario y tenant en pending_approval | RN-013 | Alta y aprobacion de negocio | SPA SaaS; Supabase Auth; Edge Functions | tenants | create-signup/index.ts | CP-001 | Implementado |
| RF-003 | RF | Validar correo y NIT no duplicados | RN-013 | Alta y aprobacion de negocio | PostgreSQL + RLS | tenants.nit UK; client_id | migrations/20260623000000_nit_unique.sql | CP-002 | Implementado |
| RF-004 | RF | Aprobar tenant y registrar pago inicial (manual) | RN-009 | Aprobacion de tenant | Edge Functions; PostgreSQL | RPC approve_tenant; payments | migrations/20260718000002_fix_approve_rpc.sql | CP-003 | Implementado |
| RF-005 | RF | Crear clientes/negocios directamente |  | Alta y aprobacion de negocio | Edge Functions | tenants | functions/create-client/index.ts | CP-001 | Implementado |
| RF-006 | RF | Cambiar estado del negocio (CHECK) |  | Alta y aprobacion de negocio | PostgreSQL | tenants.estado | migrations/20260714000000_pending_approval.sql | CP-003 | Implementado |
| RF-007 | RF | Generar client_id legible |  | Alta y aprobacion de negocio | PostgreSQL | RPC generate_client_id; trigger trg_client_id | migrations/20260726000000_client_id_and_invoice.sql | CP-001 | Implementado |
| RF-010 | RF | Inicio de sesion con correo y contrasena |  | Login y control de acceso | SPA SaaS; POS SPA; Supabase Auth | auth.users | src/components/auth/LoginPage.tsx | CP-004 | Implementado |
| RF-011 | RF | Restringir rutas por rol | RN-007 | Login y control de acceso | SPA SaaS (guards) | branch_accounts.rol | src/components/auth/GerenteGuard.tsx | CP-004 | Implementado |
| RF-012 | RF | Forzar cambio de contrasena temporal |  | Login y control de acceso | SPA SaaS; PostgreSQL | tenants.must_change_password | ChangePasswordPage.tsx | CP-005 | Implementado |
| RF-013 | RF | Restablecer contrasena de usuario |  | Login y control de acceso | Edge Functions | auth.users | functions/admin-reset-password/index.ts | CP-006 | Implementado |
| RF-014 | RF | POS exige sesion valida y sucursal |  | Login y control de acceso | POS SPA; PostgreSQL | usuarios.user_id | venxpos/src/components/Login.tsx | CP-004 | Implementado |
| RF-015 | RF | PIN de autorizacion para operaciones admin |  | Login y control de acceso | POS SPA | usuarios.pin_acceso | venxpos/src/components/AdminOverrideModal.tsx | CP-007 | Parcial |
| RF-020 | RF | Planes con precio inicial, mensual y limites | RN-010 | Suscripcion y cobro manual | SPA SaaS; PostgreSQL | plans | functions/generate-pdf/_shared/plans.ts | CP-009 | Implementado |
| RF-021 | RF | Suscripcion por tenant con estados | RN-008 | Suscripcion y cobro manual | PostgreSQL + RLS | subscriptions.estado | migrations/20260619000000_saas_core.sql | CP-009 | Implementado |
| RF-022 | RF | Exponer info de suscripcion al POS/panel |  | Suscripcion y cobro manual | PostgreSQL | RPC get_subscription_info | migrations/20260628000000_fix_subscription_info_rpc.sql | CP-009 | Implementado |
| RF-023 | RF | Bloquear acceso si la suscripcion no esta activa | RN-007 | Login y control de acceso | SPA SaaS; POS SPA | RPC get_subscription_info | src/App.tsx | CP-008 | Implementado |
| RF-024 | RF | Registrar pago y renovar suscripcion (manual) | RN-009 | Suscripcion y cobro manual | PostgreSQL; Edge Functions | RPC renew_subscription; process_renewal | migrations/20260731000003_subscription_requests.sql | CP-010 | Implementado |
| RF-025 | RF | Cambiar plan y aprobar solicitud |  | Suscripcion y cobro manual | PostgreSQL | RPC approve_renewal; subscription_requests | migrations/20260731000003_subscription_requests.sql | CP-010 | Implementado |
| RF-030 | RF | Crear sucursales respetando limite del plan | RN-010 | Gestion de sucursales | Edge Functions; PostgreSQL | RPC count_branches_for_tenant | functions/create-branch/index.ts | CP-011 | Implementado |
| RF-031 | RF | Crear cuenta de acceso por sucursal |  | Gestion de sucursales | Edge Functions; Supabase Auth | usuarios (rol=admin) | functions/create-branch/index.ts | CP-012 | Implementado |
| RF-032 | RF | Actualizar datos de sucursal |  | Gestion de sucursales | Edge Functions; PostgreSQL | sucursales | functions/update-branch/index.ts | CP-012 | Implementado |
| RF-033 | RF | Listar y contar sucursales por tenant |  | Gestion de sucursales | PostgreSQL | RPC count_branches_for_tenant | src/components/dashboard/BranchesPage.tsx | CP-011 | Implementado |
| RF-040 | RF | Gestionar productos por sucursal | RN-011 | Gestion de inventario | PostgreSQL; SPA SaaS | productos | migrations (RPC create_tenant_product) | CP-013 | Implementado |
| RF-041 | RF | Gestionar categorias con jerarquia |  | Gestion de inventario | PostgreSQL | categorias.parent_id | RPC get_tenant_categories | CP-013 | Implementado |
| RF-042 | RF | Stock por sucursal con control de version | RN-005 | Gestion de inventario | PostgreSQL | inventario_sucursal.version | migrations (inventario_sucursal) | CP-014 | Implementado |
| RF-043 | RF | Registrar movimientos de inventario | RN-012 | Gestion de inventario | PostgreSQL | movimientos_inventario.tipo | migrations/20260617043200_init_schema.sql | CP-015 | Implementado |
| RF-044 | RF | Descontar stock al registrar venta | RN-005 | Venta en POS | PostgreSQL; POS SPA | RPC decrementar_inventario | venxpos/src/components/PaymentModal.tsx | CP-016 | Implementado |
| RF-050 | RF | Carrito por codigo/descripcion/seleccion |  | Venta en POS | POS SPA; Zustand | useAppStore.addToCart | venxpos/src/store/useAppStore.ts | CP-016 | Implementado |
| RF-051 | RF | Productos por peso (cantidad decimal) |  | Venta en POS | POS SPA | productos.requiere_peso | venxpos/src/components/WeightModal.tsx | CP-016 | Implementado |
| RF-052 | RF | Descuentos por item y edicion de precio |  | Venta en POS | POS SPA (Zustand) | useAppStore.setItemDiscount | venxpos/src/store/useAppStore.ts | CP-016 | Implementado |
| RF-053 | RF | Calcular subtotal y total (sin impuestos) | RN-002 | Venta en POS | POS SPA (Zustand) | useAppStore.calculateTotals | venxpos/src/store/useAppStore.ts | CP-016 | Implementado |
| RF-054 | RF | Metodo de pago EFECTIVO/BILLETERA/QR/MIXTO | RN-001 | Venta en POS | POS SPA; PostgreSQL | ventas.metodo_pago CHECK | venxpos/src/components/PaymentModal.tsx | CP-016 | Implementado |
| RF-055 | RF | Calcular cambio en pago EFECTIVO |  | Venta en POS | POS SPA | ventas.cambio_entregado | venxpos/src/components/PaymentModal.tsx | CP-016 | Implementado |
| RF-056 | RF | Validar MIXTO = efectivo + QR | RN-003 | Venta en POS | POS SPA | ventas (monto_recibido, qr) | venxpos/src/components/PaymentModal.tsx | CP-018 | Implementado |
| RF-057 | RF | Verificar stock antes de confirmar | RN-005 | Venta en POS | POS SPA; PostgreSQL | inventario_sucursal | venxpos/src/components/PaymentModal.tsx | CP-019 | Implementado |
| RF-058 | RF | Numero de ticket incremental por sucursal | RN-004 | Venta en POS | POS SPA; PostgreSQL | RPC next_ticket_number | venxpos/src/components/PaymentModal.tsx | CP-020 | Implementado |
| RF-059 | RF | Hash de integridad de la venta |  | Venta en POS | POS SPA (Web Crypto) | ventas.hash (SHA-256) | venxpos/src/components/PaymentModal.tsx | CP-020 | Implementado |
| RF-060 | RF | Imprimir ticket |  | Venta en POS | POS SPA | ventas/venta_detalles | venxpos/src/components/Receipt.tsx | CP-021 | Implementado |
| RF-061 | RF | Vender productos libres (no catalogados) |  | Venta en POS | POS SPA | venta_detalles | venxpos/src/components/FreeSaleModal.tsx | CP-016 | Implementado |
| RF-070 | RF | Exigir apertura de turno con fondo inicial |  | Apertura/cierre de caja | POS SPA; PostgreSQL | aperturas_caja | venxpos/src/components/AperturaTurnoModal.tsx | CP-022 | Implementado |
| RF-071 | RF | Calcular efectivo esperado |  | Apertura/cierre de caja | POS SPA | aperturas_caja.fondo_inicial | venxpos/src/components/CashRegisterClose.tsx | CP-023 | Implementado |
| RF-072 | RF | Clasificar cierre: CUADRADO/SOBRANTE/FALTANTE |  | Cierre de caja | POS SPA | cierres_caja.diferencia | venxpos/src/components/CashRegisterClose.tsx | CP-023 | Implementado |
| RF-073 | RF | Registrar cierre y evento de auditoria | RN-006 | Cierre de caja | POS SPA; PostgreSQL | cierres_caja; eventos_auditoria | venxpos/src/components/CashRegisterClose.tsx | CP-023 | Implementado |
| RF-074 | RF | Exportar cierre a PDF |  | Cierre de caja | POS SPA | - | venxpos/src/components/CashRegisterClose.tsx | CP-023 | Implementado |
| RF-080 | RF | Buscar venta por ticket en la sucursal |  | Devolucion | POS SPA; PostgreSQL | ventas.ticket_number | venxpos/src/components/ReturnModal.tsx | CP-024 | Implementado |
| RF-081 | RF | Registrar devolucion (cabecera/detalle) negativa | RN-006 | Devolucion | POS SPA; PostgreSQL | devoluciones; devolucion_detalles | venxpos/src/components/ReturnModal.tsx | CP-024 | Implementado |
| RF-082 | RF | Restaurar stock de productos devueltos | RN-006 | Devolucion | PostgreSQL | RPC incrementar_inventario | venxpos/src/components/ReturnModal.tsx | CP-024 | Implementado |
| RF-090 | RF | Numero de factura secuencial por ano |  | Facturacion SaaS | PostgreSQL | RPC generar_numero_factura; invoice_counter | migrations/20260821000001_fix_invoice_functions.sql | CP-025 | Implementado |
| RF-091 | RF | Generar factura SaaS desde pago (sin impuestos) | RN-002 | Facturacion SaaS | PostgreSQL | RPC generar_factura_desde_pago | migrations/20260901000000_remove_taxes_wompi_dian.sql | CP-025 | Implementado |
| RF-092 | RF | Generar y almacenar PDF de factura |  | Facturacion SaaS | Edge Functions; Storage | bucket invoices | functions/generate-pdf/index.ts | CP-026 | Implementado |
| RF-093 | RF | Consultar y exportar facturas |  | Facturacion SaaS | SPA SaaS | facturas_saas | src/components/dashboard/InvoicesPage.tsx | CP-027 | Implementado |
| RF-094 | RF | KPIs de ventas por periodo |  | Reportes | PostgreSQL | RPC get_ventas_periodo | src/components/dashboard/AnalyticsPage.tsx | CP-027 | Implementado |
| RF-095 | RF | Metricas de facturacion (MRR/ARR) |  | Reportes | PostgreSQL | RPC get_mrr; get_arr | migrations (get_mrr) | CP-027 | Implementado |
| RF-096 | RF | Exportar listados a Excel |  | Reportes | SPA SaaS | xlsx | src/lib/export.ts | CP-027 | Implementado |
| RF-100 | RF | Registrar eventos de auditoria |  | Auditoria y notificaciones | PostgreSQL | audit_logs; eventos_auditoria | RPC log_audit | CP-028 | Implementado |
| RF-101 | RF | Enviar correos transaccionales |  | Auditoria y notificaciones | Edge Functions; Resend | _shared/notify.ts (desactualizado) | functions/send-email/index.ts | CP-030 | Parcial |
| RF-102 | RF | Enlaces de contacto por WhatsApp |  | Auditoria y notificaciones | SPA SaaS | appConfig.buildWhatsAppUrl | src/lib/appConfig.ts | CP-027 | Implementado |
| RN-001 | RN | Solo metodos EFECTIVO/BILLETERA/QR/MIXTO | RN-001 | Venta en POS | PostgreSQL | ventas.metodo_pago CHECK | migrations/20260901000000_remove_taxes_wompi_dian.sql | CP-016 | Implementado |
| RN-002 | RN | Total = subtotal (sin impuestos) | RN-002 | Venta en POS | POS SPA | useAppStore.calculateTotals | venxpos/src/store/useAppStore.ts | CP-016 | Implementado |
| RN-003 | RN | MIXTO = efectivo + QR | RN-003 | Venta en POS | POS SPA | PaymentModal mixOk | venxpos/src/components/PaymentModal.tsx | CP-018 | Implementado |
| RN-004 | RN | Ticket incremental por sucursal (MAX+1) | RN-004 | Venta en POS | POS SPA; PostgreSQL | RPC next_ticket_number | venxpos/src/components/PaymentModal.tsx | CP-020 | Implementado |
| RN-005 | RN | No vender sin stock suficiente | RN-005 | Venta en POS | POS SPA; PostgreSQL | inventario_sucursal | venxpos/src/components/PaymentModal.tsx | CP-019 | Implementado |
| RN-006 | RN | Devolucion restaura stock (valores negativos) | RN-006 | Devolucion | POS SPA; PostgreSQL | devoluciones | venxpos/src/components/ReturnModal.tsx | CP-024 | Implementado |
| RN-007 | RN | Acceso operativo requiere suscripcion active | RN-007 | Login y control de acceso | SPA SaaS; POS SPA | RPC get_subscription_info | src/App.tsx | CP-008 | Implementado |
| RN-008 | RN | Vencidas -> past_due y a los 14 dias expired | RN-008 | Suscripcion y cobro manual | PostgreSQL | subscriptions.estado | migrations/20260702000000_fix_renewal_handling.sql | CP-009 | Implementado |
| RN-009 | RN | Pagos de suscripcion registrados manualmente | RN-009 | Aprobacion de tenant | Edge Functions; PostgreSQL | payments.payment_method_type=MANUAL | functions/approve-tenant/index.ts | CP-003 | Implementado |
| RN-010 | RN | Sucursales limitadas por el plan | RN-010 | Gestion de sucursales | Edge Functions; PostgreSQL | plans.max_sucursales | functions/create-branch/index.ts | CP-011 | Implementado |
| RN-011 | RN | Codigo de barras unico por sucursal | RN-011 | Gestion de inventario | PostgreSQL | productos UNIQUE(sucursal_id,codigo_barras) | migrations (productos) | CP-013 | Implementado |
| RN-012 | RN | Movimiento de inventario con tipo valido | RN-012 | Gestion de inventario | PostgreSQL | movimientos_inventario.tipo CHECK | migrations (movimientos_inventario) | CP-015 | Implementado |
| RN-013 | RN | NIT unico a nivel de plataforma | RN-013 | Alta y aprobacion de negocio | PostgreSQL | tenants.nit UNIQUE | migrations/20260623000000_nit_unique.sql | CP-002 | Implementado |
| RNF-001 | RNF | SPA React 19 + TS + Vite; backend Supabase |  | Transversal | SPA SaaS; POS SPA; Supabase | package.json | package.json (ambos repos) | CP-004 | Implementado |
| RNF-002 | RNF | RLS multi-inquilino en todas las tablas |  | Transversal | PostgreSQL + RLS | politicas RLS (29 tablas) | migrations (RLS) | CP-029 | Implementado |
| RNF-003 | RNF | RLS por sucursal en POS |  | Transversal | PostgreSQL + RLS | politicas por sucursal_id | migrations (RLS POS) | CP-029 | Implementado |
| RNF-006 | RNF | Validacion Zod en inputs (parcial) |  | Transversal | SPA SaaS | utils.test.ts (sin runner) | src/lib/utils.test.ts | CP-030 | Parcial |
| RNF-009 | RNF | Opera en linea sobre el backend en la nube |  | Transversal | POS SPA | ConnectionGuard | venxpos/src/components/ConnectionGuard.tsx | CP-004 | Implementado |
| RNF-013 | RNF | Concurrencia de inventario (optimistic locking) |  | Gestion de inventario | PostgreSQL | inventario_sucursal.version | migrations (RPC inventario) | CP-014 | Implementado |
| RNF-014 | RNF | Auditoria de acciones sensibles |  | Transversal | PostgreSQL | audit_logs; eventos_auditoria | RPC log_audit | CP-028 | Implementado |

## 2. Resumen por estado

| Estado | Cantidad |
|---|---|
| Implementado | 75 |
| Parcial | 3 |
| **Total** | **78** |

> Los casos `CP-xxx` se describen en `08_Plan_y_Casos_de_Prueba.md`.