-- Improve change_subscription_plan with better metadata and plan name tracking
CREATE OR REPLACE FUNCTION public.change_subscription_plan(
    p_tenant_id UUID,
    p_new_plan_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_old_plan_id UUID;
    v_old_plan_name TEXT;
    v_new_plan_name TEXT;
BEGIN
    SELECT plan_id INTO v_old_plan_id FROM public.tenants WHERE id = p_tenant_id;
    SELECT nombre INTO v_old_plan_name FROM public.plans WHERE id = v_old_plan_id;
    SELECT nombre INTO v_new_plan_name FROM public.plans WHERE id = p_new_plan_id;

    UPDATE public.tenants SET plan_id = p_new_plan_id, updated_at = NOW() WHERE id = p_tenant_id;
    UPDATE public.subscriptions SET plan_id = p_new_plan_id, updated_at = NOW() WHERE tenant_id = p_tenant_id;

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, p_tenant_id, 'plan_changed', jsonb_build_object(
        'new_plan_id', p_new_plan_id,
        'old_plan_id', v_old_plan_id,
        'old_plan_name', v_old_plan_name,
        'new_plan_name', v_new_plan_name,
        'changed_by', 'gerencia',
        'changed_at', NOW()
    )
    FROM public.subscriptions WHERE tenant_id = p_tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_subscription_plan(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_subscription_plan(UUID, UUID) TO service_role;
