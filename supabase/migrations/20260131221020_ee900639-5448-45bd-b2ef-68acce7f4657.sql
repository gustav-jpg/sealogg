-- Fix: Update RLS policy for logbooks to allow closing
-- The issue is that when status changes from 'oppen' to 'stangd', 
-- the policy fails because WITH CHECK defaults to USING when not specified,
-- and USING requires status = 'oppen'

DROP POLICY IF EXISTS "Skeppare and org admins can update logbooks" ON public.logbooks;

CREATE POLICY "Skeppare and org admins can update logbooks" 
ON public.logbooks
FOR UPDATE
USING (
  -- Can update if: skeppare/admin AND logbook is open, OR org admin for this logbook, OR superadmin
  (is_admin_or_skeppare(auth.uid()) AND status = 'oppen'::logbook_status)
  OR is_logbook_org_admin(auth.uid(), id)
  OR is_superadmin(auth.uid())
)
WITH CHECK (
  -- Allow the update result if user is skeppare/admin, org admin, or superadmin
  -- This allows changing status from 'oppen' to 'stangd'
  is_admin_or_skeppare(auth.uid())
  OR is_logbook_org_admin(auth.uid(), id)
  OR is_superadmin(auth.uid())
);