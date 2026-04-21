-- Align RLS on checklist_template_vessels with checklist_templates/checklist_steps
-- Previously required org_admin (organization role), but template + step policies only require
-- app role 'admin' (which org_user/skeppare also gets via sync). This caused users with
-- org_user role to create templates/steps but fail when assigning vessels.

DROP POLICY IF EXISTS "Org admins can manage checklist vessel assignments" ON public.checklist_template_vessels;

CREATE POLICY "Admins can manage checklist vessel assignments"
ON public.checklist_template_vessels
FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'skeppare'::app_role))
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'skeppare'::app_role))
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);