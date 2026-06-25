-- Add estado column to facturas_saas for invoice lifecycle tracking
-- Add UNIQUE constraint on payment_id to prevent duplicate invoices

ALTER TABLE public.facturas_saas
ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'emitida';

COMMENT ON COLUMN public.facturas_saas.estado IS 'Factura: emitida, pagada, anulada, reembolsada';

-- Prevent duplicate invoices per payment
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_facturas_payment_id'
          AND conrelid = 'public.facturas_saas'::regclass
    ) THEN
        ALTER TABLE public.facturas_saas
        ADD CONSTRAINT uq_facturas_payment_id UNIQUE (payment_id);
    END IF;
END $$;
