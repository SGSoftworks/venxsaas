-- ============================================================================
-- VenxPOS SaaS — Fix RPC Security: ownership checks + search_path
-- ============================================================================

-- Helper: check if current user owns a tenant or is superadmin
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

-- Fix cancel_subscription with ownership check + search_path
CREATE OR REPLACE FUNCTION cancel_subscription(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT is_tenant_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.tenants SET estado = 'cancelled', updated_at = NOW() WHERE id = p_tenant_id;
  UPDATE public.subscriptions SET estado = 'cancelled', updated_at = NOW() WHERE tenant_id = p_tenant_id;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'cancelled', '{}'::jsonb
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- Fix activate_tenant with search_path
CREATE OR REPLACE FUNCTION activate_tenant(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT,
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
    wompi_transaction_id = p_wompi_transaction_id,
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
        jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_wompi_transaction_id)
    );
  END IF;
END;
$$;

-- Fix process_webhook_approval with search_path
CREATE OR REPLACE FUNCTION process_webhook_approval(
    p_payment_id UUID,
    p_tenant_id UUID,
    p_transaction_id TEXT,
    p_payment_source_id TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND estado = 'active') THEN
    RETURN;
  END IF;

  UPDATE public.payments
  SET status = 'approved',
      wompi_transaction_id = p_transaction_id,
      updated_at = NOW()
  WHERE id = p_payment_id AND status != 'approved';

  UPDATE public.tenants
  SET estado = 'active', updated_at = NOW()
  WHERE id = p_tenant_id
  RETURNING plan_id INTO v_plan_id;

  INSERT INTO public.empresas (nombre, plan, estado, tenant_id)
  SELECT nombre_negocio, 'basico', 'activo', id
  FROM public.tenants WHERE id = p_tenant_id
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO public.subscriptions (tenant_id, plan_id, estado, fecha_inicio, fecha_renovacion, proximo_cobro, payment_source_id)
  SELECT t.id, t.plan_id, 'active', CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 30, p_payment_source_id
  FROM public.tenants t WHERE t.id = p_tenant_id
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE tenant_id = p_tenant_id AND estado = 'active');

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT s.id, p_tenant_id, 'activated', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_transaction_id)
  FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id AND s.estado = 'active';
END;
$$;

-- Fix change_subscription_plan with search_path
CREATE OR REPLACE FUNCTION change_subscription_plan(
    p_tenant_id UUID,
    p_new_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
  UPDATE public.subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object('new_plan_id', p_new_plan_id)
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- Fix process_renewal with search_path
CREATE OR REPLACE FUNCTION process_renewal(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_wompi_transaction_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.payments SET status = 'approved', updated_at = NOW()
  WHERE id = p_payment_id AND status != 'approved';

  UPDATE public.subscriptions SET
    estado = 'active',
    fecha_renovacion = CURRENT_DATE,
    proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
  SELECT id, p_tenant_id, 'renewed', jsonb_build_object('payment_id', p_payment_id, 'transaction_id', p_wompi_transaction_id)
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

-- Fix process_plan_change with search_path
CREATE OR REPLACE FUNCTION process_plan_change(
    p_tenant_id UUID,
    p_payment_id UUID,
    p_new_plan_id UUID,
    p_wompi_transaction_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
    'payment_id', p_payment_id,
    'transaction_id', p_wompi_transaction_id
  )
  FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;
