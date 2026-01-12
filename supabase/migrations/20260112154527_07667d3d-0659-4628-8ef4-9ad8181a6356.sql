
-- First, we need to handle existing profiles without organization_id
-- These are portal users who should have org membership - we'll set their org from organization_members
UPDATE profiles p
SET organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = p.user_id 
  LIMIT 1
)
WHERE p.organization_id IS NULL 
  AND p.is_external = false
  AND p.user_id IS NOT NULL;

-- For any remaining profiles without org (orphaned), we cannot make NOT NULL without handling them
-- Check if any remain - if so, we need a default org or to delete them
-- For now, we'll add a constraint that allows NULL only for external users

-- 1. Make vessels.organization_id NOT NULL
ALTER TABLE public.vessels 
ALTER COLUMN organization_id SET NOT NULL;

-- 2. Add organization_id to control_point_attachments
ALTER TABLE public.control_point_attachments 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Populate organization_id from the related record -> control_point_records -> vessel -> organization
UPDATE public.control_point_attachments cpa
SET organization_id = (
  SELECT v.organization_id 
  FROM control_point_records cpr
  JOIN vessels v ON v.id = cpr.vessel_id
  WHERE cpr.id = cpa.record_id
);

-- Make it NOT NULL after population
ALTER TABLE public.control_point_attachments 
ALTER COLUMN organization_id SET NOT NULL;

-- 3. Create trigger to auto-set organization_id on control_point_attachments
CREATE OR REPLACE FUNCTION public.set_attachment_org_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT v.organization_id INTO NEW.organization_id
  FROM control_point_records cpr
  JOIN vessels v ON v.id = cpr.vessel_id
  WHERE cpr.id = NEW.record_id;
  
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create attachment: no organization found for record';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_set_attachment_org
  BEFORE INSERT ON public.control_point_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attachment_org_id();

-- 4. Add RLS policy for control_point_attachments based on organization
DROP POLICY IF EXISTS "Users can view attachments for their org" ON public.control_point_attachments;
CREATE POLICY "Users can view attachments for their org"
  ON public.control_point_attachments
  FOR SELECT
  USING (
    organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    OR public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert attachments for their org" ON public.control_point_attachments;
CREATE POLICY "Users can insert attachments for their org"
  ON public.control_point_attachments
  FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    OR public.is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete attachments for their org" ON public.control_point_attachments;
CREATE POLICY "Users can delete attachments for their org"
  ON public.control_point_attachments
  FOR DELETE
  USING (
    organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    OR public.is_superadmin(auth.uid())
  );

-- 5. For profiles: Add constraint that non-external profiles must have organization_id
-- We use a CHECK constraint since it's a business rule
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_org_required_for_portal_users
CHECK (is_external = true OR organization_id IS NOT NULL);

-- 6. Add trigger to prevent vessels without organization
CREATE OR REPLACE FUNCTION public.enforce_vessel_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'Vessels must belong to an organization';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_enforce_vessel_org
  BEFORE INSERT OR UPDATE ON public.vessels
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vessel_org();
