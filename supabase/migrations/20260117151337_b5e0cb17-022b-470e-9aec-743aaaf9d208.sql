-- Create logbook signatures table for digital signing
CREATE TABLE public.logbook_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logbook_id UUID NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signature_type TEXT NOT NULL DEFAULT 'close', -- 'close' = stängning, 'verify' = verifiering
  content_hash TEXT NOT NULL, -- SHA-256 hash av loggboksinnehållet
  ip_address TEXT, -- Valfritt: IP-adress vid signering
  user_agent TEXT, -- Valfritt: Webbläsarinfo
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_signed_by FOREIGN KEY (signed_by) REFERENCES profiles(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_logbook_signatures_logbook_id ON public.logbook_signatures(logbook_id);
CREATE INDEX idx_logbook_signatures_signed_by ON public.logbook_signatures(signed_by);

-- Enable RLS
ALTER TABLE public.logbook_signatures ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view signatures for logbooks in their organization
CREATE POLICY "Users can view signatures for org logbooks"
ON public.logbook_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.logbooks l
    JOIN public.vessels v ON l.vessel_id = v.id
    JOIN public.organization_members om ON v.organization_id = om.organization_id
    WHERE l.id = logbook_signatures.logbook_id
    AND om.user_id = auth.uid()
  )
);

-- Policy: Admin/Skeppare can create signatures
CREATE POLICY "Admin and skeppare can sign logbooks"
ON public.logbook_signatures
FOR INSERT
WITH CHECK (
  signed_by = auth.uid()
  AND public.is_admin_or_skeppare(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.logbooks l
    JOIN public.vessels v ON l.vessel_id = v.id
    JOIN public.organization_members om ON v.organization_id = om.organization_id
    WHERE l.id = logbook_signatures.logbook_id
    AND om.user_id = auth.uid()
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.logbook_signatures IS 'Stores digital signatures for logbooks with cryptographic hash for integrity verification';