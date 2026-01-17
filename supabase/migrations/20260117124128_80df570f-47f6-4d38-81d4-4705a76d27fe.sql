-- Create exercise_categories table for organization-specific exercise types
CREATE TABLE public.exercise_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercise_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view exercise categories for their organizations"
ON public.exercise_categories
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage exercise categories"
ON public.exercise_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = exercise_categories.organization_id
    AND organization_members.user_id = auth.uid()
    AND organization_members.role = 'org_admin'
  )
);

-- Seed default exercise categories for existing organizations
INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Sjukdomsfall', 'Övning för hantering av sjukdomsfall ombord' FROM organizations;

INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Övergivande av fartyg', 'Övning för evakuering och övergivande av fartyg' FROM organizations;

INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Brand', 'Brandövning och släckningsrutiner' FROM organizations;

INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Grundstötning', 'Övning för hantering av grundstötning' FROM organizations;

INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Kollision', 'Övning för hantering av kollision' FROM organizations;

INSERT INTO public.exercise_categories (organization_id, name, description)
SELECT id, 'Vattenförorening', 'Övning för hantering av vattenförorening' FROM organizations;