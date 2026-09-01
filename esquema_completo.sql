-- =============================================================================
-- =============================================================================
--
--  VenxPOS SaaS — ESQUEMA COMPLETO DE LA BASE DE DATOS
--  Estructura del documento (FASES de construcción):
--    FASE 1  — Extensiones de PostgreSQL
--    FASE 2  — Esquema POS (el negocio del comercio)
--    FASE 3  — Esquema SaaS (multitenancy y suscripciones)
--    FASE 4  — Funciones (RPCs) de negocio
--    FASE 5  — Triggers de auditoría de updated_at
--    FASE 6  — Row Level Security (políticas finales)
--    FASE 7  — Índices de performance
--    FASE 8  — Grants (permisos de ejecución)
--    FASE 9  — Seed data (planes de suscripción)
-- =============================================================================
-- =============================================================================
-- FASE 1 — EXTENSIONES
-- =============================================================================
-- =============================================================================
--
-- Las primeras piezas habilitan herramientas de PostgreSQL necesarias para el
-- resto del esquema:
--   * uuid-ossp  → generación de UUIDs (aunque hoy usamos gen_random_uuid()).
--   * pgcrypto   → criptografía: gen_random_uuid() y funciones de hash.
--
-- Ambas se declaran como idempotentes (IF NOT EXISTS) para que la
-- reconstrucción sea segura incluso si ya existieran en otro schema.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- =============================================================================
-- FASE 2 — ESQUEMA POS (el negocio del comercio)
-- =============================================================================
-- =============================================================================
--
-- En esta fase se modela el corazón funcional del POS: el comercio de
-- proximidad. Todas las entidades "del negocio" (sucursales, productos,
-- inventario, ventas, cajas, devoluciones, auditoría) viven aquí.
--
-- La historia comienza como un sistema POS monotenant y evoluciona hacia un
-- esquema multi-tenant. Por eso las tablas POS se ven "aterrizadas" por
-- sucursal (sucursal_id) más que por tenant: la relación con el tenant se
-- resuelve a través de branch_accounts (ver FASE 3).
--
-- Nota sobre tablas preexistentes:
--   Las tablas `empresas`, `sucursales` y `usuarios` provienen de una base
--   heredada al migrar a Supabase. `sucursales.empresa_id` se añade después
--   para vincular cada sucursal a su empresa (ver FASE 3). Se respeta su
--   forma final.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FASE 2.1 — Sucursales (tiendas físicas del negocio)
-- -----------------------------------------------------------------------------
-- Cada sucursal es un establecimiento físico independiente con su propio
-- NIT, dirección y, en su forma final, un vínculo opcional a una empresa
-- (empresa_id).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sucursales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    nit             TEXT NOT NULL,
    direccion       TEXT,
    telefono        TEXT,
    empresa_id      UUID,                    -- FK a empresas (añadida después,
                                             -- en la fase multitenancy)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.2 — Usuarios internos del POS (cajeros y administradores)
-- -----------------------------------------------------------------------------
-- Cada usuario POS se vincula a una cuenta de Supabase Auth (auth.users)
-- mediante user_id. La relación es 1 a 1 y se elimina en CASCADA cuando se
-- borra la cuenta de auth: si el usuario de auth desaparece, debe caer su
-- registro POS (no puede quedar un cajero huérfano).
-- El rol puede ser 'cajero' u 'admin' (admin = quien gestiona el negocio
-- desde el POS). Cada usuario pertenece a una única sucursal.
-- =============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    rol             TEXT NOT NULL CHECK (rol IN ('cajero', 'admin')),
    nombre          TEXT NOT NULL,
    pin_acceso      TEXT NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.3 — Categorías de productos
-- -----------------------------------------------------------------------------
-- Organización jerárquica de productos por sucursal. parent_id permite
-- subcategorías (autoreferencia). Si se borra la categoría padre, los hijos
-- quedan con parent_id NULL (ON DELETE SET NULL).
-- =============================================================================

CREATE TABLE IF NOT EXISTS categorias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    parent_id       UUID REFERENCES categorias(id) ON DELETE SET NULL,
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.4 — Productos
-- -----------------------------------------------------------------------------
-- Catálogo de artículos por sucursal. Se valida que el precio de venta y el
-- costo no sean negativos.
-- La unicidad del código de barras es POR SUCURSAL: UNIQUE(sucursal_id,
-- codigo_barras), de modo que una sucursal no pueda duplicar un mismo código.
-- Columnas añadidas después: es_favorito y stock_minimo (para el gestor de
-- inventario y las alertas de stock bajo).
-- =============================================================================

CREATE TABLE IF NOT EXISTS productos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id         UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    codigo_barras       TEXT NOT NULL,
    descripcion         TEXT NOT NULL,
    precio_venta        DECIMAL(12,2) NOT NULL CHECK (precio_venta >= 0),
    costo               DECIMAL(12,2) NOT NULL CHECK (costo >= 0),
    requiere_peso       BOOLEAN NOT NULL DEFAULT false,   -- venta por peso
    activo              BOOLEAN NOT NULL DEFAULT true,
    categoria_id        UUID REFERENCES categorias(id) ON DELETE SET NULL,
    es_favorito         BOOLEAN NOT NULL DEFAULT false,   -- añadido después
    stock_minimo        DECIMAL(12,3) NOT NULL DEFAULT 10, -- añadido después
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, codigo_barras)
);


-- -----------------------------------------------------------------------------
-- FASE 2.5 — Inventario por sucursal
-- -----------------------------------------------------------------------------
-- Tabla de stock por (sucursal, producto). Pensada para control de
-- concurrencia multi-cajero: la columna `version` permite bloqueo optimista
-- (optimistic locking). Cada RPC que modifica stock verifica la versión leída
-- para evitar que dos cajeros descuenten sobre el mismo valor al mismo tiempo.
-- stock_actual no puede ser negativo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS inventario_sucursal (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    stock_actual    DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    version         INTEGER NOT NULL DEFAULT 1,
    last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, producto_id)
);


-- -----------------------------------------------------------------------------
-- FASE 2.6 — Aperturas de caja (turno del cajero)
-- -----------------------------------------------------------------------------
-- Registra el inicio de turno de un cajero en una sucursal con su fondo
-- inicial. El cierre de turno se completa con fecha_cierre y estado 'cerrada'.
-- =============================================================================

CREATE TABLE IF NOT EXISTS aperturas_caja (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    usuario_id        UUID NOT NULL REFERENCES usuarios(id),
    fondo_inicial     DECIMAL(12,2) NOT NULL CHECK (fondo_inicial >= 0),
    efectivo_esperado DECIMAL(12,2),
    fecha_apertura    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre      TIMESTAMPTZ,
    estado            TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.7 — Ventas (cabecera)
-- -----------------------------------------------------------------------------
-- Encabezado de cada venta. Incluye validaciones de tipo de pago
-- (EFECTIVO/BILLETERA/QR/MIXTO disponibles en el POS) y de montos.
-- El ticket_number es secuencial POR SUCURSAL: UNIQUE(sucursal_id,
-- ticket_number), y lo genera el RPC next_ticket_number (evita tickets
-- duplicados entre cajeros de la misma sucursal). `hash` es la huella
-- criptográfica del ticket para verificar su integridad.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ventas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id         UUID NOT NULL REFERENCES usuarios(id),
    subtotal          DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    total             DECIMAL(12,2) NOT NULL CHECK (total >= 0),
    metodo_pago       TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'BILLETERA', 'QR', 'MIXTO')),
    monto_recibido    DECIMAL(12,2) NOT NULL CHECK (monto_recibido >= 0),
    cambio_entregado  DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (cambio_entregado >= 0),
    hash              TEXT,
    ticket_number     BIGINT,
    conflicto_stock   BOOLEAN NOT NULL DEFAULT false,
    fecha_hora        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sucursal_id, ticket_number)
);


-- -----------------------------------------------------------------------------
-- FASE 2.8 — Detalles de venta (líneas)
-- -----------------------------------------------------------------------------
-- Líneas de un ticket: producto, cantidad (o peso) y precios en el momento de
-- la venta. La cabecera se elimina en cascada junto con sus líneas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venta_detalles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id                    UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id                 UUID NOT NULL REFERENCES productos(id),
    cantidad_o_peso             DECIMAL(12,3) NOT NULL CHECK (cantidad_o_peso > 0),
    precio_unitario             DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal                    DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
    descuento                   DECIMAL(12,2) NOT NULL DEFAULT 0,
    costo_aplicado              DECIMAL(12,2),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.9 — Cierres de caja
