
-- 1. Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_generic_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM public.log_audit(TG_TABLE_NAME, NEW.id, 'INSERT', NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM public.log_audit(TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM public.log_audit(TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 2. Drop existing booking trigger and replace
DROP TRIGGER IF EXISTS audit_booking_changes ON public.bookings;

-- 3. Add audit triggers (use IF NOT EXISTS pattern via DROP+CREATE)
DROP TRIGGER IF EXISTS audit_vessel_changes ON public.vessels;
CREATE TRIGGER audit_vessel_changes
AFTER INSERT OR UPDATE OR DELETE ON public.vessels
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_deviation_changes ON public.deviations;
CREATE TRIGGER audit_deviation_changes
AFTER INSERT OR UPDATE OR DELETE ON public.deviations
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_fault_case_changes ON public.fault_cases;
CREATE TRIGGER audit_fault_case_changes
AFTER INSERT OR UPDATE OR DELETE ON public.fault_cases
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_organization_changes ON public.organizations;
CREATE TRIGGER audit_organization_changes
AFTER INSERT OR UPDATE OR DELETE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_control_point_changes ON public.control_points;
CREATE TRIGGER audit_control_point_changes
AFTER INSERT OR UPDATE OR DELETE ON public.control_points
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_control_point_record_changes ON public.control_point_records;
CREATE TRIGGER audit_control_point_record_changes
AFTER INSERT OR UPDATE OR DELETE ON public.control_point_records
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_checklist_execution_changes ON public.checklist_executions;
CREATE TRIGGER audit_checklist_execution_changes
AFTER INSERT OR UPDATE OR DELETE ON public.checklist_executions
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_checklist_template_changes ON public.checklist_templates;
CREATE TRIGGER audit_checklist_template_changes
AFTER INSERT OR UPDATE OR DELETE ON public.checklist_templates
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

CREATE TRIGGER audit_booking_changes
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_org_member_changes ON public.organization_members;
CREATE TRIGGER audit_org_member_changes
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_changelog_changes ON public.changelog;
CREATE TRIGGER audit_changelog_changes
AFTER INSERT OR UPDATE OR DELETE ON public.changelog
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_intranet_message_changes ON public.intranet_messages;
CREATE TRIGGER audit_intranet_message_changes
AFTER INSERT OR UPDATE OR DELETE ON public.intranet_messages
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

DROP TRIGGER IF EXISTS audit_certificate_type_changes ON public.certificate_types;
CREATE TRIGGER audit_certificate_type_changes
AFTER INSERT OR UPDATE OR DELETE ON public.certificate_types
FOR EACH ROW EXECUTE FUNCTION public.audit_generic_changes();

-- 4. DB function for aggregated page view stats (avoids 1000-row limit)
CREATE OR REPLACE FUNCTION public.get_page_view_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_views', (SELECT count(*) FROM page_views WHERE created_at >= now() - interval '30 days'),
    'today_views', (SELECT count(*) FROM page_views WHERE created_at >= date_trunc('day', now())),
    'today_sessions', (SELECT count(DISTINCT session_id) FROM page_views WHERE created_at >= date_trunc('day', now())),
    'today_users', (SELECT count(DISTINCT user_id) FROM page_views WHERE created_at >= date_trunc('day', now()) AND user_id IS NOT NULL),
    'week_views', (SELECT count(*) FROM page_views WHERE created_at >= now() - interval '7 days'),
    'week_sessions', (SELECT count(DISTINCT session_id) FROM page_views WHERE created_at >= now() - interval '7 days'),
    'week_users', (SELECT count(DISTINCT user_id) FROM page_views WHERE created_at >= now() - interval '7 days' AND user_id IS NOT NULL),
    'daily', (
      SELECT jsonb_agg(jsonb_build_object('day', d::date, 'views', coalesce(v.cnt, 0), 'sessions', coalesce(v.sess, 0)) ORDER BY d)
      FROM generate_series(
        date_trunc('day', now() - interval '6 days'),
        date_trunc('day', now()),
        interval '1 day'
      ) d
      LEFT JOIN (
        SELECT date_trunc('day', created_at) as dt, count(*) as cnt, count(DISTINCT session_id) as sess
        FROM page_views
        WHERE created_at >= now() - interval '7 days'
        GROUP BY 1
      ) v ON date_trunc('day', d) = v.dt
    ),
    'top_pages', (
      SELECT jsonb_agg(jsonb_build_object('path', path, 'count', cnt) ORDER BY cnt DESC)
      FROM (
        SELECT path, count(*) as cnt
        FROM page_views
        WHERE created_at >= now() - interval '7 days'
        GROUP BY path
        ORDER BY cnt DESC
        LIMIT 5
      ) t
    )
  )
$$;
