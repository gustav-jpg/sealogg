-- Create page_views table to track visits
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  path TEXT NOT NULL,
  user_agent TEXT,
  referrer TEXT,
  session_id TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Only superadmins can read page views
CREATE POLICY "Superadmins can read page views"
ON public.page_views
FOR SELECT
USING (public.is_superadmin(auth.uid()));

-- Create index for common queries
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views(path);
CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);