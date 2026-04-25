
-- SELECT policy for personal certificates
CREATE POLICY "Users can read own certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificates'
  AND (
    -- Owner: file path starts with their user_id
    (storage.foldername(name))[1] = auth.uid()::text
    -- Or admin (app-level)
    OR has_role(auth.uid(), 'admin'::app_role)
    -- Or skeppare (app-level)
    OR has_role(auth.uid(), 'skeppare'::app_role)
    -- Or org_admin in any organization
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'org_admin'::org_role
    )
  )
);

-- SELECT policy for vessel certificates
CREATE POLICY "Authenticated users can read vessel certificates"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vessel-certificates'
);

-- Allow admins/skeppare to upload/update/delete vessel certificates
CREATE POLICY "Admins can upload vessel certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vessel-certificates'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'skeppare'::app_role)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'org_admin'::org_role
    )
  )
);

CREATE POLICY "Admins can update vessel certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vessel-certificates'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'skeppare'::app_role)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'org_admin'::org_role
    )
  )
);

CREATE POLICY "Admins can delete vessel certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vessel-certificates'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'skeppare'::app_role)
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'org_admin'::org_role
    )
  )
);
