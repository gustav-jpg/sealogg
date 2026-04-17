-- Drop existing UPDATE policies on rustning_tasks and recreate with WITH CHECK
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rustning_tasks' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rustning_tasks', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Org members can update rustning tasks"
ON public.rustning_tasks
FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
)
WITH CHECK (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
);