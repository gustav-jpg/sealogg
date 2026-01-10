
-- Add organization_id to checklist_templates
ALTER TABLE public.checklist_templates 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to control_points
ALTER TABLE public.control_points 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Update existing checklist_templates with Charm's organization based on created_by user
UPDATE public.checklist_templates ct
SET organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = ct.created_by 
  LIMIT 1
)
WHERE ct.organization_id IS NULL;

-- Update existing control_points with Charm's organization (default to first org with vessels)
UPDATE public.control_points 
SET organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b'
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL after data migration
ALTER TABLE public.checklist_templates 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.control_points 
ALTER COLUMN organization_id SET NOT NULL;

-- Drop old RLS policies
DROP POLICY IF EXISTS "Alla inloggade kan se aktiva checklistmallar" ON public.checklist_templates;
DROP POLICY IF EXISTS "Admin kan hantera checklistmallar" ON public.checklist_templates;
DROP POLICY IF EXISTS "Alla inloggade kan se kontrollpunkter" ON public.control_points;
DROP POLICY IF EXISTS "Admin kan hantera kontrollpunkter" ON public.control_points;

-- Create organization-aware RLS policies for checklist_templates
CREATE POLICY "Users can view checklist templates in their organizations"
ON public.checklist_templates FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

CREATE POLICY "Admins can manage checklist templates in their organizations"
ON public.checklist_templates FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

-- Create organization-aware RLS policies for control_points
CREATE POLICY "Users can view control points in their organizations"
ON public.control_points FOR SELECT TO authenticated
USING (
  organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

CREATE POLICY "Admins can manage control points in their organizations"
ON public.control_points FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);
