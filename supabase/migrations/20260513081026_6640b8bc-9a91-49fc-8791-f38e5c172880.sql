
-- =====================================================================
-- BOOKING MODULE — PHASE 1: Schema, RLS, helpers
-- All tables prefixed bk_ to isolate from existing live data
-- =====================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE bk_booking_status AS ENUM ('pending','reserved','paid','cancelled','refunded','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bk_ticket_status AS ENUM ('valid','used','void');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bk_departure_status AS ENUM ('scheduled','open','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bk_check_in_method AS ENUM ('scan','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SETTINGS (one per org) ----------
CREATE TABLE public.bk_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_slug text UNIQUE,
  is_public_active boolean NOT NULL DEFAULT false,
  brand_color text DEFAULT '#0A1628',
  logo_url text,
  contact_email text,
  contact_phone text,
  currency text NOT NULL DEFAULT 'SEK',
  terms_url text,
  reservation_ttl_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- PIERS ----------
CREATE TABLE public.bk_piers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  lat numeric(10,7),
  lng numeric(10,7),
  info text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_piers_org_idx ON public.bk_piers(organization_id);

-- ---------- LINES ----------
CREATE TABLE public.bk_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  description text,
  color text DEFAULT '#0A84FF',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_lines_org_idx ON public.bk_lines(organization_id);

-- ---------- ROUTES ----------
CREATE TABLE public.bk_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES public.bk_lines(id) ON DELETE CASCADE,
  name text NOT NULL,
  direction text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_routes_org_idx ON public.bk_routes(organization_id);
CREATE INDEX bk_routes_line_idx ON public.bk_routes(line_id);

-- ---------- ROUTE STOPS ----------
CREATE TABLE public.bk_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.bk_routes(id) ON DELETE CASCADE,
  pier_id uuid NOT NULL REFERENCES public.bk_piers(id) ON DELETE RESTRICT,
  stop_order integer NOT NULL,
  boarding_allowed boolean NOT NULL DEFAULT true,
  alighting_allowed boolean NOT NULL DEFAULT true,
  arrival_offset_min integer NOT NULL DEFAULT 0,
  departure_offset_min integer NOT NULL DEFAULT 0,
  dwell_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, stop_order)
);
CREATE INDEX bk_route_stops_route_idx ON public.bk_route_stops(route_id);
CREATE INDEX bk_route_stops_pier_idx ON public.bk_route_stops(pier_id);

-- ---------- TICKET TYPES ----------
CREATE TABLE public.bk_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  occupies_seat boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

-- ---------- FARE RULES ----------
CREATE TABLE public.bk_fare_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  line_id uuid REFERENCES public.bk_lines(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.bk_routes(id) ON DELETE CASCADE,
  from_pier_id uuid REFERENCES public.bk_piers(id) ON DELETE CASCADE,
  to_pier_id uuid REFERENCES public.bk_piers(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.bk_ticket_types(id) ON DELETE CASCADE,
  weekday_mask integer NOT NULL DEFAULT 127, -- bits 0-6 = Mon-Sun
  valid_from date,
  valid_to date,
  price_sek numeric(10,2) NOT NULL,
  return_discount_pct numeric(5,2) NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 100, -- lower = applied first
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_fare_rules_org_idx ON public.bk_fare_rules(organization_id);

-- ---------- SCHEDULES ----------
CREATE TABLE public.bk_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.bk_routes(id) ON DELETE CASCADE,
  vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  name text NOT NULL,
  weekday_mask integer NOT NULL DEFAULT 127,
  start_date date NOT NULL,
  end_date date,
  depart_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_schedules_org_idx ON public.bk_schedules(organization_id);

-- ---------- DEPARTURES ----------
CREATE TABLE public.bk_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.bk_routes(id) ON DELETE RESTRICT,
  schedule_id uuid REFERENCES public.bk_schedules(id) ON DELETE SET NULL,
  vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  departure_at timestamptz NOT NULL,
  capacity_override integer,
  status bk_departure_status NOT NULL DEFAULT 'open',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_departures_org_date_idx ON public.bk_departures(organization_id, departure_at);
CREATE INDEX bk_departures_route_idx ON public.bk_departures(route_id, departure_at);

-- ---------- DEPARTURE STOP TIMES ----------
CREATE TABLE public.bk_departure_stop_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_id uuid NOT NULL REFERENCES public.bk_departures(id) ON DELETE CASCADE,
  route_stop_id uuid NOT NULL REFERENCES public.bk_route_stops(id) ON DELETE CASCADE,
  stop_order integer NOT NULL,
  arrive_at timestamptz,
  depart_at timestamptz,
  UNIQUE (departure_id, route_stop_id)
);
CREATE INDEX bk_dst_dep_idx ON public.bk_departure_stop_times(departure_id, stop_order);

-- ---------- BOOKINGS ----------
CREATE TABLE public.bk_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  booking_number text NOT NULL,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_sek numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SEK',
  status bk_booking_status NOT NULL DEFAULT 'pending',
  reservation_expires_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, booking_number)
);
CREATE INDEX bk_bookings_org_idx ON public.bk_bookings(organization_id, created_at DESC);
CREATE INDEX bk_bookings_status_idx ON public.bk_bookings(status, reservation_expires_at);

