-- Create table for allowed crew roles per profile
CREATE TABLE public.profile_crew_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role crew_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, role)
);

-- Enable RLS
ALTER TABLE public.profile_crew_roles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Alla kan se tillåtna roller"
ON public.profile_crew_roles FOR SELECT
USING (true);

CREATE POLICY "Admin kan hantera tillåtna roller"
ON public.profile_crew_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));