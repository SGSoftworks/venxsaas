-- Fix process_renewal: reactivate tenant + advance billing + generate invoice
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_gateway_transaction_id TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.payments
    SET status = 'approved',
        gateway_transaction_id = p_gateway_transaction_id,
        updated_at = NOW()
    WHERE id = p_payment_id
      AND status != 'approved';

    UPDATE public.subscriptions
    SET estado = 'active',
        fecha_renovacion = CURRENT_DATE,
        proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND estado IN ('active', 'past_due');

    UPDATE public.tenants
    SET estado = 'active',
        updated_at = NOW()
    WHERE id = p_tenant_id
      AND estado IN ('suspended', 'active');

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'renewed',
           jsonb_build_object(
               'payment_id', p_payment_id,
               'gateway_transaction_id', p_gateway_transaction_id,
               'fecha', CURRENT_DATE
           )
    FROM public.subscriptions
    WHERE tenant_id = p_tenant_id
      AND estado = 'active';

    PERFORM public.generar_factura_desde_pago(p_payment_id);
END;
$$;
