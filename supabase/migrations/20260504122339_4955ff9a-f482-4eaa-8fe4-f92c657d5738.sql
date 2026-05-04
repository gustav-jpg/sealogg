-- Cleanup leftover types
DROP TYPE IF EXISTS public.booking_status CASCADE;
DROP TYPE IF EXISTS public.booking_payment_status CASCADE;
DROP TYPE IF EXISTS public.departure_status CASCADE;
DROP TYPE IF EXISTS public.taxi_request_status CASCADE;

-- Status enums
CREATE TYPE public.booking_status AS ENUM ('avvaktar', 'bekraftad', 'avbokad', 'no_show');
CREATE TYPE public.booking_payment_status AS ENUM ('obetald', 'betald', 'aterbetald');
CREATE TYPE public.departure_status AS ENUM ('planerad', 'installd', 'fullbokad', 'genomford');
CREATE TYPE public.taxi_request_status AS ENUM ('ny', 'bekraftad', 'avbojd', 'genomford');

-- Tables
CREATE TABLE public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE,
  public_slug text NOT NULL UNIQUE,
  company_name text NOT NULL,
  logo_url text,
  brand_color text DEFAULT '#0A1628',
  contact_email text,
  contact_phone text,
  booking_terms text,
  email_confirmation_text text,
  auto_confirm_bookings boolean NOT NULL DEFAULT false,
  taxi_requires_manual_confirmation boolean NOT NULL DEFAULT true,
  default_payment_method text DEFAULT 'manuell',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slug_format CHECK (public_slug ~ '^[a-z0-9-]{2,60}$')
);

CREATE TABLE public.booking_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  stops jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  duration_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  route_id uuid NOT NULL REFERENCES public.booking_routes(id) ON DELETE CASCADE,
  vessel_id uuid NOT NULL,
  name text NOT NULL,
  weekdays integer[] NOT NULL DEFAULT '{}',
  departure_times time[] NOT NULL DEFAULT '{}',
  valid_from date NOT NULL,
  valid_until date,
  max_passengers integer NOT NULL DEFAULT 12,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  route_id uuid NOT NULL REFERENCES public.booking_routes(id) ON DELETE RESTRICT,
  vessel_id uuid NOT NULL,
  schedule_id uuid REFERENCES public.booking_schedules(id) ON DELETE SET NULL,
  departure_at timestamptz NOT NULL,
  arrival_at timestamptz,
  max_passengers integer NOT NULL DEFAULT 12,
  status public.departure_status NOT NULL DEFAULT 'planerad',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vessel_id, departure_at)
);
CREATE INDEX idx_booking_departures_org_time ON public.booking_departures(organization_id, departure_at);

