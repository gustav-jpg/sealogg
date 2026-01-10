-- Fix RLS policy for user_certificates - admin needs WITH CHECK for INSERT/UPDATE
DROP POLICY IF EXISTS "Admin kan hantera certifikat" ON public.user_certificates;

CREATE POLICY "Admin kan hantera certifikat"
ON public.user_certificates
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix storage policy - only admin should view/download certificates (not skeppare)
DROP POLICY IF EXISTS "Admin and skeppare can view certificates" ON storage.objects;

CREATE POLICY "Admin kan se certifikat"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));