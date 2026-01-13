-- Revert: Only admins should manage vessel certificates, not skeppare

-- Storage policies - only admin
DROP POLICY IF EXISTS "Admin och skeppare kan ladda upp fartygscertifikat" ON storage.objects;
CREATE POLICY "Admin kan ladda upp fartygscertifikat"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vessel-certificates' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin och skeppare kan ta bort fartygscertifikat-filer" ON storage.objects;
CREATE POLICY "Admin kan ta bort fartygscertifikat-filer"
ON storage.objects
FOR DELETE
USING (bucket_id = 'vessel-certificates' AND has_role(auth.uid(), 'admin'::app_role));

-- Table policy - only admin
DROP POLICY IF EXISTS "Admin och skeppare kan hantera fartygscertifikat i sin org" ON public.vessel_certificates;
CREATE POLICY "Admin kan hantera fartygscertifikat i sin org"
ON public.vessel_certificates FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);