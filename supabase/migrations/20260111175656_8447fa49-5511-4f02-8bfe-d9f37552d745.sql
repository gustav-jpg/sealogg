-- Tighten RLS role scopes to authenticated only and remove overly-permissive policies

-- PROFILES
DROP POLICY IF EXISTS "Users can view profiles in their organizations" ON public.profiles;
DROP POLICY IF EXISTS "Användare kan skapa sin profil" ON public.profiles;
DROP POLICY IF EXISTS "Användare kan uppdatera sin profil" ON public.profiles;
DROP POLICY IF EXISTS "Admin kan ta bort externa profiler" ON public.profiles;

CREATE POLICY "Users can view profiles in their organizations"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid())
  OR (
    user_id IN (
      SELECT om.user_id
      FROM public.organization_members om
      WHERE om.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  )
  OR (
    is_external = true
    AND id IN (
      SELECT lc.profile_id
      FROM public.logbook_crew lc
      JOIN public.logbooks l ON l.id = lc.logbook_id
      JOIN public.vessels v ON v.id = l.vessel_id
      WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
    )
  )
);

CREATE POLICY "Users can insert own profile / admins can insert external"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  OR (is_external = true AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users can update own profile / admins can update external"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR (is_external = true AND public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Admins can delete external profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (is_external = true AND public.has_role(auth.uid(), 'admin'));


-- ORGANIZATIONS
DROP POLICY IF EXISTS "Medlemmar kan se sin organisation" ON public.organizations;

CREATE POLICY "Members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_org_ids(auth.uid())));


-- BOOKINGS
DROP POLICY IF EXISTS "Organisationsmedlemmar kan se bokningar" ON public.bookings;

CREATE POLICY "Organisationsmedlemmar kan se bokningar"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id
    FROM public.vessels v
    WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);


-- BOOKING PMS
-- Remove the overly-permissive policy that allowed any logged-in user to see all PMs
DROP POLICY IF EXISTS "Inloggade kan se PM" ON public.booking_pms;

-- Ensure org-scoped policy is only for authenticated users
DROP POLICY IF EXISTS "Organisationsmedlemmar kan se PM" ON public.booking_pms;
CREATE POLICY "Organisationsmedlemmar kan se PM"
ON public.booking_pms
FOR SELECT
TO authenticated
USING (
  booking_id IN (
    SELECT b.id
    FROM public.bookings b
    JOIN public.vessels v ON v.id = b.vessel_id
    WHERE v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);
