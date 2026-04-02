
-- Allow all authenticated org members to start checklists (not just admin/skeppare)
DROP POLICY IF EXISTS "Skeppare kan skapa checklistexekveringar" ON public.checklist_executions;
CREATE POLICY "Org members can create checklist executions"
ON public.checklist_executions
FOR INSERT
TO authenticated
WITH CHECK (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Allow all authenticated org members to update checklist executions
DROP POLICY IF EXISTS "Skeppare kan uppdatera checklistexekveringar" ON public.checklist_executions;
CREATE POLICY "Org members can update checklist executions"
ON public.checklist_executions
FOR UPDATE
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Allow all authenticated org members to create step results
DROP POLICY IF EXISTS "Skeppare kan skapa stegresultat" ON public.checklist_step_results;
CREATE POLICY "Org members can create step results"
ON public.checklist_step_results
FOR INSERT
TO authenticated
WITH CHECK (
  checklist_execution_id IN (
    SELECT ce.id FROM checklist_executions ce
    JOIN vessels v ON v.id = ce.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Allow all authenticated org members to update step results
DROP POLICY IF EXISTS "Skeppare kan uppdatera stegresultat" ON public.checklist_step_results;
CREATE POLICY "Org members can update step results"
ON public.checklist_step_results
FOR UPDATE
TO authenticated
USING (
  checklist_execution_id IN (
    SELECT ce.id FROM checklist_executions ce
    JOIN vessels v ON v.id = ce.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);
