-- =============================================================================
-- VenxPOS — Limpieza: impuestos/IVA, DIAN y wompi/gateway
-- Date: 2026-09-01
-- Description:
--   * Elimina todas las columnas y lógica de impuestos (IVA, impoconsumo,
--     tarifas) de productos, ventas, detalles, devoluciones y facturas.
--   * Elimina la tabla configuracion_fiscal y sucursales.resolucion_dian (DIAN).
--   * Elimina las columnas de pasarela de pago (gateway_transaction_id /
--     gateway_reference, antes wompi_*) y toda referencia en RPCs.
--   * Métodos de pago del POS: se retira TARJETA y se incorpora QR.
--   * Recrea las funciones/RPCs afectadas sin dichas columnas.
-- =============================================================================

-- 1) MÉTODOS DE PAGO: quitar TARJETA, agregar QR
-- =============================================================================
ALTER TABLE public.ventas      DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check;
ALTER TABLE public.devoluciones DROP CONSTRAINT IF EXISTS devoluciones_metodo_pago_check;

-- Normalizar histórico: las ventas pagadas con tarjeta pasan a billetera digital
UPDATE public.ventas      SET metodo_pago = 'BILLETERA' WHERE metodo_pago = 'TARJETA';
UPDATE public.devoluciones SET metodo_pago = 'BILLETERA' WHERE metodo_pago = 'TARJETA';

ALTER TABLE public.ventas
    ADD CONSTRAINT ventas_metodo_pago_check
    CHECK (metodo_pago IN ('EFECTIVO','BILLETERA','QR','MIXTO'));

ALTER TABLE public.devoluciones
    ADD CONSTRAINT devoluciones_metodo_pago_check
    CHECK (metodo_pago IN ('EFECTIVO','BILLETERA','QR','MIXTO'));


-- 2) ELIMINACIÓN DE COLUMNAS DE IMPUESTOS / IVA / IMPOCONSUMO
-- =============================================================================
ALTER TABLE public.productos             DROP COLUMN IF EXISTS tarifa_iva;
ALTER TABLE public.productos             DROP COLUMN IF EXISTS tarifa_impoconsumo;
ALTER TABLE public.ventas                DROP COLUMN IF EXISTS impuestos;
ALTER TABLE public.venta_detalles        DROP COLUMN IF EXISTS tarifa_iva_aplicada;
ALTER TABLE public.venta_detalles        DROP COLUMN IF EXISTS tarifa_impoconsumo_aplicada;
ALTER TABLE public.devoluciones          DROP COLUMN IF EXISTS impuestos;
ALTER TABLE public.devolucion_detalles   DROP COLUMN IF EXISTS tarifa_iva_aplicada;
ALTER TABLE public.devolucion_detalles   DROP COLUMN IF EXISTS tarifa_impoconsumo_aplicada;
ALTER TABLE public.facturas_saas         DROP COLUMN IF EXISTS iva;


-- 3) ELIMINACIÓN DE COLUMNAS DIAN
-- =============================================================================
ALTER TABLE public.sucursales            DROP COLUMN IF EXISTS resolucion_dian;
DROP TABLE IF EXISTS public.configuracion_fiscal;


-- 4) ELIMINACIÓN DE COLUMNAS DE PASARELA (wompi → gateway → fuera)
-- =============================================================================
ALTER TABLE public.payments              DROP COLUMN IF EXISTS gateway_transaction_id;
ALTER TABLE public.payments              DROP COLUMN IF EXISTS gateway_reference;
ALTER TABLE public.facturas_saas         DROP COLUMN IF EXISTS gateway_transaction_id;
ALTER TABLE public.payment_proofs        DROP COLUMN IF EXISTS gateway_reference;


-- 5) NORMALIZAR HISTÓRICO: sin impuestos, subtotal == total
-- =============================================================================
UPDATE public.ventas SET subtotal = total WHERE subtotal IS DISTINCT FROM total;


-- 6) RECREACIÓN DE FUNCIONES / RPCs AFECTADAS
-- =============================================================================

