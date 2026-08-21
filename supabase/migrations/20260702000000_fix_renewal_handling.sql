-- ============================================================================
-- VenxPOS SaaS — Fix renewal handling: past_due, suspension, expiry
-- ============================================================================

-- Mark subscription as past_due and suspend tenant when renewal payment fails
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
  UPDATE public.subscriptions
  SET estado = 'past_due', updated_at = NOW()
  WHERE tenant_id = p_tenant_id AND estado = 'active';

  UPDATE public.tenants
  SET estado = 'suspended', updated_at = NOW()
  WHERE id = p_tenant_id AND estado = 'active';

  IF p_payment_id IS NOT NULL THEN
    UPDATE public.payments
    SET status = 'declined', updated_at = NOW()
    WHERE id = p_payment_id AND status = 'pending';
  END IF;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'past_due',
    jsonb_build_object('payment_id', p_payment_id, 'reason', 'Renovación rechazada')
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- Mark expired past_due subscriptions as expired and cancel tenant permanently
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

-- Re-create process_renewal with search_path set (same 3-param signature as previous migration)
CREATE OR REPLACE FUNCTION process_renewal(
  p_tenant_id UUID,
  p_payment_id UUID,
  p_gateway_transaction_id TEXT
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

  UPDATE public.subscriptions SET
    estado = 'active',
    fecha_renovacion = CURRENT_DATE,
    proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'renewed',
    jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_gateway_transaction_id)
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- RPC: reactivate a suspended/past_due subscription manually
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
  UPDATE public.payments
  SET status = 'approved', updated_at = NOW()
  WHERE id = p_payment_id AND status IN ('pending', 'declined');

  UPDATE public.subscriptions
  SET estado = 'active', updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  UPDATE public.tenants
  SET estado = 'active', updated_at = NOW()
  WHERE id = p_tenant_id;
END;
$$;
