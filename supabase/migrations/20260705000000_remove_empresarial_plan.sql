-- Remove Empresarial plan (sucursales ilimitadas, contacto comercial)
-- Official plans: Basico (2), Estandar (5), Pro (10)

DO $$
DECLARE
    v_empresarial_id UUID;
    v_tenant_count INTEGER;
BEGIN
    SELECT id INTO v_empresarial_id FROM plans WHERE nombre = 'Empresarial';

    IF v_empresarial_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_tenant_count
        FROM tenants
        WHERE plan_id = v_empresarial_id AND estado IN ('active', 'pending_payment');

        IF v_tenant_count = 0 THEN
            UPDATE tenants SET plan_id = (SELECT id FROM plans WHERE nombre = 'Pro' LIMIT 1)
            WHERE plan_id = v_empresarial_id;

            UPDATE subscriptions SET plan_id = (SELECT id FROM plans WHERE nombre = 'Pro' LIMIT 1)
            WHERE plan_id = v_empresarial_id AND estado IN ('active', 'past_due', 'pending');

            DELETE FROM plans WHERE nombre = 'Empresarial';
            RAISE NOTICE 'Plan Empresarial eliminado exitosamente';
        ELSE
            RAISE EXCEPTION 'No se puede eliminar: % tenants activos usan el plan Empresarial', v_tenant_count;
        END IF;
    ELSE
        RAISE NOTICE 'Plan Empresarial no existe, saltando';
    END IF;
END $$;
