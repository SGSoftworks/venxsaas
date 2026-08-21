-- Recreate invoice functions with explicit permissions
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
    v_subtotal numeric;
    v_iva numeric;
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

    v_subtotal := ROUND(v_payment.amount / 1.19, 2);
    v_iva := v_payment.amount - v_subtotal;
    v_numero := public.generar_numero_factura(EXTRACT(YEAR FROM NOW())::integer);

    INSERT INTO public.facturas_saas (tenant_id, payment_id, gateway_transaction_id, numero_factura, concepto, subtotal, iva, total, moneda, estado)
    VALUES (v_payment.tenant_id, v_payment.id, v_payment.gateway_transaction_id, v_numero, v_concepto, v_subtotal, v_iva, v_payment.amount, v_payment.currency, 'emitida')
    RETURNING id INTO v_factura_id;

    RETURN v_factura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_numero_factura TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_factura_desde_pago TO authenticated;
