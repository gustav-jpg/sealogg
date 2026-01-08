-- Create vessel_certificates table for storing vessel certificates
CREATE TABLE public.vessel_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  expiry_date DATE NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.vessel_certificates ENABLE ROW LEVEL SECURITY;

-- All logged in users can view vessel certificates
CREATE POLICY "Alla inloggade kan se fartygscertifikat"
ON public.vessel_certificates
FOR SELECT
USING (true);

-- Admin can manage vessel certificates
CREATE POLICY "Admin kan hantera fartygscertifikat"
ON public.vessel_certificates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for vessel certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('vessel-certificates', 'vessel-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vessel certificates
CREATE POLICY "Alla inloggade kan se fartygscertifikat-filer"
ON storage.objects
FOR SELECT
USING (bucket_id = 'vessel-certificates');

CREATE POLICY "Admin kan ladda upp fartygscertifikat"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'vessel-certificates' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin kan ta bort fartygscertifikat-filer"
ON storage.objects
FOR DELETE
USING (bucket_id = 'vessel-certificates' AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_vessel_certificates_updated_at
BEFORE UPDATE ON public.vessel_certificates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();