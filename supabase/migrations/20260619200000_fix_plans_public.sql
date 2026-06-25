-- Fix: Allow anonymous users to read plans (needed for landing page + registration)
-- The original policy only allowed authenticated users, which blocks
-- public visitors from seeing available plans.

DROP POLICY IF EXISTS "select_plans_auth" ON plans;

CREATE POLICY "select_plans_public" ON plans
    FOR SELECT
    USING (true);

-- Also ensure anon key has access via Supabase API settings
