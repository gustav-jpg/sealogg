-- Create intranet_messages table for daily messages with documents
CREATE TABLE public.intranet_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_date DATE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  document_url TEXT,
  document_name TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint for one message per date per organization
CREATE UNIQUE INDEX intranet_messages_org_date_unique ON public.intranet_messages(organization_id, message_date);

-- Enable RLS
ALTER TABLE public.intranet_messages ENABLE ROW LEVEL SECURITY;

-- All org members can view messages
CREATE POLICY "Org members can view intranet messages"
ON public.intranet_messages
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Admins can insert messages
CREATE POLICY "Admins can insert intranet messages"
ON public.intranet_messages
FOR INSERT
WITH CHECK (
  is_org_admin(organization_id, auth.uid()) OR is_superadmin(auth.uid())
);

-- Admins can update messages
CREATE POLICY "Admins can update intranet messages"
ON public.intranet_messages
FOR UPDATE
USING (
  is_org_admin(organization_id, auth.uid()) OR is_superadmin(auth.uid())
);

-- Admins can delete messages
CREATE POLICY "Admins can delete intranet messages"
ON public.intranet_messages
FOR DELETE
USING (
  is_org_admin(organization_id, auth.uid()) OR is_superadmin(auth.uid())
);

-- Create updated_at trigger
CREATE TRIGGER update_intranet_messages_updated_at
BEFORE UPDATE ON public.intranet_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for intranet documents
INSERT INTO storage.buckets (id, name, public) VALUES ('intranet-documents', 'intranet-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for intranet documents
CREATE POLICY "Org members can view intranet documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'intranet-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can upload intranet documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'intranet-documents' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete intranet documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'intranet-documents' AND auth.role() = 'authenticated');