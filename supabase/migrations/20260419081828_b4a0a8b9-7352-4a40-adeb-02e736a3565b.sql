-- Tillåt skeppare/admin (appens roller) på sin organisations fartyg att hantera passagerarsessioner,
-- inte bara logbook_crew och org_admin.

DROP POLICY IF EXISTS "Crew and org admins can create sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Crew and org admins can update sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Crew and org admins can delete sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Crew and org admins can view sessions" ON public.passenger_sessions;

CREATE POLICY "Crew, skeppare and org admins can create sessions"
  ON public.passenger_sessions
  FOR INSERT
  WITH CHECK (
    public.is_logbook_crew(auth.uid(), logbook_id)
    OR public.is_vessel_org_admin(auth.uid(), vessel_id)
    OR (
      public.is_admin_or_skeppare(auth.uid())
      AND vessel_id IN (
        SELECT v.id FROM public.vessels v
        WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
      )
    )
  );

CREATE POLICY "Crew, skeppare and org admins can update sessions"
  ON public.passenger_sessions
  FOR UPDATE
  USING (
    public.is_logbook_crew(auth.uid(), logbook_id)
    OR public.is_vessel_org_admin(auth.uid(), vessel_id)
    OR (
      public.is_admin_or_skeppare(auth.uid())
      AND vessel_id IN (
        SELECT v.id FROM public.vessels v
        WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
      )
    )
  );

CREATE POLICY "Crew, skeppare and org admins can delete sessions"
  ON public.passenger_sessions
  FOR DELETE
  USING (
    public.is_logbook_crew(auth.uid(), logbook_id)
    OR public.is_vessel_org_admin(auth.uid(), vessel_id)
    OR public.is_superadmin(auth.uid())
    OR (
      public.is_admin_or_skeppare(auth.uid())
      AND vessel_id IN (
        SELECT v.id FROM public.vessels v
        WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
      )
    )
  );

CREATE POLICY "Crew, skeppare and org admins can view sessions"
  ON public.passenger_sessions
  FOR SELECT
  USING (
    public.is_logbook_crew(auth.uid(), logbook_id)
    OR public.is_vessel_org_admin(auth.uid(), vessel_id)
    OR public.is_superadmin(auth.uid())
    OR (
      public.is_admin_or_skeppare(auth.uid())
      AND vessel_id IN (
        SELECT v.id FROM public.vessels v
        WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
      )
    )
  );