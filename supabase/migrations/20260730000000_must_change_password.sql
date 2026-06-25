ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Set existing tenants with temp_password to must_change_password
UPDATE public.tenants SET must_change_password = true WHERE temp_password IS NOT NULL AND must_change_password = false;
