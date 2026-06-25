-- Pending signups table: temporary storage before payment completion
CREATE TABLE IF NOT EXISTS public.pending_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_negocio TEXT NOT NULL,
    nit TEXT,
    telefono TEXT NOT NULL,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    estado TEXT NOT NULL DEFAULT 'draft'
        CHECK (estado IN ('draft', 'pending_payment', 'approved', 'expired', 'cancelled')),
    payment_reference TEXT,
    transaction_id TEXT,
    wompi_payment_link_id TEXT,
    amount_in_cents INTEGER,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_signups_reference ON public.pending_signups(reference);
CREATE INDEX idx_pending_signups_email ON public.pending_signups(email);
CREATE INDEX idx_pending_signups_estado ON public.pending_signups(estado);
CREATE INDEX idx_pending_signups_payment_ref ON public.pending_signups(payment_reference);
