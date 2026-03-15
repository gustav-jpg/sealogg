-- 1) @-tagg: ny mall
CREATE OR REPLACE FUNCTION public.notify_fault_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_fault_title text;
  v_commenter_name text;
  v_vessel_name text;
  v_mentioned_user_ids uuid[];
  v_comment_preview text;
BEGIN
  SELECT fc.title, v.organization_id, v.name
  INTO v_fault_title, v_org_id, v_vessel_name
  FROM fault_cases fc
  JOIN vessels v ON v.id = fc.vessel_id
  WHERE fc.id = NEW.fault_case_id;

  SELECT full_name INTO v_commenter_name
  FROM profiles WHERE user_id = NEW.user_id;

  SELECT ARRAY(
    SELECT DISTINCT p.user_id
    FROM profiles p
    JOIN organization_members om ON om.user_id = p.user_id
    WHERE om.organization_id = v_org_id
      AND p.user_id IS NOT NULL
      AND p.user_id <> NEW.user_id
      AND NEW.comment_text ILIKE ('%' || '@' || p.full_name || '%')
  ) INTO v_mentioned_user_ids;

  IF v_mentioned_user_ids IS NULL OR array_length(v_mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Strip @mentions from preview
  v_comment_preview := regexp_replace(NEW.comment_text, '@[A-Za-zÀ-ÿ]+(\s[A-Za-zÀ-ÿ]+)*', '', 'g');
  v_comment_preview := btrim(v_comment_preview);

  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
    ),
    body := jsonb_build_object(
      'event', 'fault_comment',
      'organization_id', v_org_id,
      'recipient_user_ids', to_jsonb(v_mentioned_user_ids),
      'fault_case_id', NEW.fault_case_id,
      'title', 'Du blev nämnd i ett ärende',
      'body', COALESCE(v_commenter_name, 'Någon') || ' nämnde dig i ärendet "' || COALESCE(v_fault_title, '') || '".' || E'\n' || 'Kommentar: "' || left(v_comment_preview, 120) || '"',
      'url', '/portal/fault-cases/' || NEW.fault_case_id,
      'commenter_name', v_commenter_name,
      'vessel_name', v_vessel_name
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send fault comment notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 2) Tilldelad: ny mall
CREATE OR REPLACE FUNCTION public.notify_fault_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_vessel_name text;
  v_assigned_user_id uuid;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN RETURN NEW; END IF;

  SELECT p.user_id INTO v_assigned_user_id
  FROM profiles p WHERE p.id = NEW.assigned_to;
  IF v_assigned_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT v.organization_id, v.name
  INTO v_org_id, v_vessel_name
  FROM vessels v WHERE v.id = NEW.vessel_id;

  PERFORM net.http_post(
    url := 'https://qbnpchhthivsfajvbrfr.supabase.co/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFibnBjaGh0aGl2c2ZhanZicmZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Nzk5OTgsImV4cCI6MjA4MzQ1NTk5OH0.a1O2vI7wWH0X-rmRRuLzCI_n0l2BkG4ViVxw_5MINvc'
    ),
    body := jsonb_build_object(
      'event', 'fault_assigned',
      'organization_id', v_org_id,
      'assigned_user_id', v_assigned_user_id,
      'fault_case_id', NEW.id,
      'title', 'Du har blivit tilldelad ett ärende',
      'body', 'Du ansvarar nu för ärendet "' || NEW.title || '".',
      'url', '/portal/fault-cases/' || NEW.id,
      'vessel_name', v_vessel_name
    ),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send fault assigned notification: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3) Nytt felärende: ny mall
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
BEGIN
  SELECT v.organization_id, v.name
  INTO v_org_id, v_vessel_name
  FROM vessels v WHERE v.id = NEW.vessel_id;

  SELECT full_name INTO v_creator_name
  FROM profiles WHERE user_id = NEW.created_by;

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
      'title', 'Nytt felärende skapat',
      'body', COALESCE(v_creator_name, 'Okänd') || ' skapade ett nytt felärende:' || E'\n' || NEW.title || ' · Fartyg: ' || COALESCE(v_vessel_name, ''),
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

-- 4) Ny avvikelse: ny mall
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
BEGIN
  SELECT v.organization_id, v.name
  INTO v_org_id, v_vessel_name
  FROM vessels v WHERE v.id = NEW.vessel_id;

  SELECT full_name INTO v_creator_name
  FROM profiles WHERE user_id = NEW.created_by;

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
      'title', 'Ny avvikelse rapporterad',
      'body', COALESCE(v_creator_name, 'Okänd') || ' rapporterade en avvikelse:' || E'\n' || NEW.title || ' · Fartyg: ' || COALESCE(v_vessel_name, ''),
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