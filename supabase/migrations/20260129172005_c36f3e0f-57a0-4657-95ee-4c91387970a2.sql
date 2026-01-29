-- CRITICAL SECURITY FIX: Add organization context to all admin policies
-- This prevents admins from one organization seeing/modifying data from other organizations

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is org admin for a booking's organization (via vessel)
CREATE OR REPLACE FUNCTION public.is_booking_org_admin(_user_id uuid, _booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.vessels v ON v.id = b.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE b.id = _booking_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Check if user is org admin for a deviation's organization (via vessel)
CREATE OR REPLACE FUNCTION public.is_deviation_org_admin(_user_id uuid, _deviation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deviations d
    JOIN public.vessels v ON v.id = d.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE d.id = _deviation_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Check if user is org admin for a fault case's organization (via vessel)
CREATE OR REPLACE FUNCTION public.is_fault_org_admin(_user_id uuid, _fault_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fault_cases f
    JOIN public.vessels v ON v.id = f.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE f.id = _fault_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Check if user is org admin for a logbook's organization (via vessel)
CREATE OR REPLACE FUNCTION public.is_logbook_org_admin(_user_id uuid, _logbook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.logbooks l
    JOIN public.vessels v ON v.id = l.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE l.id = _logbook_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- Check if user is org admin for a control point record (via vessel)
CREATE OR REPLACE FUNCTION public.is_control_record_org_admin(_user_id uuid, _record_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.control_point_records cpr
    JOIN public.vessels v ON v.id = cpr.vessel_id
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE cpr.id = _record_id
      AND om.user_id = _user_id
      AND om.role = 'org_admin'
  )
$$;

-- ============================================
-- FIX BOOKING POLICIES
-- ============================================

-- booking_crew
DROP POLICY IF EXISTS "Admin kan hantera bokningsbesättning" ON public.booking_crew;
CREATE POLICY "Org admins can manage booking crew"
  ON public.booking_crew FOR ALL
  USING (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()));

-- booking_drinks
DROP POLICY IF EXISTS "Admin kan hantera bokningsdryck" ON public.booking_drinks;
CREATE POLICY "Org admins can manage booking drinks"
  ON public.booking_drinks FOR ALL
  USING (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()));

-- booking_food
DROP POLICY IF EXISTS "Admin kan hantera bokningsmat" ON public.booking_food;
CREATE POLICY "Org admins can manage booking food"
  ON public.booking_food FOR ALL
  USING (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()));

-- booking_pms
DROP POLICY IF EXISTS "Admin kan radera PM" ON public.booking_pms;
DROP POLICY IF EXISTS "Admin kan skapa PM" ON public.booking_pms;
DROP POLICY IF EXISTS "Admin kan uppdatera PM" ON public.booking_pms;

CREATE POLICY "Org admins can manage booking PMs"
  ON public.booking_pms FOR ALL
  USING (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_booking_org_admin(auth.uid(), booking_id) OR is_superadmin(auth.uid()));

-- bookings
DROP POLICY IF EXISTS "Admin kan skapa bokningar" ON public.bookings;
DROP POLICY IF EXISTS "Admin kan uppdatera bokningar" ON public.bookings;
DROP POLICY IF EXISTS "Admin kan ta bort bokningar" ON public.bookings;

CREATE POLICY "Org admins can manage bookings"
  ON public.bookings FOR ALL
  USING (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()));

