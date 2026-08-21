-- Renombrar columnas heredadas de Wompi al esquema canonico gateway_*
-- El frontend y todas las migraciones previas usan gateway_transaction_id / gateway_reference

ALTER TABLE public.payments RENAME COLUMN wompi_transaction_id TO gateway_transaction_id;
ALTER TABLE public.payments RENAME COLUMN wompi_reference TO gateway_reference;

ALTER TABLE public.facturas_saas RENAME COLUMN wompi_transaction_id TO gateway_transaction_id;

ALTER TABLE public.payment_proofs RENAME COLUMN wompi_reference TO gateway_reference;

ALTER TABLE public.payments
  RENAME CONSTRAINT payments_wompi_reference_key TO payments_gateway_reference_key;

DROP INDEX IF EXISTS public.idx_payments_wompi_transaction_id;
CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id ON public.payments(gateway_transaction_id);
