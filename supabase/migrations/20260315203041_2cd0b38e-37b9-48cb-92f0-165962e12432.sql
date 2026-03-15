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
      'title', COALESCE(v_commenter_name, 'Någon') || ' taggade dig',
      'body', left(v_fault_title, 60) || ': ' || left(NEW.comment_text, 120),
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