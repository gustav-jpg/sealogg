-- Allow admins and skeppare to delete checklist executions
CREATE POLICY "Skeppare kan radera checklistexekveringar" 
ON public.checklist_executions 
FOR DELETE 
USING (is_admin_or_skeppare(auth.uid()));

-- Allow deletion of step results when execution is deleted
CREATE POLICY "Skeppare kan radera stegresultat" 
ON public.checklist_step_results 
FOR DELETE 
USING (is_admin_or_skeppare(auth.uid()));