-- =============================================================================
-- Migration: Plan change with prorated payment
-- =============================================================================
-- 1. Add 'plan_change' to payments.tipo CHECK
-- 2. RPC process_plan_change: actualiza plan cuando el pago se aprueba
-- =============================================================================

-- 1. Alter CHECK constraint to allow 'plan_change'
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tipo_check;
ALTER TABLE payments ADD CONSTRAINT payments_tipo_check
  CHECK (tipo = ANY (ARRAY['initial'::text, 'recurring'::text, 'manual'::text, 'retry'::text, 'plan_change'::text]));

-- 2. RPC: process_plan_change
CREATE OR REPLACE FUNCTION process_plan_change(
  p_tenant_id UUID,
  p_payment_id UUID,
  p_new_plan_id UUID,
  p_gateway_transaction_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_subscription_id UUID;
  v_plan_nombre TEXT;
BEGIN
  -- Mark payment as approved
  UPDATE payments
  SET status = 'approved',
      gateway_transaction_id = p_gateway_transaction_id,
      updated_at = NOW()
  WHERE id = p_payment_id AND status != 'approved';

  -- Update tenant plan
  UPDATE tenants
  SET plan_id = p_new_plan_id,
      updated_at = NOW()
  WHERE id = p_tenant_id;

  -- Update subscription plan (keep proximo_cobro / dates unchanged)
  UPDATE subscriptions
  SET plan_id = p_new_plan_id,
      estado = 'active',
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
  RETURNING id INTO v_subscription_id;

  -- Get plan name for event metadata
  SELECT nombre INTO v_plan_nombre FROM plans WHERE id = p_new_plan_id;

  -- Record event
  INSERT INTO subscription_events (subscription_id, tenant_id, tipo, metadata)
  VALUES (v_subscription_id, p_tenant_id, 'plan_changed', jsonb_build_object(
    'payment_id', p_payment_id,
    'new_plan_id', p_new_plan_id,
    'new_plan_nombre', v_plan_nombre,
    'gateway_transaction_id', p_gateway_transaction_id
  ));
END;
$$;
