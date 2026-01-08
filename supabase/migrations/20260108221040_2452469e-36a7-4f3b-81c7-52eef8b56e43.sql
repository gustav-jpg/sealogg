-- Create organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    org_number TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization member role enum
CREATE TYPE public.org_role AS ENUM ('org_admin', 'org_user');

-- Create organization_members table
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.org_role NOT NULL DEFAULT 'org_user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Add organization_id to vessels table
ALTER TABLE public.vessels ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Create superadmin table (separate from app_role to avoid enum issues)
CREATE TABLE public.superadmins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.superadmins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.superadmins
    WHERE user_id = _user_id
  )
$$;

-- Helper function to get user's organizations
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = _user_id
$$;

-- Helper function to check if user is org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = 'org_admin'
  )
$$;

-- RLS Policies for superadmins (only superadmins can see/manage)
CREATE POLICY "Superadmin kan se superadmins"
ON public.superadmins
FOR SELECT
USING (is_superadmin(auth.uid()));

-- RLS Policies for organizations
CREATE POLICY "Superadmin kan hantera alla organisationer"
ON public.organizations
FOR ALL
USING (is_superadmin(auth.uid()));

CREATE POLICY "Medlemmar kan se sin organisation"
ON public.organizations
FOR SELECT
USING (id IN (SELECT get_user_org_ids(auth.uid())));

-- RLS Policies for organization_members
CREATE POLICY "Superadmin kan hantera alla medlemmar"
ON public.organization_members
FOR ALL
USING (is_superadmin(auth.uid()));

CREATE POLICY "Org admin kan hantera sina medlemmar"
ON public.organization_members
FOR ALL
USING (is_org_admin(auth.uid(), organization_id));

CREATE POLICY "Medlemmar kan se andra i sin organisation"
ON public.organization_members
FOR SELECT
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Update vessels RLS to filter by organization
DROP POLICY IF EXISTS "Alla kan se fartyg" ON public.vessels;
DROP POLICY IF EXISTS "Admin kan hantera fartyg" ON public.vessels;

CREATE POLICY "Superadmin kan hantera alla fartyg"
ON public.vessels
FOR ALL
USING (is_superadmin(auth.uid()));

CREATE POLICY "Org admin kan hantera sina fartyg"
ON public.vessels
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid() AND role = 'org_admin'
    )
);

CREATE POLICY "Medlemmar kan se sina fartyg"
ON public.vessels
FOR SELECT
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Update timestamp trigger for organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();