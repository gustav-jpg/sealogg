-- Create trigger to sync organization roles to portal roles
CREATE OR REPLACE FUNCTION public.sync_org_role_to_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Remove any existing synced roles for this user
    DELETE FROM public.user_roles 
    WHERE user_id = NEW.user_id 
    AND role IN ('admin', 'skeppare');
    
    -- Add role based on org role
    IF NEW.role = 'org_admin' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSIF NEW.role = 'org_user' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, 'skeppare')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Check if user has other org memberships
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE user_id = OLD.user_id AND id != OLD.id
    ) THEN
      -- No other memberships, remove portal roles
      DELETE FROM public.user_roles 
      WHERE user_id = OLD.user_id 
      AND role IN ('admin', 'skeppare');
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS sync_org_role_trigger ON public.organization_members;
CREATE TRIGGER sync_org_role_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_role_to_user_role();