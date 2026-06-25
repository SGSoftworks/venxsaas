-- Clean stale pending_signups from failed attempts
DELETE FROM public.pending_signups WHERE estado IN ('draft', 'pending_payment');
