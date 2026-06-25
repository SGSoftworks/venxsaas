-- Clean stale pending_signups AND drop unused RPCs
DELETE FROM public.pending_signups WHERE estado IN ('draft', 'pending_payment');
DROP FUNCTION IF EXISTS hash_password;
DROP FUNCTION IF EXISTS verify_password;
DROP FUNCTION IF EXISTS clean_expired_signups;
