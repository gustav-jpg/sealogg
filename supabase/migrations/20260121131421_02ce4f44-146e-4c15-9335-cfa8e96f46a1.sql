
-- Fix the RLS policies that have the wrong parameter order for is_org_admin
-- The function signature is: is_org_admin(_user_id uuid, _org_id uuid)
-- But policies were using: is_org_admin(organization_id, auth.uid()) - which is backwards!

-- Drop and recreate the intranet_messages policies with correct parameter order
DROP POLICY IF EXISTS "Admins can insert intranet messages" ON public.intranet_messages;
DROP POLICY IF EXISTS "Admins can update intranet messages" ON public.intranet_messages;
DROP POLICY IF EXISTS "Admins can delete intranet messages" ON public.intranet_messages;

CREATE POLICY "Admins can insert intranet messages" 
ON public.intranet_messages 
FOR INSERT 
WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can update intranet messages" 
ON public.intranet_messages 
FOR UPDATE 
USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

CREATE POLICY "Admins can delete intranet messages" 
ON public.intranet_messages 
FOR DELETE 
USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