-- ---------- BOOKING LEGS ----------
CREATE TABLE public.bk_booking_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  departure_id uuid NOT NULL REFERENCES public.bk_departures(id) ON DELETE RESTRICT,
  from_route_stop_id uuid NOT NULL REFERENCES public.bk_route_stops(id) ON DELETE RESTRICT,
  to_route_stop_id uuid NOT NULL REFERENCES public.bk_route_stops(id) ON DELETE RESTRICT,
  return_of_leg_id uuid REFERENCES public.bk_booking_legs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_legs_booking_idx ON public.bk_booking_legs(booking_id);
CREATE INDEX bk_legs_dep_idx ON public.bk_booking_legs(departure_id);

-- ---------- BOOKING PASSENGERS (qty per ticket type per leg) ----------
CREATE TABLE public.bk_booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id uuid NOT NULL REFERENCES public.bk_booking_legs(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.bk_ticket_types(id) ON DELETE RESTRICT,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_sek numeric(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX bk_pass_leg_idx ON public.bk_booking_passengers(leg_id);

-- ---------- TICKETS (one per seat) ----------
CREATE TABLE public.bk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  leg_id uuid NOT NULL REFERENCES public.bk_booking_legs(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.bk_ticket_types(id) ON DELETE RESTRICT,
  qr_token text NOT NULL UNIQUE,
  status bk_ticket_status NOT NULL DEFAULT 'valid',
  passenger_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_tickets_booking_idx ON public.bk_tickets(booking_id);
CREATE INDEX bk_tickets_leg_idx ON public.bk_tickets(leg_id);

-- ---------- CHECK-INS ----------
CREATE TABLE public.bk_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.bk_tickets(id) ON DELETE CASCADE,
  departure_id uuid NOT NULL REFERENCES public.bk_departures(id) ON DELETE CASCADE,
  route_stop_id uuid REFERENCES public.bk_route_stops(id) ON DELETE SET NULL,
  checked_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  method bk_check_in_method NOT NULL DEFAULT 'scan',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, departure_id)
);
CREATE INDEX bk_checkins_dep_idx ON public.bk_check_ins(departure_id);

-- ---------- REFUNDS ----------
CREATE TABLE public.bk_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bk_bookings(id) ON DELETE CASCADE,
  amount_sek numeric(10,2) NOT NULL,
  reason text,
  stripe_refund_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_refunds_booking_idx ON public.bk_refunds(booking_id);

-- ---------- AUDIT LOG ----------
CREATE TABLE public.bk_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bk_audit_org_idx ON public.bk_audit_log(organization_id, created_at DESC);

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

-- Generate booking numbers (BK-YYMMDD-XXXX)
CREATE OR REPLACE FUNCTION public.bk_generate_booking_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  IF NEW.booking_number IS NOT NULL AND length(NEW.booking_number) > 0 THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := 'BK-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.bk_bookings WHERE organization_id = NEW.organization_id AND booking_number = candidate
    );
    attempts := attempts + 1;
    IF attempts > 50 THEN RAISE EXCEPTION 'Could not generate unique booking number'; END IF;
  END LOOP;
  NEW.booking_number := candidate;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bk_bookings_number_trg
