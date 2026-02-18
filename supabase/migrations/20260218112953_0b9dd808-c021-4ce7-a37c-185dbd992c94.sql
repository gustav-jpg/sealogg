
-- 1. Drop the old restrictive UPDATE policy
DROP POLICY IF EXISTS "Admin och skeppare kan uppdatera felärenden" ON public.fault_cases;

-- 2. Create new UPDATE policy allowing all org members to update
CREATE POLICY "Organisationsmedlemmar kan uppdatera felärenden"
ON public.fault_cases
FOR UPDATE
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
)
WITH CHECK (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- 3. Create validation trigger: only admins can set status to 'avslutad'
CREATE OR REPLACE FUNCTION public.enforce_fault_close_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status is being changed to 'avslutad', require admin role
  IF NEW.status = 'avslutad' AND (OLD.status IS DISTINCT FROM 'avslutad') THEN
    IF NOT has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Endast administratörer kan avsluta felärenden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_fault_close_admin
BEFORE UPDATE ON public.fault_cases
FOR EACH ROW
EXECUTE FUNCTION public.enforce_fault_close_admin_only();
