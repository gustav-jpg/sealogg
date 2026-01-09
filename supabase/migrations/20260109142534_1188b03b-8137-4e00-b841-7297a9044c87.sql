-- Allow skeppare/admin to update existing checklist step results (needed for UPSERT)
DROP POLICY IF EXISTS "Skeppare kan uppdatera stegresultat" ON public.checklist_step_results;

CREATE POLICY "Skeppare kan uppdatera stegresultat"
ON public.checklist_step_results
FOR UPDATE
USING (is_admin_or_skeppare(auth.uid()))
WITH CHECK (is_admin_or_skeppare(auth.uid()));
