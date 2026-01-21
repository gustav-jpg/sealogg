-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile / admins can update external" ON public.profiles;

-- Create new UPDATE policy that allows:
-- 1. Users to update their own profile
-- 2. Admins to update profiles in their organization (both external and internal users)
CREATE POLICY "Users can update own profile / admins can update org profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      -- External profiles in admin's org
      (is_external = true AND organization_id IN (SELECT get_user_org_ids(auth.uid())))
      OR
      -- Internal profiles where user is member of admin's org
      (user_id IN (
        SELECT om.user_id 
        FROM organization_members om 
        WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
      ))
    )
  )
);