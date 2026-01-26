-- Create function to notify on new fault cases
CREATE OR REPLACE FUNCTION public.notify_new_fault_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get secrets from vault
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-fault-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'fault_case_id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'priority', NEW.priority,
      'vessel_id', NEW.vessel_id,
      'created_by', NEW.created_by
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new fault cases
DROP TRIGGER IF EXISTS trigger_notify_new_fault_case ON public.fault_cases;
CREATE TRIGGER trigger_notify_new_fault_case
  AFTER INSERT ON public.fault_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_fault_case();

-- Create function to notify on new deviations
CREATE OR REPLACE FUNCTION public.notify_new_deviation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get secrets from vault
  SELECT decrypted_secret INTO supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-deviation-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'deviation_id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'type', NEW.type,
      'severity', NEW.severity,
      'vessel_id', NEW.vessel_id,
      'created_by', NEW.created_by
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new deviations
DROP TRIGGER IF EXISTS trigger_notify_new_deviation ON public.deviations;
CREATE TRIGGER trigger_notify_new_deviation
  AFTER INSERT ON public.deviations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_deviation();