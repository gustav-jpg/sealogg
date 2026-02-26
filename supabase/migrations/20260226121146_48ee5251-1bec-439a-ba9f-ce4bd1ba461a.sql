
-- Drop the old policy and recreate with support for external profiles via organization_id
DROP POLICY IF EXISTS "Admins can manage certificates in their org" ON public.user_certificates;

CREATE POLICY "Admins can manage certificates in their org"
ON public.user_certificates
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) AND (
    -- Regular org members
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id IN (
        SELECT om.user_id FROM organization_members om
        WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
      )
    )
    OR
    -- External profiles belonging to same org
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.is_external = true
        AND p.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND (
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
        AND p.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  )
);