-- -----------------------------------------------------------------------------
-- Cuadre de turno: compara lo que el sistema calculó (total_sistema) contra
-- lo que el cajero entregó físicamente (total_fisico), dejando la diferencia
-- para el arqueo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS cierres_caja (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id       UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id         UUID NOT NULL REFERENCES usuarios(id),
    apertura_caja_id  UUID REFERENCES aperturas_caja(id) ON DELETE SET NULL,
    fecha_apertura    TIMESTAMPTZ NOT NULL,
    fecha_cierre      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_sistema     DECIMAL(12,2) NOT NULL CHECK (total_sistema >= 0),
    total_fisico      DECIMAL(12,2) NOT NULL CHECK (total_fisico >= 0),
    diferencia        DECIMAL(12,2) NOT NULL,
    observaciones     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.10 — Conflictos de venta (concurrencia / stock)
-- -----------------------------------------------------------------------------
-- Tabla auxiliar para ventas que no pudieron completarse por un problema de
-- concurrencia (dos cajeros) o de stock insuficiente. Permite que un admin
-- resuelva el conflicto posteriormente (resuelto_por / resuelto_en).
-- =============================================================================

CREATE TABLE IF NOT EXISTS ventas_conflicto (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id            UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    tipo                TEXT NOT NULL CHECK (tipo IN ('stock_insuficiente', 'colision_concurrente')),
    producto_id         UUID NOT NULL REFERENCES productos(id),
    cantidad_solicitada DECIMAL(12,3) NOT NULL,
    stock_disponible    DECIMAL(12,3) NOT NULL,
    version_conflicto   INTEGER,
    detalle             TEXT,
    resuelto            BOOLEAN NOT NULL DEFAULT false,
    resuelto_por        UUID REFERENCES usuarios(id),
    resuelto_en         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.11 — Eventos de auditoría
-- -----------------------------------------------------------------------------
-- Bitácora de acciones sensibles del POS (apertura de cajón, inicio/cierre de
-- sesión, override de admin, reimpresión de ticket, cierre Z, ajuste de
-- inventario, apertura de caja, etc.). Su CHECK se AMPLÍA después para incluir
-- más tipos que usa el frontend (inicio_sesion_fallido, cierre_caja).
-- =============================================================================

CREATE TABLE IF NOT EXISTS eventos_auditoria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id     UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    tipo            TEXT NOT NULL CHECK (tipo IN (
                        'apertura_cajon', 'inicio_sesion', 'inicio_sesion_fallido',
                        'cierre_sesion', 'admin_override', 'reimpresion_ticket',
                        'cierre_z', 'cierre_caja', 'conflicto_resuelto',
                        'ajuste_inventario', 'apertura_caja'
                    )),
    descripcion     TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.12 — Movimientos de inventario
-- -----------------------------------------------------------------------------
-- Historial inmutable de todos los cambios de stock (venta, ajuste, entrada/
-- salida manual, devolución, inventario inicial). Cada venta/ajuste escribe
-- aquí su movimiento, lo que da trazabilidad completa.
-- =============================================================================

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id      UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id      UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    tipo             TEXT NOT NULL CHECK (tipo IN ('venta','ajuste','entrada_manual','salida_manual','devolucion','inventario_inicial')),
    cantidad         DECIMAL(12,3) NOT NULL,
    stock_resultante DECIMAL(12,3) NOT NULL,
    costo_unitario   DECIMAL(12,2),
    referencia_id    TEXT,
    referencia_tipo  TEXT,
    usuario_id       UUID NOT NULL REFERENCES usuarios(id),
    observacion      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 2.13 — Devoluciones / Notas crédito
-- -----------------------------------------------------------------------------
-- Añadido para las devoluciones: el sistema POS puede revertir una venta
-- generando una nota crédito. Los totales de una devolución SON NEGATIVOS
-- (CHECK subtotal <= 0, etc.) porque representan lo que se devuelve al
-- cliente. venta_original_id apunta a la venta que se está revirtiendo.
-- =============================================================================

CREATE TABLE IF NOT EXISTS devoluciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id         UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    cajero_id           UUID NOT NULL REFERENCES usuarios(id),
    venta_original_id   UUID NOT NULL REFERENCES ventas(id),
    ticket_original     BIGINT,
    subtotal            DECIMAL(12,2) NOT NULL CHECK (subtotal <= 0),
    total               DECIMAL(12,2) NOT NULL CHECK (total <= 0),
    metodo_pago         TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'BILLETERA', 'QR', 'MIXTO')),
    fecha_hora          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo              TEXT,
    hash                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devolucion_detalles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    devolucion_id               UUID NOT NULL REFERENCES devoluciones(id) ON DELETE CASCADE,
    producto_id                 UUID NOT NULL REFERENCES productos(id),
    cantidad                    DECIMAL(12,3) NOT NULL CHECK (cantidad < 0),
    precio_unitario             DECIMAL(12,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal                    DECIMAL(12,2) NOT NULL CHECK (subtotal <= 0),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================================
-- =============================================================================
-- FASE 3 — ESQUEMA SAAS (multitenancy y suscripciones)
-- =============================================================================
-- =============================================================================
--
-- Sobre el POS se monta la capa SaaS que convierte VenxPOS en un producto
-- multi-tenant con cobro por suscripción. Aquí aparecen los conceptos de
-- multitenancy:
--
--   * plans      → planes de suscripción (Básico/Estándar/Pro).
--   * tenants    → cada negocio cliente (una cuenta de empresa).
--   * empresas   → entidad heredada del POS que ahora se vincula al tenant.
--   * subscriptions → suscripción vigente de cada tenant.
--   * subscription_events → historial del ciclo de vida de la suscripción.
--   * payments   → pagos registrados (iniciales, recurrentes, manuales...).
--   * branch_accounts → puente entre sucursales del POS y el tenant (gran
--                       clave del multitenancy).
--   * superadmins → administradores globales de la plataforma.
--   * invoice_counter / facturas_saas → facturación del SaaS.
--   * subscription_requests → solicitudes de renovación / cambio de plan.
--   * payment_proofs → comprobantes de pago (pagos manuales).
--   * pending_signups / client_counter / audit_logs → soporte operativo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- FASE 3.1 — Plans (planes de suscripción)
-- -----------------------------------------------------------------------------
-- Catálogo de planes. El nombre es UNIQUE. Los límites (máx sucursales y
-- administradores) restringen el uso del tenant conforme a su plan.
-- =============================================================================

CREATE TABLE IF NOT EXISTS plans (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre             TEXT NOT NULL UNIQUE,
    max_sucursales     INTEGER NOT NULL,
    max_administradores INTEGER NOT NULL,
    precio_inicial     DECIMAL(12,2) NOT NULL,
    precio_mensual     DECIMAL(12,2) NOT NULL,
    features           JSONB DEFAULT '[]'::jsonb,
    activo             BOOLEAN DEFAULT true,
    destacado          BOOLEAN DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.2 — Tenants (negocios clientes)
-- -----------------------------------------------------------------------------
-- Cada tenant representa un negocio suscrito. Estados típicos del flujo:
--   pending_payment → active → suspended → cancelled
-- + la variante pending_approval (pago manual pendiente de revisión).
--   - email_propietario es UNIQUE (un solo dueño por negocio).
--   - nit es UNIQUE (validación de unicidad fiscal).
--   - auth_user_id referencia auth.users con ON DELETE SET NULL: si se borra
--     la cuenta de auth, el tenant permanece (solo pierde a su dueño).
--   - client_id (añadido después): identificador numérico secuencial de 10
--     dígitos generado automáticamente por el trigger generate_client_id().
--   - temp_password / must_change_password (añadidos después): gestión de
--     contraseñas temporales en la activación.
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_negocio      TEXT NOT NULL,
    nit                 TEXT NOT NULL UNIQUE,              -- unicidad fiscal
    email_propietario   TEXT NOT NULL UNIQUE,
    telefono            TEXT NOT NULL,
    estado              TEXT NOT NULL DEFAULT 'pending_payment'
                        CHECK (estado IN ('pending_payment','pending_approval','active','suspended','cancelled')),
    auth_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    plan_id             UUID REFERENCES plans(id) ON DELETE SET NULL,
    client_id           TEXT UNIQUE,                       -- añadido después
    temp_password       TEXT,                              -- añadido después
    must_change_password BOOLEAN DEFAULT false,            -- añadido después
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.3 — Subscriptions (suscripción vigente por tenant)
-- -----------------------------------------------------------------------------
-- Vincula un tenant con un plan y su ciclo de facturación. Estados:
-- pending → active → past_due → cancelled → expired.
-- La relación con el tenant es ON DELETE CASCADE (si se borra el tenant, caen
-- sus suscripciones).
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id           UUID NOT NULL REFERENCES plans(id),
    estado            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (estado IN ('pending','active','past_due','cancelled','expired')),
    fecha_inicio      DATE,
    fecha_renovacion  DATE,
    proximo_cobro     DATE,
    payment_source_id TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.4 — Subscription_events (historial de ciclo de vida)
-- -----------------------------------------------------------------------------
-- Audit log del ciclo de vida de cada suscripción (activación, renovación,
-- cambio de plan, cancelación, suspensión, fallo de pago, etc.).
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN (
                        'created','activated','renewed','cancelled','expired',
                        'plan_changed','suspended','reactivated','payment_failed',
                        'past_due','pending_approval'
                    )),
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.5 — Payments (pagos de la suscripción)
-- -----------------------------------------------------------------------------
-- Registro de pagos (manuales y de suscripción). Se ELIMINARON las columnas
-- de pasarela de pago (wompi_* / gateway_*): el administrador registra el
-- pago y activa al tenant. Estados de pago: pending → approved → declined →
-- voided → error. `tipo` distingue el origen: initial / recurring / manual /
-- retry / plan_change.
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id       UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount                DECIMAL(12,2) NOT NULL,
    currency              TEXT DEFAULT 'COP',
    status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','declined','voided','error')),
    payment_method_type   TEXT,
    tipo                  TEXT NOT NULL DEFAULT 'initial'
                          CHECK (tipo IN ('initial','recurring','manual','retry','plan_change')),
    metadata              JSONB DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.6 — Branch_accounts (puente POS ↔ SaaS)
-- -----------------------------------------------------------------------------
-- Pieza clave del multitenancy: mapea a cada sucursal del POS con su tenant y
-- con el usuario de auth que la gestiona. Gracias a esta tabla el POS "sabe"
-- a qué tenant pertenece cada sucursal, y los dueños de tenant pueden leer
-- datos de sus sucursales.
--   - sucursal_id ON DELETE SET NULL (la cuenta sobrevive sin sucursal).
--   - user_id ON DELETE CASCADE (si muere el user de auth, muere el vínculo).
--   - La columna `rol` (añadida después) distingue admin_negocio / cajero.
-- =============================================================================

CREATE TABLE IF NOT EXISTS branch_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sucursal_id     UUID REFERENCES sucursales(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_sucursal TEXT NOT NULL,
    email           TEXT NOT NULL,
    activo          BOOLEAN DEFAULT true,
    rol             TEXT NOT NULL DEFAULT 'cajero'
                    CHECK (rol IN ('admin_negocio', 'cajero')),  -- añadido después
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.7 — Superadmins (administradores globales de la plataforma)
-- -----------------------------------------------------------------------------
-- Administradores de la operación SaaS (gerencia). user_id referencia
-- auth.users con ON DELETE CASCADE y es UNIQUE (un superadmin por cuenta).
-- =============================================================================

CREATE TABLE IF NOT EXISTS superadmins (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    nombre     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.8 — Empresas (entidad heredada del POS, ahora vinculada a tenant)
-- -----------------------------------------------------------------------------
-- Tabla PREEISISTENTE proveniente del sistema POS heredado. En la fase SaaS
-- solo se le añade la columna tenant_id (nullable, ON DELETE SET NULL) y un
-- índice. Su DDL original no está en las migraciones; la forma que se muestra
-- aquí es la reconstrucción coherente según su uso (activate_tenant y
-- process_webhook_approval insertan nombre / plan / estado / tenant_id, y
-- existe la constraint uq_empresas_tenant para evitar empresas duplicadas).
-- =============================================================================

CREATE TABLE IF NOT EXISTS empresas (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre     TEXT NOT NULL,
    nit        TEXT,
    email      TEXT,
    telefono   TEXT,
    plan       TEXT,
    estado     TEXT,
    tenant_id  UUID REFERENCES tenants(id) ON DELETE SET NULL,  -- añadido en SaaS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_empresas_tenant UNIQUE (tenant_id)
);


-- -----------------------------------------------------------------------------
-- FASE 3.9 — Invoice_counter (numeración secuencial de facturas) y
--            Facturas_saas (facturación del SaaS)
-- -----------------------------------------------------------------------------
-- invoice_counter lleva la secuencia atómica por año (anio → ultimo_numero).
-- facturas_saas es la factura del SaaS generada a partir de un pago
-- (generar_factura_desde_pago). numero_factura es UNIQUE y el formato es
-- 'VENX-YYYY-NNNNNN'. Incluye la columna estado (emitida/pagada/anulada/
-- reembolsada) y la constraint que impide facturas duplicadas por pago
-- (UNIQUE payment_id).
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_counter (
    anio          integer NOT NULL PRIMARY KEY,
    ultimo_numero integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS facturas_saas (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_id            uuid REFERENCES payments(id) ON DELETE SET NULL,
    numero_factura        text NOT NULL UNIQUE,
    concepto              text NOT NULL,
    subtotal              numeric(12,2) NOT NULL,
    total                 numeric(12,2) NOT NULL,
    moneda                text DEFAULT 'COP',
    pdf_url               text,
    estado                text NOT NULL DEFAULT 'emitida'
                          CHECK (estado IN ('emitida','pagada','anulada','reembolsada')),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_facturas_payment_id UNIQUE (payment_id)
);


-- -----------------------------------------------------------------------------
-- FASE 3.10 — Client_counter y trigger de client_id
-- -----------------------------------------------------------------------------
-- client_counter sirve de secuencia para generar client_id. El trigger
-- generate_client_id() asigna automáticamente (si viene NULL) un number de
-- 10 dígitos con padding. (En una iteración posterior se cambió a un valor
-- aleatorio.) Se lista aquí como parte del esquema final.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_counter (
    id SERIAL PRIMARY KEY
);


-- -----------------------------------------------------------------------------
-- FASE 3.11 — Subscription_requests (solicitudes de renovación / cambio plan)
-- -----------------------------------------------------------------------------
-- Cuando el pago es manual, el tenant genera una solicitud (RENOVACION o
-- CAMBIO_PLAN) que el superadmin aprueba/rechaza.
-- =============================================================================

CREATE TABLE IF NOT EXISTS subscription_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    tipo           TEXT NOT NULL CHECK (tipo IN ('RENOVACION', 'CAMBIO_PLAN')),
    estado         TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    plan_actual_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    plan_nuevo_id  UUID REFERENCES plans(id) ON DELETE SET NULL,
    solicitud_data JSONB DEFAULT '{}'::jsonb,
    aprobado_por   UUID REFERENCES superadmins(user_id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.12 — Payment_proofs (comprobantes de pago manual)
-- -----------------------------------------------------------------------------
-- Comprobantes que sube el tenant al pagar manualmente; el superadmin los
-- aprueba o rechaza.
-- =============================================================================

CREATE TABLE IF NOT EXISTS payment_proofs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id         UUID REFERENCES plans(id) ON DELETE SET NULL,
    amount          DECIMAL(12,2),
    payment_date    DATE,
    proof_url       TEXT,
    notes           TEXT,
    status          TEXT NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','approved','rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ
);


-- -----------------------------------------------------------------------------
-- FASE 3.13 — Pending_signups (registros en espera de pago)
-- -----------------------------------------------------------------------------
-- Almacenamiento temporal del registro antes de completar el pago. Almacena
-- el hash de la contraseña. Sus columnas wompi_payment_link_id y
-- payment_reference fueron REMOVIDAS después (no se usan). Solo el superadmin
-- puede leerlo (ver RLS).
-- =============================================================================

CREATE TABLE IF NOT EXISTS pending_signups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference       TEXT UNIQUE NOT NULL,
    email           TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    nombre_negocio  TEXT NOT NULL,
    nit             TEXT,
    telefono        TEXT NOT NULL,
    plan_id         UUID REFERENCES plans(id) ON DELETE SET NULL,
    estado          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (estado IN ('draft','pending_payment','approved','expired','cancelled')),
    amount_in_cents INTEGER,
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- FASE 3.14 — Audit_logs (auditoría del SaaS)
-- -----------------------------------------------------------------------------
-- Bitácora de acciones de la plataforma SaaS (creación de tenant, aprobación
-- de pagos, activación de suscripción, etc.).
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  uuid REFERENCES tenants(id) ON DELETE SET NULL,
    user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    accion     text NOT NULL,
    entidad    text NOT NULL,
    entidad_id text,
    metadata   jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- =============================================================================
-- FASE 4 — FUNCIONES (RPCs)
-- =============================================================================
-- =============================================================================
--
-- Las funciones son la lógica de negocio ejecutada por el frontend a través
-- del cliente Supabase (RPCs). La mayoría son SECURITY DEFINER: se ejecutan
-- con los privilegios del definidor para poder tocar tablas con RLS, y se
-- protegen con SET search_path y validaciones internas de pertenencia.
--
-- Se muestran las VERSIONES FINALES / CANÓNICAS (ya con search_path y con las
-- firmas definitivas).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 4.1 Helpers de seguridad / contexto
-- -----------------------------------------------------------------------------

-- get_user_sucursal(): devuelve la sucursal del usuario POS autenticado.
-- Se usa en las políticas RLS del esquema POS para aterrizar cada fila a la
-- sucursal del usuario actual.
CREATE OR REPLACE FUNCTION get_user_sucursal()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT sucursal_id FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1;
$$;

-- is_admin(): true si el usuario POS autenticado es admin de su sucursal.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT rol = 'admin' FROM public.usuarios WHERE user_id = auth.uid() LIMIT 1;
$$;

-- get_tenant_id(): devuelve el tenant del usuario autenticado. Primero
-- comprueba si es dueño de un tenant (tenants.auth_user_id) y, si no, si
-- pertenece a una branch_account activa. Es la base del aislamiento por
-- tenant en las políticas RLS del SaaS.
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT t.id INTO v_tenant_id
    FROM tenants t WHERE t.auth_user_id = auth.uid() LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;

    SELECT ba.tenant_id INTO v_tenant_id
    FROM branch_accounts ba WHERE ba.user_id = auth.uid() AND ba.activo = true LIMIT 1;
    RETURN v_tenant_id;
END;
$$;

-- is_superadmin(): true si el usuario es superadmin de la plataforma.
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid());
END;
$$;

-- is_tenant_owner(): true si el usuario es dueño del tenant o superadmin.
CREATE OR REPLACE FUNCTION is_tenant_owner(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = p_tenant_id
    AND (
      auth_user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    )
  );
END;
$$;

-- count_branches_for_tenant(): cuenta sucursales activas de un tenant.
-- Se usa para validar los límites del plan.
CREATE OR REPLACE FUNCTION count_branches_for_tenant(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM branch_accounts WHERE tenant_id = p_tenant_id AND activo = true;
    RETURN v_count;
END;
$$;

-- get_my_role(): rol del usuario dentro de su tenant (admin_negocio/cajero).
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        (SELECT ba.rol FROM public.branch_accounts ba
         WHERE ba.user_id = auth.uid() AND ba.activo = true LIMIT 1),
        'cajero'
    );
$$;

-- es_admin_negocio(): true si el usuario es admin_negocio de su tenant.
CREATE OR REPLACE FUNCTION es_admin_negocio()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.branch_accounts
        WHERE user_id = auth.uid() AND rol = 'admin_negocio' AND activo = true
    );
$$;


-- -----------------------------------------------------------------------------
-- 4.2 Inventario (concurrencia multi-cajero)
-- -----------------------------------------------------------------------------

-- decrementar_inventario(): descuenta stock al vender. Versión final de 5
-- parámetros (añade p_usuario_id). Aplica bloqueo de fila FOR UPDATE + bloqueo
-- optimista por `version` y registra el movimiento de inventario.
CREATE OR REPLACE FUNCTION decrementar_inventario(
    p_sucursal_id UUID,
    p_producto_id UUID,
    p_cantidad DECIMAL(12,3),
    p_venta_id UUID DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_usuario_id UUID;
BEGIN
    SELECT version, stock_actual INTO v_current_version, v_current_stock
    FROM inventario_sucursal
    WHERE sucursal_id = p_sucursal_id AND producto_id = p_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado en inventario de sucursal %', p_producto_id, p_sucursal_id;
    END IF;

    UPDATE inventario_sucursal
    SET stock_actual = v_current_stock - p_cantidad,
        version = v_current_version + 1,
        last_updated = NOW()
    WHERE sucursal_id = p_sucursal_id
      AND producto_id = p_producto_id
      AND version = v_current_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', p_producto_id, v_current_version;
    END IF;

    v_usuario_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');

    INSERT INTO movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_producto_id, 'venta', -p_cantidad, v_current_stock - p_cantidad, p_venta_id, 'venta', v_usuario_id, NOW());
END;
$$;

-- incrementar_inventario(): repone stock al hacer una devolución.
CREATE OR REPLACE FUNCTION incrementar_inventario(
    p_sucursal_id UUID,
    p_producto_id UUID,
    p_cantidad DECIMAL(12,3),
    p_devolucion_id UUID DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_usuario_id UUID;
BEGIN
    SELECT version, stock_actual INTO v_current_version, v_current_stock
    FROM inventario_sucursal
    WHERE sucursal_id = p_sucursal_id AND producto_id = p_producto_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto % no encontrado en inventario de sucursal %', p_producto_id, p_sucursal_id;
    END IF;

    UPDATE inventario_sucursal
    SET stock_actual = v_current_stock + p_cantidad,
        version = v_current_version + 1,
        last_updated = NOW()
    WHERE sucursal_id = p_sucursal_id
      AND producto_id = p_producto_id
      AND version = v_current_version;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', p_producto_id, v_current_version;
    END IF;

    v_usuario_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');

    INSERT INTO movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_producto_id, 'devolucion', p_cantidad, v_current_stock + p_cantidad, p_devolucion_id, 'devolucion', v_usuario_id, NOW());
END;
$$;

-- next_ticket_number(): genera el número de ticket secuencial de una sucursal.
-- (sin placeholder por uuid cero que violaba FK; usa MAX+1 como finalizar_venta)
CREATE OR REPLACE FUNCTION next_ticket_number(p_sucursal_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_next
    FROM ventas
    WHERE sucursal_id = p_sucursal_id;
    RETURN v_next;
END;
$$;

-- finalizar_venta(): cierra una venta completa dentro de una transacción,
-- descontando stock de múltiples productos con bloqueo optimista. Si falla un
-- producto, se revierte todo.
CREATE OR REPLACE FUNCTION public.finalizar_venta(
    p_sucursal_id UUID,
    p_cajero_id UUID,
    p_productos JSONB,
    p_subtotal DECIMAL(12,2),
    p_total DECIMAL(12,2),
    p_metodo_pago TEXT DEFAULT 'EFECTIVO',
    p_monto_recibido DECIMAL(12,2) DEFAULT 0,
    p_cambio_entregado DECIMAL(12,2) DEFAULT 0,
    p_cliente_nombre TEXT DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL,
    p_observacion TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_venta_id UUID;
    v_producto JSONB;
    v_producto_id UUID;
    v_cantidad DECIMAL(12,3);
    v_precio DECIMAL(12,2);
    v_costo DECIMAL(12,2);
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_new_stock DECIMAL(12,3);
    v_ticket_number BIGINT;
BEGIN
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_ticket_number
    FROM public.ventas
    WHERE sucursal_id = p_sucursal_id;

    INSERT INTO public.ventas (id, sucursal_id, cajero_id, subtotal, total, metodo_pago, monto_recibido, cambio_entregado, ticket_number, fecha_hora, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_cajero_id, p_subtotal, p_total, p_metodo_pago, p_monto_recibido, p_cambio_entregado, v_ticket_number, NOW(), NOW())
    RETURNING id INTO v_venta_id;

    FOR v_producto IN SELECT * FROM jsonb_array_elements(p_productos)
    LOOP
        v_producto_id := (v_producto->>'id')::UUID;
        v_cantidad := (v_producto->>'cantidad')::DECIMAL(12,3);
        v_precio := (v_producto->>'precio')::DECIMAL(12,2);

        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad invalida para producto %', v_producto_id;
        END IF;

        SELECT costo INTO v_costo
        FROM public.productos
        WHERE id = v_producto_id AND sucursal_id = p_sucursal_id;
        IF v_costo IS NULL THEN
            RAISE EXCEPTION 'Producto % no pertenece a sucursal %', v_producto_id, p_sucursal_id;
        END IF;

        SELECT version, stock_actual INTO v_current_version, v_current_stock
        FROM public.inventario_sucursal
        WHERE sucursal_id = p_sucursal_id AND producto_id = v_producto_id
        FOR UPDATE;
        v_current_stock := COALESCE(v_current_stock, 0);

        IF v_current_stock < v_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para producto %: actual %s, requerido %s',
                v_producto_id, v_current_stock, v_cantidad;
        END IF;

        v_new_stock := v_current_stock - v_cantidad;

        UPDATE public.inventario_sucursal
        SET stock_actual = v_new_stock, version = v_current_version + 1, last_updated = NOW()
        WHERE sucursal_id = p_sucursal_id AND producto_id = v_producto_id AND version = v_current_version;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', v_producto_id, v_current_version;
        END IF;

        INSERT INTO public.venta_detalles (id, venta_id, producto_id, cantidad_o_peso, precio_unitario, subtotal, costo_aplicado)
        VALUES (gen_random_uuid(), v_venta_id, v_producto_id, v_cantidad, v_precio, v_cantidad * v_precio, v_costo);

        INSERT INTO public.movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
        VALUES (gen_random_uuid(), p_sucursal_id, v_producto_id, 'venta', -v_cantidad, v_new_stock, v_venta_id, 'venta', p_cajero_id, NOW());
    END LOOP;

    RETURN v_venta_id;
END;
$$;

-- get_low_stock_products(): productos por debajo del stock mínimo de un tenant.
CREATE OR REPLACE FUNCTION get_low_stock_products(p_tenant_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(
  producto_id       UUID,
  codigo_barras     TEXT,
  descripcion       TEXT,
  stock_actual      DECIMAL(12,3),
  stock_minimo      DECIMAL(12,3),
  sucursal_id       UUID,
  sucursal_nombre   TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.codigo_barras, p.descripcion,
    COALESCE(inv.stk_actual, 0), p.stock_minimo, s.id, s.nombre
  FROM branch_accounts ba
  JOIN sucursales s ON s.id = ba.sucursal_id
  JOIN productos p ON p.sucursal_id = s.id AND p.activo = true
  LEFT JOIN LATERAL (
    SELECT i.stock_actual AS stk_actual
    FROM inventario_sucursal i
    WHERE i.sucursal_id = s.id AND i.producto_id = p.id LIMIT 1
  ) inv ON true
  WHERE ba.tenant_id = p_tenant_id AND ba.activo = true
    AND COALESCE(inv.stk_actual, 0) < p.stock_minimo
  ORDER BY (p.stock_minimo - COALESCE(inv.stk_actual, 0)) DESC
  LIMIT p_limit;
END;
$$;

-- Ajuste de stock (tenant) — versión final con FOR UPDATE + auditoría.
CREATE OR REPLACE FUNCTION public.adjust_tenant_product_stock(
    p_tenant_id UUID, p_producto_id UUID,
    p_tipo TEXT, p_cantidad DECIMAL(12,3),
    p_observacion TEXT DEFAULT NULL,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sucursal_id UUID;
    v_current_version INTEGER;
    v_current_stock DECIMAL(12,3);
    v_new_stock DECIMAL(12,3);
    v_usuario_id UUID;
BEGIN
    SELECT p.sucursal_id INTO v_sucursal_id
    FROM public.productos p
    JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
    WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true;
    IF v_sucursal_id IS NULL THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    SELECT version, stock_actual INTO v_current_version, v_current_stock
    FROM public.inventario_sucursal
    WHERE sucursal_id = v_sucursal_id AND producto_id = p_producto_id FOR UPDATE;
    v_current_stock := COALESCE(v_current_stock, 0);

    IF p_tipo = 'entrada' THEN
        v_new_stock := v_current_stock + p_cantidad;
    ELSIF p_tipo = 'salida' THEN
        IF v_current_stock < p_cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente: actual %s, requerido %s', v_current_stock, p_cantidad;
        END IF;
        v_new_stock := v_current_stock - p_cantidad;
    ELSE
        v_new_stock := p_cantidad;
    END IF;

    UPDATE public.inventario_sucursal
    SET stock_actual = v_new_stock, version = v_current_version + 1, last_updated = NOW()
    WHERE sucursal_id = v_sucursal_id AND producto_id = p_producto_id AND version = v_current_version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', p_producto_id, v_current_version;
    END IF;

    v_usuario_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000');
    INSERT INTO public.movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, observacion, usuario_id, created_at)
    VALUES (gen_random_uuid(), v_sucursal_id, p_producto_id, p_tipo, p_cantidad, v_new_stock, NULL, 'ajuste_manual', p_observacion, v_usuario_id, NOW());
END;
$$;

-- RPCs de catálogo del tenant (get_tenant_products / get_tenant_categories /
-- create_tenant_product / update_tenant_product / delete_tenant_product) —
-- vistas de negocio para el SaaS. Se omiten los cuerpos completos por
-- brevedad; se listan para indicar que existen en producción.
-- (definición completa en migración 20260727000000_inventory_rpcs.sql)


-- -----------------------------------------------------------------------------
-- 4.3 Ciclo de vida de la suscripción
-- -----------------------------------------------------------------------------

-- activate_tenant(): activa un tenant tras su pago inicial (idempotente).
-- Aprobar pago → activar tenant → crear empresa → crear suscripción activa →
-- registrar evento.
CREATE OR REPLACE FUNCTION activate_tenant(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_email TEXT;
    v_tenant_nombre TEXT;
    v_tenant_plan_id UUID;
    v_subscription_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND estado = 'active') THEN
        RETURN;
    END IF;

    UPDATE public.payments SET
        status = 'approved',
        updated_at = NOW()
    WHERE id = p_payment_id;

    UPDATE public.tenants SET
        estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id
    RETURNING email_propietario, nombre_negocio, plan_id
    INTO v_tenant_email, v_tenant_nombre, v_tenant_plan_id;

    INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
    VALUES (v_tenant_nombre, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;

    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active') THEN
        INSERT INTO public.subscriptions (
            tenant_id, plan_id, estado,
            fecha_inicio, fecha_renovacion, proximo_cobro,
            payment_source_id
        )
        VALUES (
            p_tenant_id, v_tenant_plan_id, 'active',
            CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
            CURRENT_DATE + INTERVAL '30 days',
            p_payment_source_id
        )
        RETURNING id INTO v_subscription_id;

        INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
        VALUES (
            v_subscription_id, p_tenant_id, 'activated',
            jsonb_build_object('payment_id', p_payment_id)
        );
    END IF;
END;
$$;

-- process_webhook_approval(): flujo atómico invocado desde el webhook de pago.
-- Aprobar pago → activar tenant → crear empresa → crear sucursal principal →
-- (upsert) suscripción activa → registrar evento.
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tenant_estado TEXT;
    v_nombre_negocio TEXT;
    v_tenant_nit TEXT;
    v_empresa_id UUID;
BEGIN
    SELECT estado, nombre_negocio, nit INTO v_tenant_estado, v_nombre_negocio, v_tenant_nit
    FROM public.tenants WHERE id = p_tenant_id;

    IF v_tenant_estado = 'active' THEN RETURN; END IF;

    UPDATE public.payments
    SET status = 'approved', updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';

    UPDATE public.tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id;

    INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
    VALUES (v_nombre_negocio, 'basico', 'activo', p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING
    RETURNING id INTO v_empresa_id;

    IF v_empresa_id IS NOT NULL THEN
        INSERT INTO public.sucursales (id, nombre, nit, empresa_id)
        VALUES (gen_random_uuid(), v_nombre_negocio || ' - Principal', v_tenant_nit, v_empresa_id)
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro)
    SELECT p_tenant_id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days'
    FROM public.tenants t WHERE t.id = p_tenant_id
    AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active');

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT s.id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id)
    FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active'
    AND NOT EXISTS (SELECT 1 FROM public.subscription_events e WHERE e.tenant_id = p_tenant_id AND e.tipo = 'activated');
END;
$$;

-- process_renewal(): procesa una renovación mensual (aprueba pago, avanza
-- fechas de cobro y registra el evento).
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.payments
    SET status = 'approved', updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';

    UPDATE public.subscriptions
    SET estado = 'active',
        fecha_renovacion = CURRENT_DATE,
        proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND estado IN ('active', 'past_due');

    UPDATE public.tenants
    SET estado = 'active', updated_at = NOW()
    WHERE id = p_tenant_id
      AND estado IN ('suspended', 'active');

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'renewed',
           jsonb_build_object('payment_id', p_payment_id, 'fecha', CURRENT_DATE)
    FROM public.subscriptions
    WHERE tenant_id = p_tenant_id
      AND estado = 'active';

    PERFORM public.generar_factura_desde_pago(p_payment_id);
END;
$$;

-- process_plan_change(): cambia el plan de un tenant cuando se aprueba el pago.
CREATE OR REPLACE FUNCTION process_plan_change(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_new_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;

    IF p_payment_id != '00000000-0000-0000-0000-000000000000' THEN
        UPDATE payments SET status = 'approved', updated_at = NOW()
        WHERE id = p_payment_id AND status != 'approved';
    END IF;

    INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object(
        'new_plan_id', p_new_plan_id,
        'payment_id', p_payment_id
    )
    FROM subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- change_subscription_plan(): cambio de plan gestionado por gerencia/superadmin.
CREATE OR REPLACE FUNCTION change_subscription_plan(p_tenant_id UUID, p_new_plan_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old_plan_id UUID; v_old_plan_name TEXT; v_new_plan_name TEXT;
BEGIN
    SELECT plan_id INTO v_old_plan_id FROM public.tenants WHERE id = p_tenant_id;
    SELECT nombre INTO v_old_plan_name FROM public.plans WHERE id = v_old_plan_id;
    SELECT nombre INTO v_new_plan_name FROM public.plans WHERE id = p_new_plan_id;

    UPDATE public.tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE public.subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object(
        'new_plan_id', p_new_plan_id, 'old_plan_id', v_old_plan_id,
        'old_plan_name', v_old_plan_name, 'new_plan_name', v_new_plan_name,
        'changed_by', 'gerencia', 'changed_at', NOW()
    )
    FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- cancel_subscription(): cancela tenant y suscripción (con validación de
-- propiedad en is_tenant_owner).
CREATE OR REPLACE FUNCTION cancel_subscription(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_tenant_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.tenants SET estado = 'cancelled', updated_at = NOW() WHERE id = p_tenant_id;
  UPDATE public.subscriptions SET estado = 'cancelled', updated_at = NOW() WHERE tenant_id = p_tenant_id;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'cancelled', '{}'::jsonb
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- mark_subscription_past_due(): marca past_due y suspende el tenant cuando
-- falla la renovación.
CREATE OR REPLACE FUNCTION mark_subscription_past_due(
  p_tenant_id UUID,
  p_payment_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.subscriptions SET estado = 'past_due', updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND estado = 'active';
  UPDATE public.tenants SET estado = 'suspended', updated_at = NOW()
  WHERE id = p_tenant_id AND estado = 'active';
  IF p_payment_id IS NOT NULL THEN
    UPDATE public.payments SET status = 'declined', updated_at = NOW()
    WHERE id = p_payment_id AND status = 'pending';
  END IF;
  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'past_due', jsonb_build_object('payment_id', p_payment_id, 'reason', 'Renovación rechazada')
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- reactivate_subscription(): reactiva un tenant/suscripción suspendida.
CREATE OR REPLACE FUNCTION reactivate_subscription(
  p_tenant_id UUID,
  p_payment_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.payments SET status = 'approved', updated_at = NOW()
  WHERE id = p_payment_id AND status IN ('pending', 'declined');
  UPDATE public.subscriptions SET estado = 'active', updated_at = NOW() WHERE tenant_id = p_tenant_id;
  UPDATE public.tenants SET estado = 'active', updated_at = NOW() WHERE id = p_tenant_id;
END;
$$;

-- process_expired_subscriptions(): expira suscripciones past_due >= 14 días.
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS TABLE(tenant_id UUID, subscription_id UUID, dias_vencido INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    SELECT s.id AS sub_id, s.tenant_id AS tid,
      (CURRENT_DATE - se.created_at::DATE) AS dias_vencido
    FROM public.subscriptions s
    JOIN LATERAL (
      SELECT created_at FROM public.subscription_events
      WHERE subscription_id = s.id AND tipo = 'past_due'
      ORDER BY created_at DESC LIMIT 1
    ) se ON true
    WHERE s.estado = 'past_due'
      AND (CURRENT_DATE - se.created_at::DATE) >= 14
  )
  UPDATE public.subscriptions s
  SET estado = 'expired', updated_at = NOW()
  FROM expired e
  WHERE s.id = e.sub_id
  RETURNING e.tid, e.sub_id, e.dias_vencido;

  UPDATE public.tenants t
  SET estado = 'cancelled', updated_at = NOW()
  FROM expired e
  WHERE t.id = e.tid AND t.estado IN ('suspended', 'active');
END;
$$;

-- get_subscription_info(): info de suscripción para el POS/SaaS, con estado
-- dinámico (active / past_due / expired / suspended).
CREATE FUNCTION get_subscription_info()
RETURNS TABLE (
    sucursal_nombre TEXT,
    plan TEXT,
    subscription_status TEXT,
    proximo_cobro DATE,
    max_sucursales INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_tenant_id UUID; v_subscription RECORD; v_plan RECORD; v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RETURN; END IF;

    SELECT id INTO v_tenant_id FROM tenants WHERE auth_user_id = v_user_id LIMIT 1;
    IF v_tenant_id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_subscription FROM subscriptions WHERE tenant_id = v_tenant_id ORDER BY created_at DESC LIMIT 1;
    IF v_subscription.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_plan FROM plans WHERE id = v_subscription.plan_id;

    sucursal_nombre := (SELECT nombre_negocio FROM tenants WHERE id = v_tenant_id);
    plan := v_plan.nombre;
    max_sucursales := v_plan.max_sucursales;
    proximo_cobro := v_subscription.proximo_cobro;
    subscription_status := CASE
        WHEN v_subscription.estado = 'cancelled' THEN 'expired'
        WHEN v_subscription.estado = 'suspended' THEN 'suspended'
        WHEN v_subscription.estado = 'active' AND v_subscription.proximo_cobro IS NOT NULL AND v_subscription.proximo_cobro < CURRENT_DATE THEN 'past_due'
        WHEN v_subscription.estado = 'active' THEN 'active'
        ELSE v_subscription.estado
    END;
    RETURN NEXT;
END;
$$;

-- approve_renewal() / approve_plan_change(): aprobación de solicitudes de
-- renovación y cambio de plan.
-- (definición completa en migración 20260731000003_subscription_requests.sql)

-- approve_tenant(): aprobación manual de un tenant tras comprobante de pago.
-- (definición completa en migración 20260716000000_fixes_and_proofs.sql)

-- create_branch(): validación de límites del plan + creación de sucursal
-- (el alta del auth user la hace una Edge Function).
-- (definición completa en migración 20260622/20260621)


-- -----------------------------------------------------------------------------
-- 4.4 Facturación del SaaS
-- -----------------------------------------------------------------------------

-- generar_numero_factura(): secuencia atómica anual. Formato final VENX-YYYY-NNNNNN.
CREATE OR REPLACE FUNCTION public.generar_numero_factura(p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_numero integer;
BEGIN
    INSERT INTO public.invoice_counter (anio, ultimo_numero)
    VALUES (p_anio, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo_numero = public.invoice_counter.ultimo_numero + 1
    RETURNING public.invoice_counter.ultimo_numero INTO v_numero;
    RETURN 'VENX-' || p_anio::text || '-' || LPAD(v_numero::text, 6, '0');
END;
$$;

-- generar_factura_desde_pago(): crea la factura del SaaS a partir de un pago
-- ya aprobado. Sin IVA ni gateway: subtotal = total = monto del pago.
CREATE OR REPLACE FUNCTION public.generar_factura_desde_pago(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment record;
    v_tenant record;
    v_plan record;
    v_numero text;
    v_concepto text;
    v_total numeric;
    v_factura_id uuid;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pago no encontrado'; END IF;

    SELECT * INTO v_tenant FROM public.tenants WHERE id = v_payment.tenant_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tenant no encontrado'; END IF;

    SELECT * INTO v_plan FROM public.plans WHERE id = v_tenant.plan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan no encontrado'; END IF;

    v_concepto := CASE v_payment.tipo
        WHEN 'initial' THEN 'Instalacion inicial + primer mes - Plan ' || v_plan.nombre
        WHEN 'recurring' THEN 'Renovacion mensual - Plan ' || v_plan.nombre
        WHEN 'plan_change' THEN 'Cambio de plan - ' || v_plan.nombre
        ELSE 'Pago - Plan ' || v_plan.nombre
    END;

    v_total := v_payment.amount;
    v_numero := public.generar_numero_factura(EXTRACT(YEAR FROM NOW())::integer);

    INSERT INTO public.facturas_saas (tenant_id, payment_id, numero_factura, concepto, subtotal, total, moneda, estado)
    VALUES (v_payment.tenant_id, v_payment.id, v_numero, v_concepto, v_total, v_payment.amount, v_payment.currency, 'emitida')
    RETURNING id INTO v_factura_id;

    RETURN v_factura_id;
END;
$$;


-- -----------------------------------------------------------------------------
-- 4.5 Reportes y métricas del SaaS
-- -----------------------------------------------------------------------------
-- get_mrr / get_arr / get_facturacion_mensual / get_facturacion_anual /
-- get_pagos_pendientes / get_ventas_periodo / count_facturas_tenant / log_audit
-- (definiciones completas en migración 20260701000000_facturacion_reportes.sql)

CREATE OR REPLACE FUNCTION get_mrr()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(pl.precio_mensual)
         FROM public.subscriptions s
         JOIN public.plans pl ON pl.id = s.plan_id
         WHERE s.estado = 'active'), 0);
END;
$$;

CREATE OR REPLACE FUNCTION get_arr()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN get_mrr() * 12;
END;
$$;

CREATE OR REPLACE FUNCTION get_facturacion_mensual(
    p_mes integer DEFAULT EXTRACT(MONTH FROM NOW())::integer,
    p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer
)
RETURNS TABLE(total numeric, cantidad bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT COALESCE(SUM(f.total), 0), COUNT(*)::bigint
    FROM public.facturas_saas f
    WHERE EXTRACT(MONTH FROM f.created_at) = p_mes
      AND EXTRACT(YEAR FROM f.created_at) = p_anio;
END;
$$;

CREATE OR REPLACE FUNCTION get_facturacion_anual(p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
RETURNS TABLE(mes integer, total numeric, cantidad bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT EXTRACT(MONTH FROM f.created_at)::integer AS mes,
           COALESCE(SUM(f.total), 0) AS total, COUNT(*)::bigint AS cantidad
    FROM public.facturas_saas f
    WHERE EXTRACT(YEAR FROM f.created_at) = p_anio
    GROUP BY mes ORDER BY mes;
END;
$$;

CREATE OR REPLACE FUNCTION get_pagos_pendientes()
RETURNS TABLE(tenant_id uuid, nombre_negocio text, total numeric, dias_vencido integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.nombre_negocio, pl.precio_mensual,
           GREATEST(EXTRACT(DAY FROM NOW() - s.proximo_cobro)::integer, 0)
    FROM public.subscriptions s
    JOIN public.tenants t ON t.id = s.tenant_id
    JOIN public.plans pl ON pl.id = s.plan_id
    WHERE s.estado = 'active' AND s.proximo_cobro < CURRENT_DATE
    ORDER BY s.proximo_cobro ASC;
END;
$$;

CREATE OR REPLACE FUNCTION get_ventas_periodo(
    p_tenant_id uuid,
    p_sucursal_id uuid DEFAULT NULL,
    p_desde timestamptz DEFAULT NULL,
    p_hasta timestamptz DEFAULT NULL
)
RETURNS TABLE(total_ventas numeric, cantidad_transacciones bigint, ticket_promedio numeric, ganancia numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_sucursales uuid[];
BEGIN
    SELECT ARRAY_AGG(ba.sucursal_id) INTO v_sucursales
    FROM public.branch_accounts ba
    WHERE ba.tenant_id = p_tenant_id AND ba.sucursal_id IS NOT NULL
      AND (p_sucursal_id IS NULL OR ba.sucursal_id = p_sucursal_id);

    IF v_sucursales IS NULL OR array_length(v_sucursales, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT COALESCE(SUM(v.total), 0), COUNT(*)::bigint,
           CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.total), 0) / COUNT(*) ELSE 0 END,
           COALESCE(SUM(v.subtotal - COALESCE(vd.costo, 0)), 0)
    FROM public.ventas v
    LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(vd2.costo_aplicado, 0)) AS costo
        FROM public.venta_detalles vd2 WHERE vd2.venta_id = v.id
    ) vd ON true
    WHERE v.sucursal_id = ANY(v_sucursales)
      AND (p_desde IS NULL OR v.fecha_hora >= p_desde)
      AND (p_hasta IS NULL OR v.fecha_hora <= p_hasta);
END;
$$;

CREATE OR REPLACE FUNCTION count_facturas_tenant(p_tenant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.facturas_saas WHERE tenant_id = p_tenant_id);
END;
$$;

CREATE OR REPLACE FUNCTION log_audit(
    p_accion text,
    p_entidad text,
    p_tenant_id uuid DEFAULT NULL,
    p_user_id uuid DEFAULT NULL,
    p_entidad_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}'::jsonb,
    p_ip_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.audit_logs (tenant_id, user_id, accion, entidad, entidad_id, metadata, ip_address)
    VALUES (p_tenant_id, p_user_id, p_accion, p_entidad, p_entidad_id, p_metadata, p_ip_address)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


-- =============================================================================
-- =============================================================================
-- FASE 5 — TRIGGERS
-- =============================================================================
-- =============================================================================
--
-- Los triggers garantizan que updated_at se actualice automáticamente en cada
-- UPDATE. Hay dos funciones: una para el esquema POS (trigger_set_updated_at)
-- y otra para el esquema SaaS (trigger_set_updated_at_saas). Además se crea el
-- trigger que asigna client_id a los tenants nuevos.
-- =============================================================================

-- Función genérica para actualizar updated_at (esquema POS)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Función genérica para actualizar updated_at (esquema SaaS)
CREATE OR REPLACE FUNCTION trigger_set_updated_at_saas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger específico de facturas_saas (su updated_at también se mantiene)
CREATE OR REPLACE FUNCTION update_facturas_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Trigger de client_id (genera el número de cliente de 10 dígitos)
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.client_id IS NULL THEN
        NEW.client_id := LPAD(nextval('public.client_counter_id_seq')::TEXT, 10, '0');
    END IF;
    RETURN NEW;
END;
$$;

-- Triggers de updated_at por tabla (esquema POS)
CREATE TRIGGER set_updated_at_sucursales
    BEFORE UPDATE ON sucursales FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_usuarios
    BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_productos
    BEFORE UPDATE ON productos FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_ventas
    BEFORE UPDATE ON ventas FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_cierres
    BEFORE UPDATE ON cierres_caja FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_categorias
    BEFORE UPDATE ON categorias FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_aperturas
    BEFORE UPDATE ON aperturas_caja FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_devoluciones
    BEFORE UPDATE ON devoluciones FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Triggers de updated_at por tabla (esquema SaaS)
CREATE TRIGGER set_updated_at_tenants
    BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_saas();
CREATE TRIGGER set_updated_at_subscriptions
    BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_saas();
CREATE TRIGGER set_updated_at_payments
    BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at_saas();
CREATE TRIGGER trg_facturas_updated_at
    BEFORE UPDATE ON facturas_saas FOR EACH ROW EXECUTE FUNCTION update_facturas_updated_at();

-- Trigger de client_id en tenants
CREATE TRIGGER trg_client_id
    BEFORE INSERT ON tenants FOR EACH ROW EXECUTE FUNCTION generate_client_id();


-- =============================================================================
-- =============================================================================
-- FASE 6 — ROW LEVEL SECURITY (políticas finales)
-- =============================================================================
-- =============================================================================
--
-- El RLS es la barrera de seguridad principal: cada tabla restringe qué filas
-- puede ver/modificar cada usuario según su contexto (sucursal, tenant o rol
-- de superadmin). Supabase (service_role) bypassa el RLS por diseño, por lo
-- que las Edge Functions no necesitan políticas.
--
-- PATRONES DE POLÍTICA:
--   * POS:     "Leer X de sucursal" (SELECT donde sucursal_id =
--              get_user_sucursal()) y "Admin gestiona X" (ALL donde
--              sucursal_id = get_user_sucursal() AND is_admin()).
--   * SaaS:    "select_own_*" (auth_user_id = auth.uid() OR superadmin) y
--              "superadmin_*" (INSERT/UPDATE/DELETE solo superadmin).
--   * Tenant:  políticas adicionales que permiten al dueño de tenant leer
--              las sucursales de su negocio mediante branch_accounts.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 6.1 RLS del esquema POS
-- -----------------------------------------------------------------------------

ALTER TABLE sucursales ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_sucursal ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_detalles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_conflicto ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE aperturas_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_detalles ENABLE ROW LEVEL SECURITY;

-- Sucursales: leer la propia / admin todo / dueño del tenant / superadmin
CREATE POLICY "Leer propia sucursal" ON sucursales FOR SELECT USING (id = get_user_sucursal());
CREATE POLICY "Admin lee todas las sucursales" ON sucursales FOR SELECT USING (is_admin());
CREATE POLICY "Leer sucursales tenant" ON sucursales FOR SELECT TO authenticated USING (
    id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Usuarios
CREATE POLICY "Leer usuarios de sucursal" ON usuarios FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona usuarios" ON usuarios FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());

-- Productos
CREATE POLICY "Leer productos de sucursal" ON productos FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona productos" ON productos FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer productos tenant" ON productos FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Inventario
CREATE POLICY "Leer inventario de sucursal" ON inventario_sucursal FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona inventario" ON inventario_sucursal FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer inventario tenant" ON inventario_sucursal FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Ventas
CREATE POLICY "Leer ventas de sucursal" ON ventas FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar ventas" ON ventas FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer ventas tenant" ON ventas FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Detalles de venta
CREATE POLICY "Leer detalles de venta" ON venta_detalles FOR SELECT USING (
    venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Insertar detalles" ON venta_detalles FOR INSERT WITH CHECK (
    venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Leer detalles tenant" ON venta_detalles FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.ventas v
        WHERE v.id = venta_id AND (
            v.sucursal_id IN (
                SELECT ba.sucursal_id FROM public.branch_accounts ba
                WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
                  AND ba.activo = true AND ba.sucursal_id IS NOT NULL
            ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
        )
    )
);

-- Cierres de caja
CREATE POLICY "Leer cierres de sucursal" ON cierres_caja FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar cierres" ON cierres_caja FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer cierres tenant" ON cierres_caja FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Conflictos de venta
CREATE POLICY "Leer conflictos de sucursal" ON ventas_conflicto FOR SELECT USING (
    venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Admin gestiona conflictos" ON ventas_conflicto FOR ALL USING (
    venta_id IN (SELECT id FROM ventas WHERE sucursal_id = get_user_sucursal()) AND is_admin());
CREATE POLICY "Leer conflictos tenant" ON ventas_conflicto FOR SELECT TO authenticated USING (
    venta_id IN (
        SELECT v.id FROM public.ventas v
        WHERE v.sucursal_id IN (
            SELECT ba.sucursal_id FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
              AND ba.activo = true AND ba.sucursal_id IS NOT NULL
        )
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Eventos de auditoría
CREATE POLICY "Leer eventos de sucursal" ON eventos_auditoria FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar eventos" ON eventos_auditoria FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer eventos tenant" ON eventos_auditoria FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Categorías
CREATE POLICY "Leer categorias sucursal" ON categorias FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona categorias" ON categorias FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer categorias tenant" ON categorias FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Movimientos de inventario
CREATE POLICY "Leer movimientos sucursal" ON movimientos_inventario FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar movimientos" ON movimientos_inventario FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer movimientos tenant" ON movimientos_inventario FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Aperturas de caja
CREATE POLICY "Leer aperturas sucursal" ON aperturas_caja FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar aperturas" ON aperturas_caja FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Admin gestiona aperturas" ON aperturas_caja FOR ALL USING (sucursal_id = get_user_sucursal() AND is_admin());
CREATE POLICY "Leer aperturas tenant" ON aperturas_caja FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Devoluciones
CREATE POLICY "Leer devoluciones sucursal" ON devoluciones FOR SELECT USING (sucursal_id = get_user_sucursal());
CREATE POLICY "Insertar devoluciones" ON devoluciones FOR INSERT WITH CHECK (sucursal_id = get_user_sucursal());
CREATE POLICY "Leer devoluciones tenant" ON devoluciones FOR SELECT TO authenticated USING (
    sucursal_id IN (
        SELECT ba.sucursal_id FROM public.branch_accounts ba
        WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
          AND ba.activo = true AND ba.sucursal_id IS NOT NULL
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);

-- Detalles de devolución
CREATE POLICY "Leer detalles devolucion" ON devolucion_detalles FOR SELECT USING (
    devolucion_id IN (SELECT id FROM devoluciones WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Insertar detalles devolucion" ON devolucion_detalles FOR INSERT WITH CHECK (
    devolucion_id IN (SELECT id FROM devoluciones WHERE sucursal_id = get_user_sucursal()));
CREATE POLICY "Leer detalles devolucion tenant" ON devolucion_detalles FOR SELECT TO authenticated USING (
    devolucion_id IN (
        SELECT d.id FROM public.devoluciones d
        WHERE d.sucursal_id IN (
            SELECT ba.sucursal_id FROM public.branch_accounts ba
            WHERE ba.tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.auth_user_id = auth.uid())
              AND ba.activo = true AND ba.sucursal_id IS NOT NULL
        )
    ) OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
);


-- -----------------------------------------------------------------------------
-- 6.2 RLS del esquema SaaS
-- -----------------------------------------------------------------------------

-- Plans: cualquiera autenticado lee; solo superadmin escribe.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_plans_auth" ON plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadmin_insert_plans" ON plans FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_update_plans" ON plans FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_delete_plans" ON plans FOR DELETE TO authenticated USING (is_superadmin());

-- Tenants: dueño ve el suyo; superadmin ve todos. El estado no puede
-- auto-mutarse (solo superadmin o mantenimiento de estado por backend).
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_tenant" ON tenants FOR SELECT TO authenticated USING (auth_user_id = auth.uid() OR is_superadmin());
CREATE POLICY "insert_tenant_auth" ON tenants FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());
CREATE POLICY "update_own_tenant" ON tenants FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid() OR is_superadmin())
    WITH CHECK (
        is_superadmin()
        OR (auth_user_id = auth.uid() AND estado IS NOT DISTINCT FROM (
            SELECT estado FROM tenants WHERE id = (SELECT get_tenant_id())
        ))
    );
CREATE POLICY "superadmin_delete_tenants" ON tenants FOR DELETE TO authenticated USING (is_superadmin());

-- Subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "superadmin_insert_subscriptions" ON subscriptions FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_update_subscriptions" ON subscriptions FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin ve todas las suscripciones" ON subscriptions FOR ALL
    USING (is_superadmin() OR tenant_id = get_tenant_id());

-- Subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_events" ON subscription_events FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "Superadmin ve todos los eventos" ON subscription_events FOR ALL
    USING (is_superadmin() OR tenant_id = get_tenant_id());

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_payments" ON payments FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "superadmin_insert_payments" ON payments FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_update_payments" ON payments FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin ve todos los pagos" ON payments FOR ALL
    USING (is_superadmin() OR tenant_id = get_tenant_id());

-- Branch_accounts
ALTER TABLE branch_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_branch" ON branch_accounts FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "insert_branch_accounts" ON branch_accounts FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "update_branch_accounts" ON branch_accounts FOR UPDATE TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin())
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "delete_branch_accounts" ON branch_accounts FOR DELETE TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "Usuarios ven sus propias branch_accounts" ON branch_accounts FOR SELECT
    USING (user_id = auth.uid() OR es_admin_negocio());

-- Superadmins
ALTER TABLE superadmins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_superadmins_auth" ON superadmins FOR SELECT TO authenticated USING (true);
CREATE POLICY "superadmin_insert_superadmins" ON superadmins FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_update_superadmins" ON superadmins FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "superadmin_delete_superadmins" ON superadmins FOR DELETE TO authenticated USING (is_superadmin());

-- Facturas_saas
ALTER TABLE facturas_saas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_facturas" ON facturas_saas FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "insert_facturas_superadmin" ON facturas_saas FOR INSERT TO authenticated WITH CHECK (is_superadmin());
CREATE POLICY "update_facturas_superadmin" ON facturas_saas FOR UPDATE TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin ve todas las facturas" ON facturas_saas FOR ALL
    USING (is_superadmin() OR tenant_id = get_tenant_id());

-- Invoice_counter: solo superadmin
ALTER TABLE invoice_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_counter" ON invoice_counter FOR SELECT TO authenticated USING (is_superadmin());
CREATE POLICY "update_counter" ON invoice_counter FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());

-- Audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_audit" ON audit_logs FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "insert_audit_superadmin" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_superadmin());

-- Subscription_requests
ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_requests" ON subscription_requests FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "insert_own_requests" ON subscription_requests FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "update_requests_superadmin" ON subscription_requests FOR UPDATE TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "Superadmin ve todas las solicitudes" ON subscription_requests FOR ALL
    USING (is_superadmin() OR tenant_id = get_tenant_id());

-- Payment_proofs
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_payment_proofs" ON payment_proofs FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "insert_own_payment_proofs" ON payment_proofs FOR INSERT TO authenticated
    WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "superadmin_manage_payment_proofs" ON payment_proofs FOR ALL
    USING (is_superadmin()) WITH CHECK (is_superadmin());

-- Pending_signups: solo superadmin (protege el password_hash)
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_pending_signups_superadmin" ON pending_signups FOR SELECT TO authenticated USING (is_superadmin());
CREATE POLICY "update_pending_signups_superadmin" ON pending_signups FOR UPDATE TO authenticated USING (is_superadmin()) WITH CHECK (is_superadmin());
CREATE POLICY "delete_pending_signups_superadmin" ON pending_signups FOR DELETE TO authenticated USING (is_superadmin());

-- Empresas: dueño del tenant lee la suya; superadmin gestiona todo
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_empresa" ON empresas FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()) OR is_superadmin());
CREATE POLICY "superadmin_manage_empresas" ON empresas FOR ALL TO authenticated
    USING (is_superadmin()) WITH CHECK (is_superadmin());


-- =============================================================================
-- =============================================================================
-- FASE 7 — ÍNDICES DE PERFORMANCE
-- =============================================================================
-- =============================================================================
-- Los índices aceleran las consultas más comunes: filtros por sucursal, por
-- fecha, por producto y por tenant. Se crean de forma idempotente.
-- =============================================================================

-- Índices del esquema POS
CREATE INDEX IF NOT EXISTS idx_productos_sucursal ON productos(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_productos_barras ON productos(sucursal_id, codigo_barras);
CREATE INDEX IF NOT EXISTS idx_productos_favoritos ON productos(sucursal_id, es_favorito DESC);
CREATE INDEX IF NOT EXISTS idx_inventario_sucursal ON inventario_sucursal(sucursal_id, producto_id);
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal ON ventas(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cajero ON ventas(cajero_id);
CREATE INDEX IF NOT EXISTS idx_ventas_hash ON ventas(hash);
CREATE INDEX IF NOT EXISTS idx_ventas_ticket_sucursal ON ventas(sucursal_id, ticket_number DESC);
CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX IF NOT EXISTS idx_cierres_sucursal ON cierres_caja(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_conflictos_venta ON ventas_conflicto(venta_id);
CREATE INDEX IF NOT EXISTS idx_eventos_sucursal ON eventos_auditoria(sucursal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_auditoria(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_sucursal ON categorias(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_aperturas_caja_sucursal ON aperturas_caja(sucursal_id, fecha_apertura DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_lookup ON movimientos_inventario(sucursal_id, producto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_tipo ON movimientos_inventario(sucursal_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devoluciones_sucursal ON devoluciones(sucursal_id, fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_devoluciones_original ON devoluciones(venta_original_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_detalles_dev ON devolucion_detalles(devolucion_id);

-- Índices del esquema SaaS
CREATE INDEX IF NOT EXISTS idx_tenants_auth_user_id ON tenants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_estado ON tenants(estado);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_estado ON subscriptions(estado);
CREATE INDEX IF NOT EXISTS idx_subscriptions_proximo_cobro ON subscriptions(proximo_cobro);
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_tenant_id ON subscription_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created_at ON subscription_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_branch_accounts_tenant_id ON branch_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_accounts_sucursal_id ON branch_accounts(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_branch_accounts_user_id ON branch_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_superadmins_user_id ON superadmins(user_id);
CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id ON empresas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant_id ON facturas_saas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_payment_id ON facturas_saas(payment_id);
CREATE INDEX IF NOT EXISTS idx_facturas_created_at ON facturas_saas(created_at);
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON facturas_saas(numero_factura);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_accion ON audit_logs(accion);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sub_req_tenant ON subscription_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_req_estado ON subscription_requests(estado);
CREATE INDEX IF NOT EXISTS idx_sub_req_tipo ON subscription_requests(tipo);
CREATE INDEX IF NOT EXISTS idx_sub_req_created ON subscription_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_tenant ON payment_proofs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs(status);
CREATE INDEX IF NOT EXISTS idx_pending_signups_reference ON pending_signups(reference);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_estado ON pending_signups(estado);


-- =============================================================================
-- =============================================================================
-- FASE 8 — GRANTS (permisos de ejecución)
-- =============================================================================
-- =============================================================================
-- En producción, la mayoría de funciones son SECURITY DEFINER, por lo que el
-- grant de EXECUTE al rol authenticated basta para que el frontend las invoque
-- por RPC. Se reflejan los grants que aparecen en las migraciones.
-- =============================================================================

-- Facturación
GRANT EXECUTE ON FUNCTION public.generar_numero_factura TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_factura_desde_pago TO authenticated;

-- Cancelación de suscripción
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID) TO service_role;

-- Cambio de plan
GRANT EXECUTE ON FUNCTION public.change_subscription_plan(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_subscription_plan(UUID, UUID) TO service_role;

-- Inventario (catálogo del tenant)
GRANT EXECUTE ON FUNCTION public.get_tenant_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_categories TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_tenant_product_stock(UUID, UUID, TEXT, DECIMAL(12,3), TEXT, UUID) TO authenticated;

-- Ventas (POS)
GRANT EXECUTE ON FUNCTION public.finalizar_venta(UUID, UUID, JSONB, DECIMAL(12,2), DECIMAL(12,2), TEXT, DECIMAL(12,2), DECIMAL(12,2), TEXT, UUID, TEXT) TO authenticated;

-- Roles
GRANT EXECUTE ON FUNCTION public.get_my_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_negocio TO authenticated;

-- Aprobación de solicitudes
GRANT EXECUTE ON FUNCTION public.approve_renewal TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_change TO authenticated;


-- =============================================================================
-- =============================================================================
-- FASE 9 — SEED DATA (planes de suscripción)
-- =============================================================================
-- =============================================================================
--
-- Planes oficiales de la plataforma. Originalmente se sembraron cuatro planes
-- (Básico, Estándar, Pro y Empresarial); el plan Empresarial (sucursales
-- ilimitadas) se ELIMINÓ después por no formar parte del catálogo oficial,
-- dejando tres planes. Incluimos aquí los valores canónicos que define la
-- migración de seed del esquema SaaS.
-- =============================================================================

INSERT INTO plans (nombre, max_sucursales, max_administradores, precio_inicial, precio_mensual, features, activo, destacado)
VALUES
    ('Básico',  2,  2,  150000, 80000,
     '["2 sucursales","2 administradores","Reportes","Inventario","Soporte básico"]',
     true, false),
    ('Estándar',5,  5,  250000, 150000,
     '["5 sucursales","5 administradores","Reportes avanzados","Inventario multi-sucursal","Soporte prioritario"]',
     true, true),
    ('Pro',    10, 10, 400000, 250000,
     '["10 sucursales","10 administradores","Reportes personalizados","API de acceso","Soporte 24/7"]',
     true, false)
ON CONFLICT (nombre) DO NOTHING;

-- NOTA: existe además un seed de datos DEMO (supabase/seed.sql) que introduce
-- otras tarifas y un tenant de demostración. Ese archivo NO forma parte del
-- esquema (son datos de prueba), por lo que aquí solo se siembran los planes
-- oficiales definidos en las migraciones del esquema.

-- Contador de facturas: se inicializa para el año actual.
INSERT INTO invoice_counter (anio, ultimo_numero)
SELECT EXTRACT(YEAR FROM NOW())::integer, 0
WHERE NOT EXISTS (SELECT 1 FROM invoice_counter WHERE anio = EXTRACT(YEAR FROM NOW())::integer);
