-- Allow users to delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.fault_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow org admins to delete any comment in their org
CREATE POLICY "Org admins can delete fault comments"
  ON public.fault_comments
  FOR DELETE
  USING (
    fault_case_id IN (
      SELECT fc.id FROM fault_cases fc
      JOIN vessels v ON v.id = fc.vessel_id
      JOIN organization_members om ON om.organization_id = v.organization_id
      WHERE om.user_id = auth.uid() AND om.role = 'org_admin'
    )
    OR is_superadmin(auth.uid())
  );