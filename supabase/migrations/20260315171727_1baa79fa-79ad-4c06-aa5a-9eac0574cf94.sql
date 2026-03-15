
-- Fix notify_fault_comment_mentions: increase pg_net timeout to 30s
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
  v_mentioned_names text[];
  v_mentioned_user_ids uuid[];
  v_name text;
  v_user_id uuid;
BEGIN
  SELECT fc.title, v.organization_id, v.name
  INTO v_fault_title, v_org_id, v_vessel_name
  FROM fault_cases fc
  JOIN vessels v ON v.id = fc.vessel_id
  WHERE fc.id = NEW.fault_case_id;

  SELECT full_name INTO v_commenter_name
  FROM profiles WHERE user_id = NEW.user_id;

  SELECT ARRAY(
    SELECT DISTINCT trim(m[1])
    FROM regexp_matches(NEW.comment_text, '@([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)', 'g') AS m
  ) INTO v_mentioned_names;

  IF v_mentioned_names IS NULL OR array_length(v_mentioned_names, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_mentioned_user_ids := ARRAY[]::uuid[];
  FOREACH v_name IN ARRAY v_mentioned_names LOOP
    SELECT p.user_id INTO v_user_id
    FROM profiles p
    WHERE lower(p.full_name) = lower(v_name)
      AND p.user_id IS NOT NULL
    LIMIT 1;

    IF v_user_id IS NOT NULL AND v_user_id != NEW.user_id THEN
      v_mentioned_user_ids := array_append(v_mentioned_user_ids, v_user_id);
    END IF;
  END LOOP;

  IF array_length(v_mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

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
      'title', '💬 ' || v_commenter_name || ' nämnde dig i ' || v_fault_title,
      'body', left(NEW.comment_text, 200),
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

-- Fix notify_fault_assigned: increase timeout + resolve profile_id to user_id
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
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  -- assigned_to references profiles(id), so resolve to user_id
  SELECT p.user_id INTO v_assigned_user_id
  FROM profiles p WHERE p.id = NEW.assigned_to;

  IF v_assigned_user_id IS NULL THEN
    RETURN NEW;
  END IF;

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
      'title', '👤 Du har tilldelats: ' || NEW.title,
      'body', 'Du har blivit ansvarig för felärendet "' || NEW.title || '" på ' || v_vessel_name,
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
