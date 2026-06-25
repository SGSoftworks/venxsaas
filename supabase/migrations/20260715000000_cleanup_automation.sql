-- Cleanup: remove unused columns from pending_signups and subscriptions
-- Columns removed store data no longer needed after migration to new flow

-- Drop index that references payment_reference before dropping the column
DROP INDEX IF EXISTS public.idx_pending_signups_payment_ref;

-- Remove unused columns from pending_signups
ALTER TABLE public.pending_signups DROP COLUMN IF EXISTS wompi_payment_link_id;
ALTER TABLE public.pending_signups DROP COLUMN IF EXISTS payment_reference;

-- Remove unused column from subscriptions
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS payment_source_id;
