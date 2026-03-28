
-- Function to generate a unique 4-digit registration code for an organization
CREATE OR REPLACE FUNCTION public.generate_registration_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  LOOP
    -- Generate random 4-digit code (1000-9999)
    new_code := lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.organization_registration_codes WHERE code = new_code) THEN
      INSERT INTO public.organization_registration_codes (organization_id, code, is_active)
      VALUES (NEW.id, new_code, true);
      EXIT;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique registration code after 100 attempts';
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate code when organization is created
CREATE TRIGGER on_organization_created_generate_code
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_registration_code();

-- Generate codes for existing organizations that don't have one
DO $$
DECLARE
  org RECORD;
  new_code text;
  attempts int;
BEGIN
  FOR org IN 
    SELECT id FROM public.organizations 
    WHERE id NOT IN (SELECT organization_id FROM public.organization_registration_codes)
  LOOP
    attempts := 0;
    LOOP
      new_code := lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');
      IF NOT EXISTS (SELECT 1 FROM public.organization_registration_codes WHERE code = new_code) THEN
        INSERT INTO public.organization_registration_codes (organization_id, code, is_active)
        VALUES (org.id, new_code, true);
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 100 THEN EXIT; END IF;
    END LOOP;
  END LOOP;
END;
$$;
