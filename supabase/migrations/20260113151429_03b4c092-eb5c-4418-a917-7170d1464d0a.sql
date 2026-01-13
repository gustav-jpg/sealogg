-- Drop and recreate storage policies to include skeppare role for vessel-certificates

-- First, drop the existing upload policy
DROP POLICY IF EXISTS "Admin kan ladda upp fartygscertifikat" ON storage.objects;

-- Recreate with both admin and skeppare
CREATE POLICY "Admin och skeppare kan ladda upp fartygscertifikat"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'vessel-certificates' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'skeppare'::app_role))
);

-- Also update delete policy to include skeppare
DROP POLICY IF EXISTS "Admin kan ta bort fartygscertifikat-filer" ON storage.objects;

CREATE POLICY "Admin och skeppare kan ta bort fartygscertifikat-filer"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'vessel-certificates' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'skeppare'::app_role))
);

-- Also update the vessel_certificates table policy to allow skeppare
DROP POLICY IF EXISTS "Admins can manage vessel certificates in their org" ON public.vessel_certificates;

CREATE POLICY "Admin och skeppare kan hantera fartygscertifikat i sin org"
ON public.vessel_certificates FOR ALL TO authenticated
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