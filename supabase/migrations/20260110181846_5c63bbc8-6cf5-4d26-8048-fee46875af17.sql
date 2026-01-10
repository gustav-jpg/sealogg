-- Create enum for available modules/features
CREATE TYPE public.app_module AS ENUM (
  'logbook',
  'deviations', 
  'fault_cases',
  'self_control',
  'checklists',
  'bookings'
);

-- Create organization_features table for module subscriptions
CREATE TABLE public.organization_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module app_module NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module)
);

-- Enable RLS
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

-- Superadmins can manage all features
CREATE POLICY "Superadmins can manage organization features"
ON public.organization_features
FOR ALL
TO authenticated
USING (public.is_superadmin(auth.uid()));

-- Org members can view their organization's features
CREATE POLICY "Org members can view their features"
ON public.organization_features
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_organization_features_updated_at
BEFORE UPDATE ON public.organization_features
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add helper function to check if org has a module
CREATE OR REPLACE FUNCTION public.org_has_module(_org_id UUID, _module app_module)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_features
    WHERE organization_id = _org_id
      AND module = _module
      AND is_active = true
      AND starts_at <= CURRENT_DATE
      AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  )
$$;

-- Helper function to get user's active modules
CREATE OR REPLACE FUNCTION public.get_user_modules(_user_id UUID)
RETURNS app_module[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT of.module)
  FROM public.organization_features of
  INNER JOIN public.organization_members om ON of.organization_id = om.organization_id
  WHERE om.user_id = _user_id
    AND of.is_active = true
    AND of.starts_at <= CURRENT_DATE
    AND (of.expires_at IS NULL OR of.expires_at >= CURRENT_DATE)
$$;