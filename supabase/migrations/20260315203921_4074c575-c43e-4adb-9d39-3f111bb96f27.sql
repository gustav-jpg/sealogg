-- Replace notify_new_fault_case to use dispatch-notification
CREATE OR REPLACE FUNCTION public.notify_new_fault_case()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_vessel_name text;
  v_creator_name text;
  v_priority_label text;
BEGIN
  SELECT v.organization_id, v.name
  INTO v_org_id, v_vessel_name
  FROM vessels v WHERE v.id = NEW.vessel_id;

  SELECT full_name INTO v_creator_name
  FROM profiles WHERE user_id = NEW.created_by;

  v_priority_label := CASE NEW.priority
    WHEN 'low' THEN 'Låg'
    WHEN 'medium' THEN 'Medel'
    WHEN 'high' THEN 'Hög'
    WHEN 'critical' THEN 'Kritisk'
    ELSE NEW.priority::text
  END;

  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
    ),
    body := jsonb_build_object(
      'event', 'new_fault',
      'organization_id', v_org_id,
      'fault_case_id', NEW.id,
      'title', 'Nytt felärende: ' || left(NEW.title, 40),
      'body', COALESCE(v_creator_name, 'Okänd') || ' · ' || v_priority_label || ' · ' || COALESCE(v_vessel_name, ''),
      'url', '/portal/fault-cases/' || NEW.id,
      'commenter_name', v_creator_name,
      'vessel_name', v_vessel_name
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send fault notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Replace notify_new_deviation to use dispatch-notification
CREATE OR REPLACE FUNCTION public.notify_new_deviation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_vessel_name text;
  v_creator_name text;
  v_type_label text;
  v_severity_label text;
BEGIN
  SELECT v.organization_id, v.name
  INTO v_org_id, v_vessel_name
  FROM vessels v WHERE v.id = NEW.vessel_id;

  SELECT full_name INTO v_creator_name
  FROM profiles WHERE user_id = NEW.created_by;

  v_type_label := CASE NEW.type::text
    WHEN 'incident_with_accident' THEN 'Incident (tillbud)'
    WHEN 'incident_without_accident' THEN 'Incident'
    WHEN 'observation' THEN 'Observation'
    WHEN 'improvement' THEN 'Förbättringsförslag'
    ELSE NEW.type::text
  END;

  v_severity_label := CASE NEW.severity::text
    WHEN 'low' THEN 'Låg'
    WHEN 'medium' THEN 'Medel'
    WHEN 'high' THEN 'Hög'
    WHEN 'critical' THEN 'Kritisk'
    ELSE NEW.severity::text
  END;

  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
    ),
    body := jsonb_build_object(
      'event', 'new_deviation',
      'organization_id', v_org_id,
      'deviation_id', NEW.id,
      'title', 'Ny avvikelse: ' || left(NEW.title, 40),
      'body', COALESCE(v_creator_name, 'Okänd') || ' · ' || v_type_label || ' · ' || v_severity_label || ' · ' || COALESCE(v_vessel_name, ''),
      'url', '/portal/deviations/' || NEW.id,
      'commenter_name', v_creator_name,
      'vessel_name', v_vessel_name
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send deviation notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;