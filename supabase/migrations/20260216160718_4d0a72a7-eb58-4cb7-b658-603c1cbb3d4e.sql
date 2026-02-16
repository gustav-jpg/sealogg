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
  _has_deckhand BOOLEAN;
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
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND role = 'org_user'),
    EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = _user_id AND role = 'deckhand')
  INTO _has_org_admin, _has_org_user, _has_deckhand;

  -- Remove ALL existing synced roles (including readonly to avoid unique constraint violations)
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id 
  AND role IN ('admin', 'skeppare', 'deckhand', 'readonly');

  -- Add the highest applicable role
  IF _has_org_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _has_org_user THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'skeppare')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF _has_deckhand THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'deckhand')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;