
-- =====================================================
-- FULL ORGANIZATION ISOLATION MIGRATION
-- =====================================================

-- 1. Add organization_id to menus
ALTER TABLE public.menus ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
UPDATE public.menus SET organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b' WHERE organization_id IS NULL;
ALTER TABLE public.menus ALTER COLUMN organization_id SET NOT NULL;

-- 2. Add organization_id to drink_packages
ALTER TABLE public.drink_packages ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
UPDATE public.drink_packages SET organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b' WHERE organization_id IS NULL;
ALTER TABLE public.drink_packages ALTER COLUMN organization_id SET NOT NULL;

-- 3. Add organization_id to drink_extras
ALTER TABLE public.drink_extras ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
UPDATE public.drink_extras SET organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b' WHERE organization_id IS NULL;
ALTER TABLE public.drink_extras ALTER COLUMN organization_id SET NOT NULL;

-- 4. Add organization_id to certificate_types (shared certs become org-specific)
ALTER TABLE public.certificate_types ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
UPDATE public.certificate_types SET organization_id = 'd142de75-2a6d-4692-a754-44f547b13b3b' WHERE organization_id IS NULL;
ALTER TABLE public.certificate_types ALTER COLUMN organization_id SET NOT NULL;

-- =====================================================
-- UPDATE RLS POLICIES - MENUS
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera menyer" ON public.menus;
DROP POLICY IF EXISTS "Alla inloggade kan se aktiva menyer" ON public.menus;

CREATE POLICY "Org members can view menus"
ON public.menus FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage menus in their org"
ON public.menus FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

-- =====================================================
-- UPDATE RLS POLICIES - DRINK PACKAGES
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera dryckespaket" ON public.drink_packages;
DROP POLICY IF EXISTS "Alla inloggade kan se aktiva dryckespaket" ON public.drink_packages;

CREATE POLICY "Org members can view drink packages"
ON public.drink_packages FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage drink packages in their org"
ON public.drink_packages FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

-- =====================================================
-- UPDATE RLS POLICIES - DRINK EXTRAS
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera dryckestillval" ON public.drink_extras;
DROP POLICY IF EXISTS "Alla inloggade kan se aktiva dryckestillval" ON public.drink_extras;

CREATE POLICY "Org members can view drink extras"
ON public.drink_extras FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage drink extras in their org"
ON public.drink_extras FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

-- =====================================================
-- UPDATE RLS POLICIES - CERTIFICATE TYPES
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera certifikattyper" ON public.certificate_types;
DROP POLICY IF EXISTS "Alla kan se certifikattyper" ON public.certificate_types;

CREATE POLICY "Org members can view certificate types"
ON public.certificate_types FOR SELECT TO authenticated
USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage certificate types in their org"
ON public.certificate_types FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND organization_id IN (SELECT get_user_org_ids(auth.uid()))
);

-- =====================================================
-- UPDATE RLS POLICIES - CHECKLIST STEPS (filter by template org)
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera checkliststeg" ON public.checklist_steps;
DROP POLICY IF EXISTS "Alla inloggade kan se checkliststeg" ON public.checklist_steps;

CREATE POLICY "Org members can view checklist steps"
ON public.checklist_steps FOR SELECT TO authenticated
USING (
  checklist_template_id IN (
    SELECT id FROM checklist_templates 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage checklist steps in their org"
ON public.checklist_steps FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND checklist_template_id IN (
    SELECT id FROM checklist_templates 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - PROFILES (only see org members)
-- =====================================================
DROP POLICY IF EXISTS "Inloggade kan se profiler" ON public.profiles;

CREATE POLICY "Users can view profiles in their organizations"
ON public.profiles FOR SELECT TO authenticated
USING (
  -- Own profile
  user_id = auth.uid()
  OR
  -- Profiles of users in same orgs
  user_id IN (
    SELECT om.user_id FROM organization_members om
    WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
  OR
  -- External profiles linked to vessels in user's orgs (for crew selection)
  (is_external = true AND id IN (
    SELECT lc.profile_id FROM logbook_crew lc
    JOIN logbooks l ON l.id = lc.logbook_id
    JOIN vessels v ON v.id = l.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  ))
);

-- =====================================================
-- UPDATE RLS POLICIES - USER CERTIFICATES
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera användarcertifikat" ON public.user_certificates;
DROP POLICY IF EXISTS "Användare kan se sina certifikat" ON public.user_certificates;

CREATE POLICY "Users can view certificates in their org"
ON public.user_certificates FOR SELECT TO authenticated
USING (
  profile_id IN (
    SELECT p.id FROM profiles p
    WHERE p.user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
    OR (p.is_external = true AND p.id IN (
      SELECT lc.profile_id FROM logbook_crew lc
      JOIN logbooks l ON l.id = lc.logbook_id
      JOIN vessels v ON v.id = l.vessel_id
      WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    ))
  )
);

CREATE POLICY "Admins can manage certificates in their org"
ON public.user_certificates FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND profile_id IN (
    SELECT p.id FROM profiles p
    WHERE p.user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (SELECT get_user_org_ids(auth.uid()))
    )
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - USER VESSEL INDUCTIONS
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera introduktioner" ON public.user_vessel_inductions;
DROP POLICY IF EXISTS "Användare kan se sina introduktioner" ON public.user_vessel_inductions;

CREATE POLICY "Org members can view inductions"
ON public.user_vessel_inductions FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage inductions in their org"
ON public.user_vessel_inductions FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - VESSEL CREW REQUIREMENTS
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera bemanningskrav" ON public.vessel_crew_requirements;
DROP POLICY IF EXISTS "Alla kan se bemanningskrav" ON public.vessel_crew_requirements;

CREATE POLICY "Org members can view crew requirements"
ON public.vessel_crew_requirements FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage crew requirements in their org"
ON public.vessel_crew_requirements FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - VESSEL ROLE CERTIFICATES
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera rollcertifikat" ON public.vessel_role_certificates;
DROP POLICY IF EXISTS "Alla kan se rollcertifikat" ON public.vessel_role_certificates;

CREATE POLICY "Org members can view vessel role certificates"
ON public.vessel_role_certificates FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage vessel role certificates in their org"
ON public.vessel_role_certificates FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - VESSEL ENGINE HOURS
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera maskintimmar" ON public.vessel_engine_hours;
DROP POLICY IF EXISTS "Alla kan se maskintimmar" ON public.vessel_engine_hours;

CREATE POLICY "Org members can view engine hours"
ON public.vessel_engine_hours FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage engine hours in their org"
ON public.vessel_engine_hours FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - VESSEL CERTIFICATES
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera fartygscertifikat" ON public.vessel_certificates;
DROP POLICY IF EXISTS "Alla kan se fartygscertifikat" ON public.vessel_certificates;

CREATE POLICY "Org members can view vessel certificates"
ON public.vessel_certificates FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage vessel certificates in their org"
ON public.vessel_certificates FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

-- =====================================================
-- UPDATE RLS POLICIES - VESSEL CONTROL POINT STATE
-- =====================================================
DROP POLICY IF EXISTS "Admin kan hantera kontrollpunktstillstånd" ON public.vessel_control_point_state;
DROP POLICY IF EXISTS "Alla kan se kontrollpunktstillstånd" ON public.vessel_control_point_state;

CREATE POLICY "Org members can view control point state"
ON public.vessel_control_point_state FOR SELECT TO authenticated
USING (
  vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);

CREATE POLICY "Admins can manage control point state in their org"
ON public.vessel_control_point_state FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND vessel_id IN (
    SELECT v.id FROM vessels v
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  )
);
