-- Update the trigger function to sync based on the HIGHEST role across all organizations
CREATE OR REPLACE FUNCTION public.sync_org_role_to_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _has_org_admin BOOLEAN;
  _has_org_user BOOLEAN;
BEGIN
  -- Determine which user_id to check
  IF TG_OP = 'DELETE' THEN
    _user_id := OLD.user_id;
  ELSE
    _user_id := NEW.user_id;
  END IF;

  -- Check all organization memberships for this user
  SELECT 
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND role = 'org_admin'),
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND role = 'org_user')
  INTO _has_org_admin, _has_org_user;

  -- Remove existing synced roles
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id 
  AND role IN ('admin', 'skeppare');

  -- Add the highest applicable role
  IF _has_org_admin THEN
    -- User is admin in at least one org → gets admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _has_org_user THEN
    -- User is only org_user in all orgs → gets skeppare role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'skeppare')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  -- If user has no org memberships, they get no portal roles

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_org_role_trigger ON public.organization_members;

-- Recreate trigger for INSERT, UPDATE, and DELETE
CREATE TRIGGER sync_org_role_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_role_to_user_role();