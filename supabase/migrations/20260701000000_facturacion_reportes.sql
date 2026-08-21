-- ============================================================================
-- VenxPOS SaaS — Facturación, Reportes, Exportaciones, Auditoría
-- Una sola migración: tablas + RPCs + Storage + RLS + trigger
-- ============================================================================

-- 1. INVOICE COUNTER (numeración secuencial atómica por año)
CREATE TABLE IF NOT EXISTS public.invoice_counter (
    anio integer NOT NULL PRIMARY KEY,
    ultimo_numero integer NOT NULL DEFAULT 0
);

INSERT INTO public.invoice_counter (anio, ultimo_numero)
SELECT 2026, 0
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_counter WHERE anio = 2026);

-- 2. FACTURAS SAAS
CREATE TABLE IF NOT EXISTS public.facturas_saas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    gateway_transaction_id text,
    numero_factura text NOT NULL UNIQUE,
    concepto text NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    iva numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    moneda text DEFAULT 'COP',
    pdf_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_tenant_id ON public.facturas_saas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_payment_id ON public.facturas_saas(payment_id);
CREATE INDEX IF NOT EXISTS idx_facturas_created_at ON public.facturas_saas(created_at);
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON public.facturas_saas(numero_factura);

-- 3. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    accion text NOT NULL,
    entidad text NOT NULL,
    entidad_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_accion ON public.audit_logs(accion);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 4. RLS — facturas_saas
ALTER TABLE public.facturas_saas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_facturas" ON public.facturas_saas
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "insert_facturas_superadmin" ON public.facturas_saas
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "update_facturas_superadmin" ON public.facturas_saas
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- 5. RLS — audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_audit" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "insert_audit_service" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- 6. RLS — invoice_counter (solo superadmin puede leer/escribir)
ALTER TABLE public.invoice_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_counter" ON public.invoice_counter
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "update_counter" ON public.invoice_counter
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

-- 7. TRIGGER updated_at
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

DROP TRIGGER IF EXISTS trg_facturas_updated_at ON public.facturas_saas;
CREATE TRIGGER trg_facturas_updated_at
    BEFORE UPDATE ON public.facturas_saas
    FOR EACH ROW
    EXECUTE FUNCTION update_facturas_updated_at();

-- 8. RPC: generar_numero_factura (secuencial atómico)
CREATE OR REPLACE FUNCTION generar_numero_factura(p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_numero integer;
    v_result text;
BEGIN
    INSERT INTO public.invoice_counter (anio, ultimo_numero)
    VALUES (p_anio, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo_numero = public.invoice_counter.ultimo_numero + 1
    RETURNING public.invoice_counter.ultimo_numero INTO v_numero;

    v_result := 'VENX-' || p_anio::text || '-' || LPAD(v_numero::text, 6, '0');
    RETURN v_result;
END;
$$;

-- 9. RPC: generar_factura_desde_pago (crea factura + contador + genera evento)
CREATE OR REPLACE FUNCTION generar_factura_desde_pago(p_payment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_payment record;
    v_tenant record;
    v_plan record;
    v_sub record;
    v_numero text;
    v_concepto text;
    v_iva_rate numeric := 0.19;
    v_subtotal numeric;
    v_iva numeric;
    v_factura_id uuid;
BEGIN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pago no encontrado';
    END IF;

    SELECT * INTO v_tenant FROM public.tenants WHERE id = v_payment.tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant no encontrado';
    END IF;

    SELECT * INTO v_plan FROM public.plans WHERE id = v_tenant.plan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan no encontrado';
    END IF;

    v_concepto := CASE v_payment.tipo
        WHEN 'initial' THEN 'Instalación inicial + primer mes - Plan ' || v_plan.nombre
        WHEN 'recurring' THEN 'Renovación mensual - Plan ' || v_plan.nombre
        WHEN 'plan_change' THEN 'Cambio de plan - ' || COALESCE(v_payment.metadata->>'old_plan_nombre', 'Anterior') || ' -> ' || v_plan.nombre
        WHEN 'manual' THEN 'Pago manual - Plan ' || v_plan.nombre
        WHEN 'retry' THEN 'Reintento de pago - Plan ' || v_plan.nombre
        ELSE 'Pago ' || v_payment.tipo || ' - Plan ' || v_plan.nombre
    END;

    v_subtotal := ROUND(v_payment.amount / (1 + v_iva_rate), 2);
    v_iva := v_payment.amount - v_subtotal;

    v_numero := generar_numero_factura(EXTRACT(YEAR FROM NOW())::integer);

    INSERT INTO public.facturas_saas (
        tenant_id, payment_id, gateway_transaction_id, numero_factura,
        concepto, subtotal, iva, total, moneda
    ) VALUES (
        v_payment.tenant_id, v_payment.id, v_payment.gateway_transaction_id, v_numero,
        v_concepto, v_subtotal, v_iva, v_payment.amount, v_payment.currency
    ) RETURNING id INTO v_factura_id;

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT COALESCE(v_payment.subscription_id, (SELECT id FROM public.subscriptions WHERE tenant_id = v_payment.tenant_id ORDER BY created_at DESC LIMIT 1)),
           v_payment.tenant_id,
           CASE WHEN v_payment.tipo = 'initial' THEN 'activated' ELSE 'renewed' END,
           jsonb_build_object('factura_id', v_factura_id, 'numero_factura', v_numero, 'payment_id', v_payment.id);

    RETURN v_factura_id;
END;
$$;

-- 10. RPC: log_audit
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

-- 11. RPC: get_mrr
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
         WHERE s.estado = 'active'),
        0
    );
END;
$$;

-- 12. RPC: get_arr
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

-- 13. RPC: get_facturacion_mensual
CREATE OR REPLACE FUNCTION get_facturacion_mensual(p_mes integer DEFAULT EXTRACT(MONTH FROM NOW())::integer, p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
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

-- 14. RPC: get_facturacion_anual
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
           COALESCE(SUM(f.total), 0) AS total,
           COUNT(*)::bigint AS cantidad
    FROM public.facturas_saas f
    WHERE EXTRACT(YEAR FROM f.created_at) = p_anio
    GROUP BY mes
    ORDER BY mes;
END;
$$;

-- 15. RPC: get_pagos_pendientes
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
    WHERE s.estado = 'active'
      AND s.proximo_cobro < CURRENT_DATE
    ORDER BY s.proximo_cobro ASC;
END;
$$;

-- 16. RPC: get_ventas_periodo (dashboard ejecutivo)
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
    WHERE ba.tenant_id = p_tenant_id
      AND ba.sucursal_id IS NOT NULL
      AND (p_sucursal_id IS NULL OR ba.sucursal_id = p_sucursal_id);

    IF v_sucursales IS NULL OR array_length(v_sucursales, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT COALESCE(SUM(v.total), 0),
           COUNT(*)::bigint,
           CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.total), 0) / COUNT(*) ELSE 0 END,
           COALESCE(SUM(v.subtotal - COALESCE(vd.costo, 0)), 0)
    FROM public.ventas v
    LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(vd2.costo_aplicado, 0)) AS costo
        FROM public.venta_detalles vd2
        WHERE vd2.venta_id = v.id
    ) vd ON true
    WHERE v.sucursal_id = ANY(v_sucursales)
      AND (p_desde IS NULL OR v.fecha_hora >= p_desde)
      AND (p_hasta IS NULL OR v.fecha_hora <= p_hasta);
END;
$$;

-- 17. Función para contar facturas de un tenant
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
