-- Fix SELECT policy for profiles to include external profiles by organization_id
DROP POLICY IF EXISTS "Users can view profiles in their organizations" ON public.profiles;

CREATE POLICY "Users can view profiles in their organizations"
ON public.profiles
FOR SELECT
USING (
  -- Own profile
  user_id = auth.uid()
  -- OR profiles of users who are members of the same organizations
  OR user_id IN (
    SELECT om.user_id
    FROM organization_members om
    WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
  -- OR external profiles directly tied to my organizations
  OR (is_external = true AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
);