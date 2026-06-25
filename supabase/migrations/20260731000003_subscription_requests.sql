-- Subscription requests for renewals and plan changes
CREATE TABLE IF NOT EXISTS public.subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('RENOVACION', 'CAMBIO_PLAN')),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
    plan_actual_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    plan_nuevo_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    solicitud_data JSONB DEFAULT '{}'::jsonb,
    aprobado_por UUID REFERENCES public.superadmins(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_req_tenant ON public.subscription_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sub_req_estado ON public.subscription_requests(estado);
CREATE INDEX IF NOT EXISTS idx_sub_req_tipo ON public.subscription_requests(tipo);
CREATE INDEX IF NOT EXISTS idx_sub_req_created ON public.subscription_requests(created_at);

ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_requests" ON public.subscription_requests
    FOR SELECT TO authenticated
    USING (
        tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "insert_own_requests" ON public.subscription_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid())
    );

CREATE POLICY "update_requests_superadmin" ON public.subscription_requests
    FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.superadmins WHERE user_id = auth.uid()));

-- RPC: approve_renewal — updates subscription dates
CREATE OR REPLACE FUNCTION public.approve_renewal(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_req record;
    v_sub_id UUID;
BEGIN
    SELECT * INTO v_req FROM public.subscription_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
    IF v_req.tipo != 'RENOVACION' THEN RAISE EXCEPTION 'La solicitud no es de tipo renovacion'; END IF;
    IF v_req.estado != 'pendiente' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;

    UPDATE public.subscriptions
    SET estado = 'active',
        fecha_renovacion = CURRENT_DATE,
        proximo_cobro = CURRENT_DATE + INTERVAL '30 days',
        updated_at = NOW()
    WHERE tenant_id = v_req.tenant_id;

    UPDATE public.tenants
    SET estado = 'active',
        updated_at = NOW()
    WHERE id = v_req.tenant_id;

    INSERT INTO public.subscription_events (subscription_id, tenant_id, tipo, metadata)
    SELECT id, v_req.tenant_id, 'renewed', jsonb_build_object(
        'request_id', p_request_id,
        'approved_at', NOW()
    )
    FROM public.subscriptions WHERE tenant_id = v_req.tenant_id;

    UPDATE public.subscription_requests
    SET estado = 'aprobada',
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
END;
$$;

-- RPC: approve_plan_change — updates tenant plan + subscription
CREATE OR REPLACE FUNCTION public.approve_plan_change(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_req record;
BEGIN
    SELECT * INTO v_req FROM public.subscription_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
    IF v_req.tipo != 'CAMBIO_PLAN' THEN RAISE EXCEPTION 'La solicitud no es de tipo cambio de plan'; END IF;
    IF v_req.estado != 'pendiente' THEN RAISE EXCEPTION 'La solicitud ya fue procesada'; END IF;
    IF v_req.plan_nuevo_id IS NULL THEN RAISE EXCEPTION 'No se especifico un plan nuevo'; END IF;

    PERFORM public.change_subscription_plan(v_req.tenant_id, v_req.plan_nuevo_id);

    UPDATE public.subscription_requests
    SET estado = 'aprobada',
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_renewal TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_plan_change TO authenticated;
