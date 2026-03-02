
CREATE POLICY "Crew and org admins can delete sessions"
ON public.passenger_sessions
FOR DELETE
USING (
  is_logbook_crew(auth.uid(), logbook_id)
  OR is_vessel_org_admin(auth.uid(), vessel_id)
  OR is_superadmin(auth.uid())
);
