-- Drop existing functions
DROP FUNCTION IF EXISTS public.notify_new_fault_case() CASCADE;
DROP FUNCTION IF EXISTS public.notify_new_deviation() CASCADE;

-- Recreate with hardcoded URL (vault secrets don't work reliably)
CREATE OR REPLACE FUNCTION public.notify_new_fault_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call edge function via pg_net with direct URL
  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/send-fault-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
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
EXCEPTION WHEN OTHERS THEN
  -- Don't block the insert if notification fails
  RAISE WARNING 'Failed to send fault notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_deviation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Call edge function via pg_net with direct URL
  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/send-deviation-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
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
EXCEPTION WHEN OTHERS THEN
  -- Don't block the insert if notification fails
  RAISE WARNING 'Failed to send deviation notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS trigger_notify_new_fault_case ON public.fault_cases;
CREATE TRIGGER trigger_notify_new_fault_case
  AFTER INSERT ON public.fault_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_fault_case();

DROP TRIGGER IF EXISTS trigger_notify_new_deviation ON public.deviations;
CREATE TRIGGER trigger_notify_new_deviation
  AFTER INSERT ON public.deviations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_deviation();