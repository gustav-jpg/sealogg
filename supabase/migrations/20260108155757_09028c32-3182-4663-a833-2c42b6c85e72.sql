-- Lägg till kolumn för dokumentfil i inskolningar
ALTER TABLE public.user_vessel_inductions 
ADD COLUMN document_url TEXT;

-- Skapa storage bucket för inskolningsdokument
INSERT INTO storage.buckets (id, name, public)
VALUES ('inductions', 'inductions', false);

-- Storage policies för inskolningsdokument
CREATE POLICY "Admin kan hantera inskolningsdokument"
ON storage.objects FOR ALL
USING (bucket_id = 'inductions' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Skeppare kan se inskolningsdokument"
ON storage.objects FOR SELECT
USING (bucket_id = 'inductions' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'skeppare'::app_role)));