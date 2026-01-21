-- Create function to check if user is crew on a logbook
CREATE OR REPLACE FUNCTION public.is_logbook_crew(_user_id uuid, _logbook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.logbook_crew lc
    JOIN public.profiles p ON p.id = lc.profile_id
    WHERE p.user_id = _user_id
      AND lc.logbook_id = _logbook_id
  )
$$;

-- Create function to check if user is crew on a passenger session
CREATE OR REPLACE FUNCTION public.is_session_crew(_user_id uuid, _session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.passenger_sessions ps
    JOIN public.logbook_crew lc ON lc.logbook_id = ps.logbook_id
    JOIN public.profiles p ON p.id = lc.profile_id
    WHERE p.user_id = _user_id
      AND ps.id = _session_id
  )
$$;

-- Drop existing policies on passenger_sessions
DROP POLICY IF EXISTS "Org members can view sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Skeppare can create sessions" ON public.passenger_sessions;
DROP POLICY IF EXISTS "Skeppare can update sessions" ON public.passenger_sessions;

-- Create new stricter policies for passenger_sessions
CREATE POLICY "Crew can view their sessions"
  ON public.passenger_sessions FOR SELECT
  USING (
    is_logbook_crew(auth.uid(), logbook_id) 
    OR has_role(auth.uid(), 'admin')
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Crew can create sessions"
  ON public.passenger_sessions FOR INSERT
  WITH CHECK (
    is_logbook_crew(auth.uid(), logbook_id)
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Crew can update their sessions"
  ON public.passenger_sessions FOR UPDATE
  USING (
    is_logbook_crew(auth.uid(), logbook_id)
    OR has_role(auth.uid(), 'admin')
  );

-- Drop existing policies on passenger_entries
DROP POLICY IF EXISTS "Org members can view entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Skeppare can create entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Skeppare can update entries" ON public.passenger_entries;
DROP POLICY IF EXISTS "Skeppare can delete entries" ON public.passenger_entries;

-- Create new stricter policies for passenger_entries
CREATE POLICY "Crew can view session entries"
  ON public.passenger_entries FOR SELECT
  USING (
    is_session_crew(auth.uid(), session_id)
    OR has_role(auth.uid(), 'admin')
    OR is_superadmin(auth.uid())
  );

CREATE POLICY "Crew can create entries"
  ON public.passenger_entries FOR INSERT
  WITH CHECK (
    is_session_crew(auth.uid(), session_id)
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Crew can update entries"
  ON public.passenger_entries FOR UPDATE
  USING (
    is_session_crew(auth.uid(), session_id)
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Crew can delete entries"
  ON public.passenger_entries FOR DELETE
  USING (
    is_session_crew(auth.uid(), session_id)
    OR has_role(auth.uid(), 'admin')
  );