BEFORE INSERT ON public.bk_bookings
FOR EACH ROW EXECUTE FUNCTION public.bk_generate_booking_number();

-- updated_at triggers
CREATE TRIGGER bk_settings_uat BEFORE UPDATE ON public.bk_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_piers_uat BEFORE UPDATE ON public.bk_piers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_lines_uat BEFORE UPDATE ON public.bk_lines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_routes_uat BEFORE UPDATE ON public.bk_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_ticket_types_uat BEFORE UPDATE ON public.bk_ticket_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_fare_rules_uat BEFORE UPDATE ON public.bk_fare_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_schedules_uat BEFORE UPDATE ON public.bk_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_departures_uat BEFORE UPDATE ON public.bk_departures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bk_bookings_uat BEFORE UPDATE ON public.bk_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolve org by public slug (for public booking page; only active)
CREATE OR REPLACE FUNCTION public.bk_get_org_by_public_slug(_slug text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.organization_id
  FROM public.bk_settings s
  WHERE s.public_slug = _slug
    AND s.is_public_active = true
    AND public.org_has_module(s.organization_id, 'bookings'::app_module)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.bk_get_org_by_public_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bk_get_org_by_public_slug(text) TO anon, authenticated;

-- Segment availability: returns smallest available capacity across the segments
-- the requested journey (from_route_stop_id -> to_route_stop_id) covers.
CREATE OR REPLACE FUNCTION public.bk_segment_availability(
  _departure_id uuid,
  _from_stop_id uuid,
  _to_stop_id uuid
) RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_from_order integer;
  v_to_order integer;
  v_min_available integer;
BEGIN
  SELECT COALESCE(d.capacity_override, v.capacity, 0)
  INTO v_capacity
  FROM public.bk_departures d
  LEFT JOIN public.vessels v ON v.id = d.vessel_id
  WHERE d.id = _departure_id;

  IF v_capacity IS NULL OR v_capacity <= 0 THEN RETURN 0; END IF;

  SELECT rs.stop_order INTO v_from_order FROM public.bk_route_stops rs WHERE rs.id = _from_stop_id;
  SELECT rs.stop_order INTO v_to_order FROM public.bk_route_stops rs WHERE rs.id = _to_stop_id;

  IF v_from_order IS NULL OR v_to_order IS NULL OR v_from_order >= v_to_order THEN RETURN 0; END IF;

  -- For every segment [i, i+1] the requested journey covers, compute
  -- capacity minus the sum of seats currently occupied on that segment by
  -- legs whose booking is still active (paid or held within reservation TTL).
  WITH segments AS (
    SELECT generate_series(v_from_order, v_to_order - 1) AS seg_start
  ),
  occupied AS (
    SELECT s.seg_start, COALESCE(SUM(bp.qty), 0)::int AS seats
    FROM segments s
    LEFT JOIN public.bk_booking_legs l ON l.departure_id = _departure_id
    LEFT JOIN public.bk_route_stops fs ON fs.id = l.from_route_stop_id
    LEFT JOIN public.bk_route_stops ts ON ts.id = l.to_route_stop_id
    LEFT JOIN public.bk_bookings b ON b.id = l.booking_id
    LEFT JOIN public.bk_booking_passengers bp ON bp.leg_id = l.id
    LEFT JOIN public.bk_ticket_types tt ON tt.id = bp.ticket_type_id AND tt.occupies_seat = true
    WHERE l.id IS NULL OR (
      fs.stop_order <= s.seg_start
      AND ts.stop_order >= s.seg_start + 1
      AND tt.id IS NOT NULL
      AND (
        b.status = 'paid'
        OR (b.status IN ('pending','reserved') AND b.reservation_expires_at IS NOT NULL AND b.reservation_expires_at > now())
      )
    )
    GROUP BY s.seg_start
  )
  SELECT MIN(v_capacity - seats) INTO v_min_available FROM occupied;

  RETURN GREATEST(COALESCE(v_min_available, v_capacity), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.bk_segment_availability(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bk_segment_availability(uuid, uuid, uuid) TO anon, authenticated;

-- Helper: is current user member of the org (any role)
CREATE OR REPLACE FUNCTION public.bk_is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  )
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE public.bk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_piers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_fare_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_departure_stop_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_booking_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bk_audit_log ENABLE ROW LEVEL SECURITY;

-- Generic: org members can SELECT, org admins or superadmins can manage.
-- Settings
CREATE POLICY "bk_settings_select" ON public.bk_settings FOR SELECT TO authenticated
USING (public.bk_is_org_member(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "bk_settings_manage" ON public.bk_settings FOR ALL TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));

-- Piers / Lines / Routes / RouteStops / TicketTypes / FareRules / Schedules
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['bk_piers','bk_lines','bk_routes','bk_ticket_types','bk_fare_rules','bk_schedules','bk_departures']) LOOP
    EXECUTE format('CREATE POLICY "%s_select" ON public.%I FOR SELECT TO authenticated USING (public.bk_is_org_member(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_manage" ON public.%I FOR ALL TO authenticated USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid())) WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Route stops (joined via route)
CREATE POLICY "bk_route_stops_select" ON public.bk_route_stops FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_routes r WHERE r.id = route_id AND (public.bk_is_org_member(auth.uid(), r.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_route_stops_manage" ON public.bk_route_stops FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_routes r WHERE r.id = route_id AND (public.is_org_admin(auth.uid(), r.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_routes r WHERE r.id = route_id AND (public.is_org_admin(auth.uid(), r.organization_id) OR public.is_superadmin(auth.uid()))));

-- Departure stop times (joined via departure)
CREATE POLICY "bk_dst_select" ON public.bk_departure_stop_times FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.bk_is_org_member(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_dst_manage" ON public.bk_departure_stop_times FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.is_org_admin(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.is_org_admin(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));

-- Bookings — admins and superadmins. Inserts come from edge functions (service role).
CREATE POLICY "bk_bookings_select" ON public.bk_bookings FOR SELECT TO authenticated
USING (public.bk_is_org_member(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "bk_bookings_manage" ON public.bk_bookings FOR ALL TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));

-- Booking legs / passengers / tickets — joined via booking
CREATE POLICY "bk_legs_select" ON public.bk_booking_legs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.bk_is_org_member(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_legs_manage" ON public.bk_booking_legs FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));

CREATE POLICY "bk_pass_select" ON public.bk_booking_passengers FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_booking_legs l JOIN public.bk_bookings b ON b.id = l.booking_id WHERE l.id = leg_id AND (public.bk_is_org_member(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_pass_manage" ON public.bk_booking_passengers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_booking_legs l JOIN public.bk_bookings b ON b.id = l.booking_id WHERE l.id = leg_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_booking_legs l JOIN public.bk_bookings b ON b.id = l.booking_id WHERE l.id = leg_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));

CREATE POLICY "bk_tickets_select" ON public.bk_tickets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.bk_is_org_member(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_tickets_manage" ON public.bk_tickets FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));

-- Check-ins — any org member can see and create (crew checks people in)
CREATE POLICY "bk_checkins_select" ON public.bk_check_ins FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.bk_is_org_member(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_checkins_insert" ON public.bk_check_ins FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.bk_is_org_member(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_checkins_admin_update" ON public.bk_check_ins FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.is_org_admin(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.is_org_admin(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_checkins_admin_delete" ON public.bk_check_ins FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_departures d WHERE d.id = departure_id AND (public.is_org_admin(auth.uid(), d.organization_id) OR public.is_superadmin(auth.uid()))));

-- Refunds — admins only
CREATE POLICY "bk_refunds_select" ON public.bk_refunds FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.bk_is_org_member(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));
CREATE POLICY "bk_refunds_manage" ON public.bk_refunds FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))))
WITH CHECK (EXISTS (SELECT 1 FROM public.bk_bookings b WHERE b.id = booking_id AND (public.is_org_admin(auth.uid(), b.organization_id) OR public.is_superadmin(auth.uid()))));

-- Audit log — admins read, system writes (via SECURITY DEFINER from triggers/functions)
CREATE POLICY "bk_audit_select" ON public.bk_audit_log FOR SELECT TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));
CREATE POLICY "bk_audit_insert" ON public.bk_audit_log FOR INSERT TO authenticated
WITH CHECK (public.bk_is_org_member(auth.uid(), organization_id) OR public.is_superadmin(auth.uid()));
