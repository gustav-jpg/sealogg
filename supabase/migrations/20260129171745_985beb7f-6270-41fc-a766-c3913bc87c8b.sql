-- Fix RLS policies for passenger_sessions to require organization context
-- The current policies allow admins to see ALL sessions regardless of organization

-- Drop existing policies
DROP POLICY IF EXISTS "Crew can view their sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Crew can create sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Crew can update their sessions" ON public.passenger_sessions;

-- Create helper function to check if user is admin for a session's organization
CREATE OR REPLACE FUNCTION public.is_session_org_admin(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.passenger_sessions ps
    JOIN public.vessels v ON v.id = ps.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE ps.id = _session_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Create helper function to check if user is admin for a vessel's organization
CREATE OR REPLACE FUNCTION public.is_vessel_org_admin(_user_id uuid, _vessel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vessels v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE v.id = _vessel_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Create new RLS policies with proper organization scoping
CREATE POLICY "Crew and org admins can view sessions"
  ON public.passenger_sessions FOR SELECT
  USING (
    is_logbook_crew(auth.uid(), logbook_id) 
    OR is_vessel_org_admin(auth.uid(), vessel_id)
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Crew and org admins can create sessions"
  ON public.passenger_sessions FOR INSERT
  WITH CHECK (
    is_logbook_crew(auth.uid(), logbook_id)
    OR is_vessel_org_admin(auth.uid(), vessel_id)
  );

CREATE POLICY "Crew and org admins can update sessions"
  ON public.passenger_sessions FOR UPDATE
  USING (
    is_logbook_crew(auth.uid(), logbook_id)
    OR is_vessel_org_admin(auth.uid(), vessel_id)
  );

-- Also fix passenger_entries policies
DROP POLICY IF EXISTS "Crew can view session entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Crew can create entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Crew can update entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Crew can delete entries" ON public.passenger_entries;

CREATE POLICY "Crew and org admins can view entries"
  ON public.passenger_entries FOR SELECT
  USING (
    is_session_crew(auth.uid(), session_id)
    OR is_session_org_admin(auth.uid(), session_id)
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Crew and org admins can create entries"
  ON public.passenger_entries FOR INSERT
  WITH CHECK (
    is_session_crew(auth.uid(), session_id)
    OR is_session_org_admin(auth.uid(), session_id)
  );

CREATE POLICY "Crew and org admins can update entries"
  ON public.passenger_entries FOR UPDATE
  USING (
    is_session_crew(auth.uid(), session_id)
    OR is_session_org_admin(auth.uid(), session_id)
  );

CREATE POLICY "Crew and org admins can delete entries"
  ON public.passenger_entries FOR DELETE
  USING (
    is_session_crew(auth.uid(), session_id)
    OR is_session_org_admin(auth.uid(), session_id)
  );