-- 6.0 DROP de versiones obsoletas (cambian de firma o tipo de retorno)
--     para evitar overloads rotos.
DROP FUNCTION IF EXISTS public.activate_tenant(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.set_pending_approval(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.process_plan_change(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.process_renewal(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.process_webhook_approval(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.create_tenant_product(uuid, uuid, text, text, numeric, numeric, numeric, numeric, uuid, numeric, numeric);
DROP FUNCTION IF EXISTS public.update_tenant_product(uuid, uuid, text, text, numeric, numeric, numeric, uuid, numeric, numeric, boolean);
DROP FUNCTION IF EXISTS public.get_tenant_products(uuid, uuid);
DROP FUNCTION IF EXISTS public.finalizar_venta(uuid, uuid, jsonb, numeric, numeric, numeric, text, numeric, numeric, text, uuid, text);

-- 6.1 generar_factura_desde_pago: sin IVA ni gateway
CREATE OR REPLACE FUNCTION public.generar_factura_desde_pago(p_payment_id uuid)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
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
$function$;

-- 6.2 activate_tenant: sin wompi_transaction_id
CREATE OR REPLACE FUNCTION public.activate_tenant(p_tenant_id uuid, p_payment_id uuid, p_payment_source_id text DEFAULT ''::text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
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
$function$;

-- 6.3 set_pending_approval: sin wompi_transaction_id
CREATE OR REPLACE FUNCTION public.set_pending_approval(p_tenant_id uuid, p_payment_id uuid DEFAULT NULL::uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
BEGIN
    -- Marcar pago como aprobado (si existe)
    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET status = 'approved', updated_at = NOW()
        WHERE id = p_payment_id AND status != 'approved';
    END IF;

    -- Poner tenant en pending_approval (idempotente)
    UPDATE public.tenants
    SET estado = 'pending_approval', updated_at = NOW()
    WHERE id = p_tenant_id AND estado IN ('pending_payment');

    -- Registrar evento
    INSERT INTO public.subscription_events (tenant_id, tipo, metadata)
    SELECT p_tenant_id, 'pending_approval',
           jsonb_build_object('payment_id', p_payment_id, 'fecha', CURRENT_DATE)
    FROM public.tenants WHERE id = p_tenant_id AND estado = 'pending_approval';
END;
$function$;

-- 6.4 process_plan_change: sin wompi_transaction_id
CREATE OR REPLACE FUNCTION public.process_plan_change(p_tenant_id uuid, p_payment_id uuid, p_new_plan_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
  UPDATE public.subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;

  IF p_payment_id != '00000000-0000-0000-0000-000000000000' THEN
    UPDATE public.payments SET status = 'approved', updated_at = NOW()
    WHERE id = p_payment_id AND status != 'approved';
  END IF;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object(
    'new_plan_id', p_new_plan_id,
    'payment_id', p_payment_id
  )
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$function$;

-- 6.5 process_renewal: sin wompi_transaction_id
CREATE OR REPLACE FUNCTION public.process_renewal(p_tenant_id uuid, p_payment_id uuid)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
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
$function$;

-- 6.6 process_webhook_approval: sin wompi_transaction_id
CREATE OR REPLACE FUNCTION public.process_webhook_approval(p_payment_id uuid, p_tenant_id uuid, p_payment_source_id text DEFAULT ''::text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
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

    -- Crear sucursal principal del tenant
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
$function$;

-- 6.7 create_tenant_product: sin tarifas
CREATE OR REPLACE FUNCTION public.create_tenant_product(
    p_tenant_id uuid,
    p_sucursal_id uuid,
    p_codigo_barras text,
    p_descripcion text,
    p_precio_venta numeric,
    p_costo numeric,
    p_stock_inicial numeric,
    p_stock_minimo numeric,
    p_categoria_id uuid DEFAULT NULL::uuid
)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
DECLARE
    v_producto_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.branch_accounts
        WHERE tenant_id = p_tenant_id AND sucursal_id = p_sucursal_id AND activo = true
    ) THEN
        RAISE EXCEPTION 'Sucursal no pertenece al tenant';
    END IF;

    INSERT INTO public.productos (sucursal_id, codigo_barras, descripcion, precio_venta, costo, stock_minimo, categoria_id, activo)
    VALUES (p_sucursal_id, p_codigo_barras, p_descripcion, p_precio_venta, p_costo, p_stock_minimo, p_categoria_id, true)
    RETURNING id INTO v_producto_id;

    INSERT INTO public.inventario_sucursal (sucursal_id, producto_id, stock_actual, version, last_updated)
    VALUES (p_sucursal_id, v_producto_id, p_stock_inicial, 1, NOW())
    ON CONFLICT (sucursal_id, producto_id) DO NOTHING;

    RETURN v_producto_id;
END;
$function$;

-- 6.8 update_tenant_product: sin tarifas
CREATE OR REPLACE FUNCTION public.update_tenant_product(
    p_tenant_id uuid,
    p_producto_id uuid,
    p_codigo_barras text DEFAULT NULL::text,
    p_descripcion text DEFAULT NULL::text,
    p_precio_venta numeric DEFAULT NULL::numeric,
    p_costo numeric DEFAULT NULL::numeric,
    p_stock_minimo numeric DEFAULT NULL::numeric,
    p_categoria_id uuid DEFAULT NULL::uuid,
    p_activo boolean DEFAULT NULL::boolean
)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.productos p
        JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
        WHERE p.id = p_producto_id AND ba.tenant_id = p_tenant_id AND ba.activo = true
    ) THEN
        RAISE EXCEPTION 'Producto no pertenece al tenant';
    END IF;

    UPDATE public.productos SET
        codigo_barras = COALESCE(p_codigo_barras, codigo_barras),
        descripcion = COALESCE(p_descripcion, descripcion),
        precio_venta = COALESCE(p_precio_venta, precio_venta),
        costo = COALESCE(p_costo, costo),
        stock_minimo = COALESCE(p_stock_minimo, stock_minimo),
        categoria_id = COALESCE(p_categoria_id, categoria_id),
        activo = COALESCE(p_activo, activo)
    WHERE id = p_producto_id;
END;
$function$;

-- 6.9 get_tenant_products: sin tarifas
CREATE OR REPLACE FUNCTION public.get_tenant_products(p_tenant_id uuid, p_sucursal_id uuid DEFAULT NULL::uuid)
    RETURNS TABLE(id uuid, codigo_barras text, descripcion text, precio_venta numeric, costo numeric, activo boolean, stock_minimo numeric, requiere_peso boolean, sucursal_id uuid, categoria_id uuid, stock_actual numeric, categoria_nombre text, sucursal_nombre text)
    LANGUAGE sql
    STABLE SECURITY DEFINER
    SET search_path TO ''
AS $function$
    SELECT
        p.id, p.codigo_barras, p.descripcion, p.precio_venta,
        p.costo, p.activo, p.stock_minimo,
        p.requiere_peso,
        p.sucursal_id, p.categoria_id,
        COALESCE(ins.stock_actual, 0) AS stock_actual,
        c.nombre AS categoria_nombre,
        s.nombre AS sucursal_nombre
    FROM public.productos p
    JOIN public.sucursales s ON s.id = p.sucursal_id
    JOIN public.branch_accounts ba ON ba.sucursal_id = p.sucursal_id
        AND ba.tenant_id = p_tenant_id AND ba.activo = true
    LEFT JOIN public.categorias c ON c.id = p.categoria_id
    LEFT JOIN public.inventario_sucursal ins ON ins.sucursal_id = p.sucursal_id AND ins.producto_id = p.id
    WHERE (p_sucursal_id IS NULL OR p.sucursal_id = p_sucursal_id)
    ORDER BY p.descripcion;
$function$;

-- 6.10 finalizar_venta: sin impuestos ni tarifas
CREATE OR REPLACE FUNCTION public.finalizar_venta(
    p_sucursal_id uuid,
    p_cajero_id uuid,
    p_productos jsonb,
    p_subtotal numeric,
    p_total numeric,
    p_metodo_pago text DEFAULT 'EFECTIVO'::text,
    p_monto_recibido numeric DEFAULT 0,
    p_cambio_entregado numeric DEFAULT 0,
    p_cliente_nombre text DEFAULT NULL::text,
    p_cliente_id uuid DEFAULT NULL::uuid,
    p_observacion text DEFAULT NULL::text
)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO ''
AS $function$
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
    -- Ticket number secuencial por sucursal
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_ticket_number
    FROM public.ventas
    WHERE sucursal_id = p_sucursal_id;

    -- Crear venta (cabecera)
    INSERT INTO public.ventas (id, sucursal_id, cajero_id, subtotal, total, metodo_pago, monto_recibido, cambio_entregado, ticket_number, fecha_hora, created_at)
    VALUES (gen_random_uuid(), p_sucursal_id, p_cajero_id, p_subtotal, p_total, p_metodo_pago, p_monto_recibido, p_cambio_entregado, v_ticket_number, NOW(), NOW())
    RETURNING id INTO v_venta_id;

    -- Procesar cada producto
    FOR v_producto IN SELECT * FROM jsonb_array_elements(p_productos)
    LOOP
        v_producto_id := (v_producto->>'id')::UUID;
        v_cantidad := (v_producto->>'cantidad')::DECIMAL(12,3);
        v_precio := (v_producto->>'precio')::DECIMAL(12,2);

        IF v_cantidad <= 0 THEN
            RAISE EXCEPTION 'Cantidad invalida para producto %', v_producto_id;
        END IF;

        -- Obtener costo del producto
        SELECT costo INTO v_costo
        FROM public.productos
        WHERE id = v_producto_id AND sucursal_id = p_sucursal_id;

        IF v_costo IS NULL THEN
            RAISE EXCEPTION 'Producto % no pertenece a sucursal %', v_producto_id, p_sucursal_id;
        END IF;

        -- Bloquear fila de inventario + leer version
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

        -- UPDATE con version check (control de concurrencia)
        UPDATE public.inventario_sucursal
        SET stock_actual = v_new_stock,
            version = v_current_version + 1,
            last_updated = NOW()
        WHERE sucursal_id = p_sucursal_id
          AND producto_id = v_producto_id
          AND version = v_current_version;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Colision de concurrencia en producto % (version %)', v_producto_id, v_current_version;
        END IF;

        -- Insertar detalle de venta (sin tarifas de impuesto)
        INSERT INTO public.venta_detalles (id, venta_id, producto_id, cantidad_o_peso, precio_unitario, subtotal, costo_aplicado)
        VALUES (gen_random_uuid(), v_venta_id, v_producto_id, v_cantidad, v_precio, v_cantidad * v_precio, v_costo);

        -- Registrar movimiento de inventario
        INSERT INTO public.movimientos_inventario (id, sucursal_id, producto_id, tipo, cantidad, stock_resultante, referencia_id, referencia_tipo, usuario_id, created_at)
        VALUES (gen_random_uuid(), p_sucursal_id, v_producto_id, 'venta', -v_cantidad, v_new_stock, v_venta_id, 'venta', p_cajero_id, NOW());
    END LOOP;

    RETURN v_venta_id;
END;
$function$;

-- 6.11 next_ticket_number: sin impuestos (fix: sin placeholder por uuid cero que
--      violaba FK; usa MAX+1 como finalizar_venta)
CREATE OR REPLACE FUNCTION public.next_ticket_number(p_sucursal_id uuid)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
AS $function$
DECLARE
    v_next BIGINT;
BEGIN
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO v_next
    FROM public.ventas
    WHERE sucursal_id = p_sucursal_id;
    RETURN v_next;
END;
$function$;


-- 7) GRANTS (mantener acceso de authenticated en RPCs generadas)
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.generar_factura_desde_pago TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_numero_factura TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_ticket_number TO authenticated;