-- ============================================
-- FIX DEVIATION POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin kan radera avvikelser" ON public.deviations;
CREATE POLICY "Org admins can delete deviations"
  ON public.deviations FOR DELETE
  USING (is_deviation_org_admin(auth.uid(), id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admin kan radera bilagor" ON public.deviation_attachments;
CREATE POLICY "Org admins can delete deviation attachments"
  ON public.deviation_attachments FOR DELETE
  USING (is_deviation_org_admin(auth.uid(), deviation_id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admin kan hantera återrapportering" ON public.deviation_responses;
CREATE POLICY "Org admins can manage deviation responses"
  ON public.deviation_responses FOR ALL
  USING (is_deviation_org_admin(auth.uid(), deviation_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_deviation_org_admin(auth.uid(), deviation_id) OR is_superadmin(auth.uid()));

-- ============================================
-- FIX FAULT CASE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin kan radera felärenden" ON public.fault_cases;
CREATE POLICY "Org admins can delete fault cases"
  ON public.fault_cases FOR DELETE
  USING (is_fault_org_admin(auth.uid(), id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admin kan radera bilagor" ON public.fault_attachments;
CREATE POLICY "Org admins can delete fault attachments"
  ON public.fault_attachments FOR DELETE
  USING (is_fault_org_admin(auth.uid(), fault_case_id) OR is_superadmin(auth.uid()));

-- ============================================
-- FIX LOGBOOK POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin kan ta bort loggböcker" ON public.logbooks;
CREATE POLICY "Org admins can delete logbooks"
  ON public.logbooks FOR DELETE
  USING (is_logbook_org_admin(auth.uid(), id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Skeppare kan uppdatera öppna loggböcker" ON public.logbooks;
CREATE POLICY "Skeppare and org admins can update logbooks"
  ON public.logbooks FOR UPDATE
  USING (
    (is_admin_or_skeppare(auth.uid()) AND status = 'oppen')
    OR is_logbook_org_admin(auth.uid(), id)
    OR is_superadmin(auth.uid())
  );

-- ============================================
-- FIX CONTROL POINT POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin kan radera kontroller" ON public.control_point_records;
DROP POLICY IF EXISTS "Admin kan registrera kontroller" ON public.control_point_records;
DROP POLICY IF EXISTS "Admin kan uppdatera kontroller" ON public.control_point_records;

CREATE POLICY "Org admins can manage control point records"
  ON public.control_point_records FOR ALL
  USING (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admin kan hantera kontrollpunktsbilagor" ON public.control_point_attachments;
CREATE POLICY "Org admins can manage control point attachments"
  ON public.control_point_attachments FOR ALL
  USING (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    organization_id IN (SELECT get_user_org_ids(auth.uid()))
    OR is_superadmin(auth.uid())
  );

DROP POLICY IF EXISTS "Admin kan hantera tilldelningar" ON public.control_point_vessels;
CREATE POLICY "Org admins can manage control point vessel assignments"
  ON public.control_point_vessels FOR ALL
  USING (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admin kan uppdatera kontrollpunktsstatus" ON public.vessel_control_point_state;
CREATE POLICY "Org admins can manage vessel control point state"
  ON public.vessel_control_point_state FOR ALL
  USING (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()));

-- ============================================
-- FIX CHECKLIST POLICIES
-- ============================================

DROP POLICY IF EXISTS "Admin kan hantera fartygstilldelningar" ON public.checklist_template_vessels;
CREATE POLICY "Org admins can manage checklist vessel assignments"
  ON public.checklist_template_vessels FOR ALL
  USING (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_vessel_org_admin(auth.uid(), vessel_id) OR is_superadmin(auth.uid()));

-- ============================================
-- FIX USER-RELATED POLICIES
-- ============================================

-- user_certificates - the duplicate policy
DROP POLICY IF EXISTS "Admin kan hantera certifikat" ON public.user_certificates;
-- Keep only "Admins can manage certificates in their org" which has proper org check

-- user_vessel_inductions - keep only the org-scoped one
DROP POLICY IF EXISTS "Admin kan hantera inskolningar" ON public.user_vessel_inductions;
-- "Admins can manage inductions in their org" already has proper org check

-- vessel_role_certificates - keep only the org-scoped one  
DROP POLICY IF EXISTS "Admin kan hantera fartygscertifikatkrav" ON public.vessel_role_certificates;
-- "Admins can manage vessel role certificates in their org" already has proper org check

-- ============================================
-- FIX AUDIT LOG POLICY
-- ============================================

DROP POLICY IF EXISTS "Admin kan se ändringsloggar" ON public.audit_logs;
-- Audit logs should only be visible to superadmins or via specific org context
-- For now, restrict to superadmins only
CREATE POLICY "Superadmins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_superadmin(auth.uid()));

-- ============================================
-- USER ROLES - Keep global admin check for roles table
-- This is intentional as it's the roles table itself
-- ============================================
-- user_roles policies are correct - they need global admin check
-- because that's how we determine who is admin