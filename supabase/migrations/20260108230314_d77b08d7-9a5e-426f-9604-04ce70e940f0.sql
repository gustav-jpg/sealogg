-- Fix: Profiles table - only authenticated users can see profiles
DROP POLICY IF EXISTS "Alla kan se profiler" ON public.profiles;
CREATE POLICY "Inloggade kan se profiler" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Fix: Logbooks - only organization members can see
DROP POLICY IF EXISTS "Alla kan se loggböcker" ON public.logbooks;
CREATE POLICY "Organisationsmedlemmar kan se loggböcker" 
ON public.logbooks 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Fault cases - only organization members can see
DROP POLICY IF EXISTS "Alla inloggade kan se felärenden" ON public.fault_cases;
CREATE POLICY "Organisationsmedlemmar kan se felärenden" 
ON public.fault_cases 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Deviations - only organization members can see
DROP POLICY IF EXISTS "Alla inloggade kan se avvikelser" ON public.deviations;
CREATE POLICY "Organisationsmedlemmar kan se avvikelser" 
ON public.deviations 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: User certificates - only same organization or own
DROP POLICY IF EXISTS "Användare och skeppare kan se certifikat" ON public.user_certificates;
CREATE POLICY "Organisationsmedlemmar kan se certifikat" 
ON public.user_certificates 
FOR SELECT 
TO authenticated
USING (
  profile_id IN (
    SELECT p.id FROM profiles p
    WHERE p.user_id = auth.uid()
  )
  OR 
  profile_id IN (
    SELECT p.id FROM profiles p
    JOIN organization_members om ON om.user_id = p.user_id
    WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
  OR has_role(auth.uid(), 'admin')
);

-- Fix: Vessel certificates - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se fartygscertifikat" ON public.vessel_certificates;
CREATE POLICY "Organisationsmedlemmar kan se fartygscertifikat" 
ON public.vessel_certificates 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Logbook crew - only organization members
DROP POLICY IF EXISTS "Alla kan se besättning" ON public.logbook_crew;
CREATE POLICY "Organisationsmedlemmar kan se besättning" 
ON public.logbook_crew 
FOR SELECT 
TO authenticated
USING (
  logbook_id IN (
    SELECT l.id FROM logbooks l
    JOIN vessels v ON v.id = l.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Logbook engine hours - only organization members
DROP POLICY IF EXISTS "Alla kan se maskintimmar" ON public.logbook_engine_hours;
CREATE POLICY "Organisationsmedlemmar kan se maskintimmar" 
ON public.logbook_engine_hours 
FOR SELECT 
TO authenticated
USING (
  logbook_id IN (
    SELECT l.id FROM logbooks l
    JOIN vessels v ON v.id = l.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Vessel engine hours - only organization members
DROP POLICY IF EXISTS "Alla kan se maskintimmar" ON public.vessel_engine_hours;
CREATE POLICY "Organisationsmedlemmar kan se maskintimmar" 
ON public.vessel_engine_hours 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: User vessel inductions - only organization members
DROP POLICY IF EXISTS "Alla kan se inskolningar" ON public.user_vessel_inductions;
CREATE POLICY "Organisationsmedlemmar kan se inskolningar" 
ON public.user_vessel_inductions 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
  OR profile_id IN (SELECT p.id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Fix: Control point records - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se historik" ON public.control_point_records;
CREATE POLICY "Organisationsmedlemmar kan se historik" 
ON public.control_point_records 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Vessel control point state - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se status" ON public.vessel_control_point_state;
CREATE POLICY "Organisationsmedlemmar kan se status" 
ON public.vessel_control_point_state 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Control point attachments - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se bilagor" ON public.control_point_attachments;
CREATE POLICY "Organisationsmedlemmar kan se bilagor" 
ON public.control_point_attachments 
FOR SELECT 
TO authenticated
USING (
  record_id IN (
    SELECT cpr.id FROM control_point_records cpr
    JOIN vessels v ON v.id = cpr.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Deviation attachments - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se bilagor" ON public.deviation_attachments;
CREATE POLICY "Organisationsmedlemmar kan se avvikelsebilagor" 
ON public.deviation_attachments 
FOR SELECT 
TO authenticated
USING (
  deviation_id IN (
    SELECT d.id FROM deviations d
    JOIN vessels v ON v.id = d.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Fault attachments - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se bilagor" ON public.fault_attachments;
CREATE POLICY "Organisationsmedlemmar kan se felbilagor" 
ON public.fault_attachments 
FOR SELECT 
TO authenticated
USING (
  fault_case_id IN (
    SELECT fc.id FROM fault_cases fc
    JOIN vessels v ON v.id = fc.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Fault comments - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se kommentarer" ON public.fault_comments;
CREATE POLICY "Organisationsmedlemmar kan se kommentarer" 
ON public.fault_comments 
FOR SELECT 
TO authenticated
USING (
  fault_case_id IN (
    SELECT fc.id FROM fault_cases fc
    JOIN vessels v ON v.id = fc.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Deviation actions - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se åtgärder" ON public.deviation_actions;
CREATE POLICY "Organisationsmedlemmar kan se åtgärder" 
ON public.deviation_actions 
FOR SELECT 
TO authenticated
USING (
  deviation_id IN (
    SELECT d.id FROM deviations d
    JOIN vessels v ON v.id = d.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Deviation responses - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se återrapportering" ON public.deviation_responses;
CREATE POLICY "Organisationsmedlemmar kan se återrapportering" 
ON public.deviation_responses 
FOR SELECT 
TO authenticated
USING (
  deviation_id IN (
    SELECT d.id FROM deviations d
    JOIN vessels v ON v.id = d.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Crew requirements - only organization members
DROP POLICY IF EXISTS "Alla kan se bemanningskrav" ON public.vessel_crew_requirements;
CREATE POLICY "Organisationsmedlemmar kan se bemanningskrav" 
ON public.vessel_crew_requirements 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Role certificates - only organization members
DROP POLICY IF EXISTS "Alla kan se fartygscertifikatkrav" ON public.vessel_role_certificates;
CREATE POLICY "Organisationsmedlemmar kan se fartygscertifikatkrav" 
ON public.vessel_role_certificates 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- Fix: Control point vessels - only organization members
DROP POLICY IF EXISTS "Alla inloggade kan se tilldelningar" ON public.control_point_vessels;
CREATE POLICY "Organisationsmedlemmar kan se tilldelningar" 
ON public.control_point_vessels 
FOR SELECT 
TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v 
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);