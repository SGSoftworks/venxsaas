-- Recreate cancel_subscription with explicit schema and permissions
CREATE OR REPLACE FUNCTION public.cancel_subscription(p_tenant_id UUID)
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

GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(UUID) TO service_role;
