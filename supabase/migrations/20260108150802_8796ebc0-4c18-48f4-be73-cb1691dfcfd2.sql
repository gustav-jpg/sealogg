-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', false);

-- Storage policies for certificates bucket
CREATE POLICY "Admin can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update certificates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin and skeppare can view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND is_admin_or_skeppare(auth.uid()));

-- Add file_url column to user_certificates
ALTER TABLE public.user_certificates
ADD COLUMN file_url TEXT;

-- Update RLS policy to allow skeppare to view certificates
DROP POLICY IF EXISTS "Användare kan se sina certifikat" ON public.user_certificates;

CREATE POLICY "Användare och skeppare kan se certifikat"
ON public.user_certificates
FOR SELECT
USING (
  user_id = auth.uid() 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'skeppare'::app_role)
);