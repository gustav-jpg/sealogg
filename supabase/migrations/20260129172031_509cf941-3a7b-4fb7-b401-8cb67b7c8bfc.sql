-- Fix remaining profile policy
DROP POLICY IF EXISTS "Admins can delete external profiles" ON public.profiles;

CREATE POLICY "Org admins can delete external profiles in their org"
  ON public.profiles FOR DELETE
  USING (
    is_external = true 
    AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
    AND (
      EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.user_id = auth.uid() 
        AND om.organization_id = profiles.organization_id 
        AND om.role = 'org_admin'
      )
      OR is_superadmin(auth.uid())
    )
  );