-- Create changelog table for system updates
CREATE TABLE public.changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  is_published BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.changelog ENABLE ROW LEVEL SECURITY;

-- Public can read published entries (no auth required)
CREATE POLICY "Anyone can view published changelog entries"
  ON public.changelog
  FOR SELECT
  USING (is_published = true);

-- Superadmins can do everything
CREATE POLICY "Superadmins can manage changelog"
  ON public.changelog
  FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- Add index for performance
CREATE INDEX idx_changelog_published_at ON public.changelog(published_at DESC);