-- Drop and recreate the admin policy to also cover external profiles
DROP POLICY IF EXISTS "Admins can manage certificates in their org" ON public.user_certificates;

CREATE POLICY "Admins can manage certificates in their org"
ON public.user_certificates
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    -- Internal users: profile's user_id is in the same org
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id IN (
        SELECT om.user_id FROM organization_members om
        WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
      )
    )
    OR
    -- External profiles: linked to org via logbook_crew → logbooks → vessels
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.is_external = true
        AND p.id IN (
          SELECT lc.profile_id FROM logbook_crew lc
          JOIN logbooks l ON l.id = lc.logbook_id
          JOIN vessels v ON v.id = l.vessel_id
          WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
        )
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id IN (
        SELECT om.user_id FROM organization_members om
        WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
      )
    )
    OR
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.is_external = true
        AND p.id IN (
          SELECT lc.profile_id FROM logbook_crew lc
          JOIN logbooks l ON l.id = lc.logbook_id
          JOIN vessels v ON v.id = l.vessel_id
          WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
        )
    )
  )
);