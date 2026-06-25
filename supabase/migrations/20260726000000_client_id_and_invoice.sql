-- ============================================================
-- CLIENT_ID: Sequential numeric ID for tenants (10 digits)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_counter (
    id SERIAL PRIMARY KEY
);

-- Seed counter starting at 1
INSERT INTO public.client_counter DEFAULT VALUES;

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS client_id TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.client_id IS NULL THEN
        NEW.client_id := LPAD(nextval('public.client_counter_id_seq')::TEXT, 10, '0');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_id ON public.tenants;
CREATE TRIGGER trg_client_id
    BEFORE INSERT ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.generate_client_id();

-- Backfill existing tenants with sequential IDs
UPDATE public.tenants t
SET client_id = LPAD(r.rn::TEXT, 10, '0')
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.tenants
    WHERE client_id IS NULL
) r
WHERE t.id = r.id;

-- ============================================================
-- Invoice format: VENX-XXXXXX (remove year from number)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generar_numero_factura(p_anio integer DEFAULT EXTRACT(YEAR FROM NOW())::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_numero integer;
BEGIN
    INSERT INTO public.invoice_counter (anio, ultimo_numero)
    VALUES (p_anio, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo_numero = public.invoice_counter.ultimo_numero + 1
    RETURNING public.invoice_counter.ultimo_numero INTO v_numero;

    RETURN 'VENX-' || LPAD(v_numero::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generar_numero_factura TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_factura_desde_pago TO authenticated;