CREATE TABLE public.booking_ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  departure_id uuid NOT NULL REFERENCES public.booking_departures(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_sek numeric(10,2) NOT NULL DEFAULT 0,
  max_count integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  departure_id uuid NOT NULL REFERENCES public.booking_departures(id) ON DELETE RESTRICT,
  booking_number text NOT NULL UNIQUE DEFAULT 'BK-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  total_passengers integer NOT NULL DEFAULT 1,
  total_price_sek numeric(10,2) NOT NULL DEFAULT 0,
  status public.booking_status NOT NULL DEFAULT 'avvaktar',
  payment_status public.booking_payment_status NOT NULL DEFAULT 'obetald',
  customer_notes text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT email_format CHECK (customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
CREATE INDEX idx_bookings_org ON public.bookings(organization_id);
CREATE INDEX idx_bookings_departure ON public.bookings(departure_id);

CREATE TABLE public.booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.booking_ticket_types(id) ON DELETE RESTRICT,
  passenger_name text,
  price_sek numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.booking_taxi_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  request_number text NOT NULL UNIQUE DEFAULT 'TX-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  requested_at timestamptz NOT NULL,
  passenger_count integer NOT NULL DEFAULT 1,
  notes text,
  status public.taxi_request_status NOT NULL DEFAULT 'ny',
  assigned_vessel_id uuid,
  quoted_price_sek numeric(10,2),
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_taxi_requests_org_status ON public.booking_taxi_requests(organization_id, status);

CREATE TABLE public.booking_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  taxi_request_id uuid REFERENCES public.booking_taxi_requests(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper functions
CREATE OR REPLACE FUNCTION public.is_booking_org_admin(_user_id uuid, _booking_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.organization_members om ON om.organization_id = b.organization_id
    WHERE b.id = _booking_id AND om.user_id = _user_id AND om.role = 'org_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_org_id_by_booking_slug(_slug text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT bs.organization_id FROM public.booking_settings bs
  WHERE bs.public_slug = _slug
    AND public.org_has_module(bs.organization_id, 'bookings'::app_module)
  LIMIT 1
$$;

-- Triggers
CREATE TRIGGER update_booking_settings_updated_at BEFORE UPDATE ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_routes_updated_at BEFORE UPDATE ON public.booking_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_schedules_updated_at BEFORE UPDATE ON public.booking_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_departures_updated_at BEFORE UPDATE ON public.booking_departures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_taxi_requests_updated_at BEFORE UPDATE ON public.booking_taxi_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.log_booking_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.booking_audit_logs (booking_id, user_id, action, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_audit_logs (booking_id, user_id, action, new_value)
    VALUES (NEW.id, auth.uid(), 'INSERT', to_jsonb(NEW));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_audit AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_change();

-- RLS
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_departures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_taxi_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage booking settings" ON public.booking_settings FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view booking settings" ON public.booking_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can view booking settings" ON public.booking_settings FOR SELECT TO anon, authenticated
  USING (public.org_has_module(organization_id, 'bookings'::app_module));

CREATE POLICY "Org admins manage routes" ON public.booking_routes FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view routes" ON public.booking_routes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can view active public routes" ON public.booking_routes FOR SELECT TO anon, authenticated
  USING (is_active = true AND is_public = true AND public.org_has_module(organization_id, 'bookings'::app_module));

CREATE POLICY "Org admins manage schedules" ON public.booking_schedules FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view schedules" ON public.booking_schedules FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Org admins manage departures" ON public.booking_departures FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view departures" ON public.booking_departures FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can view future departures" ON public.booking_departures FOR SELECT TO anon, authenticated
  USING (status IN ('planerad', 'fullbokad') AND departure_at > now() AND public.org_has_module(organization_id, 'bookings'::app_module));

CREATE POLICY "Org admins manage ticket types" ON public.booking_ticket_types FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view ticket types" ON public.booking_ticket_types FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can view ticket types" ON public.booking_ticket_types FOR SELECT TO anon, authenticated
  USING (departure_id IN (
    SELECT id FROM public.booking_departures
    WHERE status IN ('planerad', 'fullbokad') AND departure_at > now()
      AND public.org_has_module(organization_id, 'bookings'::app_module)
  ));

CREATE POLICY "Org admins manage bookings" ON public.bookings FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view bookings" ON public.bookings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can create bookings" ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (departure_id IN (
    SELECT id FROM public.booking_departures
    WHERE status = 'planerad' AND departure_at > now()
      AND public.org_has_module(organization_id, 'bookings'::app_module)
  ));

CREATE POLICY "Org admins manage passengers" ON public.booking_passengers FOR ALL TO authenticated
  USING (booking_id IN (SELECT id FROM public.bookings WHERE is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid())))
  WITH CHECK (booking_id IN (SELECT id FROM public.bookings WHERE is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid())));
CREATE POLICY "Org members view passengers" ON public.booking_passengers FOR SELECT TO authenticated
  USING (booking_id IN (SELECT id FROM public.bookings WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))));
CREATE POLICY "Public can add passengers" ON public.booking_passengers FOR INSERT TO anon, authenticated
  WITH CHECK (booking_id IN (
    SELECT b.id FROM public.bookings b
    JOIN public.booking_departures d ON d.id = b.departure_id
    WHERE d.status = 'planerad' AND d.departure_at > now()
      AND public.org_has_module(b.organization_id, 'bookings'::app_module)
  ));

CREATE POLICY "Org admins manage taxi requests" ON public.booking_taxi_requests FOR ALL TO authenticated
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));
CREATE POLICY "Org members view taxi requests" ON public.booking_taxi_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));
CREATE POLICY "Public can submit taxi requests" ON public.booking_taxi_requests FOR INSERT TO anon, authenticated
  WITH CHECK (public.org_has_module(organization_id, 'bookings'::app_module));

CREATE POLICY "Org admins view audit logs" ON public.booking_audit_logs FOR SELECT TO authenticated
  USING ((booking_id IS NOT NULL AND is_booking_org_admin(auth.uid(), booking_id)) OR is_superadmin(auth.uid()));