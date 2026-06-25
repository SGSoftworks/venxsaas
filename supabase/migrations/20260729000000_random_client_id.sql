-- Change CLIENT_ID generation from sequential to random 10-digit
CREATE OR REPLACE FUNCTION public.generate_client_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_id TEXT;
    v_exists BOOLEAN;
BEGIN
    IF NEW.client_id IS NULL THEN
        LOOP
            v_id := LPAD(FLOOR(RANDOM() * 9999999999)::BIGINT::TEXT, 10, '0');
            SELECT EXISTS(SELECT 1 FROM public.tenants WHERE client_id = v_id) INTO v_exists;
            EXIT WHEN NOT v_exists;
        END LOOP;
        NEW.client_id := v_id;
    END IF;
    RETURN NEW;
END;
$$;
