-- Create table for multiple documents per intranet message
CREATE TABLE public.intranet_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.intranet_messages(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  display_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.intranet_documents ENABLE ROW LEVEL SECURITY;

-- Create policies - org members can view documents
CREATE POLICY "Org members can view intranet documents" 
ON public.intranet_documents 
FOR SELECT 
USING (organization_id IN (SELECT public.get_user_org_ids(auth.uid())));

-- Admin/skeppare can insert documents
CREATE POLICY "Admin/skeppare can insert intranet documents" 
ON public.intranet_documents 
FOR INSERT 
WITH CHECK (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  AND public.is_admin_or_skeppare(auth.uid())
);

-- Admin/skeppare can delete documents
CREATE POLICY "Admin/skeppare can delete intranet documents" 
ON public.intranet_documents 
FOR DELETE 
USING (
  organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  AND public.is_admin_or_skeppare(auth.uid())
);

-- Create index for faster lookups
CREATE INDEX idx_intranet_documents_message_id ON public.intranet_documents(message_id);