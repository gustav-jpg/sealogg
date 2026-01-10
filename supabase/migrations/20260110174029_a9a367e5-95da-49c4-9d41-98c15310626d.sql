-- Enums for booking system
CREATE TYPE public.booking_status AS ENUM ('forfragen', 'preliminar', 'bekraftad', 'avbokad', 'genomford', 'blockerad');
CREATE TYPE public.event_type AS ENUM ('middag', 'foretagsevent', 'brollop', 'transport', 'privat', 'konferens', 'ovrigt');
CREATE TYPE public.event_layout AS ENUM ('sittning', 'mingel', 'konferens', 'blandat');
CREATE TYPE public.pm_type AS ENUM ('besattning', 'servering', 'kok', 'bar');
CREATE TYPE public.booking_crew_role AS ENUM ('kapten', 'matros', 'serveringsansvarig', 'kock', 'bartender');
CREATE TYPE public.blocking_reason AS ENUM ('service', 'privat', 'vaderreserv', 'personalbrist', 'ovrigt');

-- Menus table (admin registry)
CREATE TABLE public.menus (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    season TEXT,
    description TEXT,
    courses JSONB DEFAULT '[]'::jsonb,
    allergen_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drink packages table (admin registry)
CREATE TABLE public.drink_packages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    contents JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drink extras/add-ons table
CREATE TABLE public.drink_extras (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Main bookings table
CREATE TABLE public.bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    buffer_before_minutes INTEGER DEFAULT 60,
    buffer_after_minutes INTEGER DEFAULT 60,
    status public.booking_status NOT NULL DEFAULT 'forfragen',
    blocking_reason public.blocking_reason,
    event_type public.event_type,
    event_layout public.event_layout,
    guest_count INTEGER,
    max_guest_warning BOOLEAN GENERATED ALWAYS AS (guest_count > 150) STORED,
    contact_name TEXT,
    contact_phone TEXT,
    contact_company TEXT,
    internal_notes TEXT,
    departure_harbor TEXT,
    arrival_harbor TEXT,
    route_notes TEXT,
    tech_equipment TEXT[],
    safety_notes TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking food/menu selection
CREATE TABLE public.booking_food (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    menu_id UUID REFERENCES public.menus(id) ON DELETE SET NULL,
    menu_name_snapshot TEXT,
    portions INTEGER,
    dietary_tags TEXT[] DEFAULT '{}',
    dietary_notes TEXT,
    menu_deadline DATE,
    serving_times JSONB,
    kitchen_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking drinks selection
CREATE TABLE public.booking_drinks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    drink_package_id UUID REFERENCES public.drink_packages(id) ON DELETE SET NULL,
    package_name_snapshot TEXT,
    is_a_la_carte BOOLEAN DEFAULT false,
    extras UUID[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking crew assignments
CREATE TABLE public.booking_crew (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_type public.booking_crew_role NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(booking_id, profile_id, role_type)
);

-- PM versions
CREATE TABLE public.booking_pms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    pm_type public.pm_type NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    content JSONB NOT NULL,
    is_latest BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Booking audit logs
CREATE TABLE public.booking_audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drink_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_food ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_pms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menus (admin manages, all can view active)
CREATE POLICY "Admin kan hantera menyer" ON public.menus FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Alla inloggade kan se aktiva menyer" ON public.menus FOR SELECT USING (is_active = true);

-- RLS Policies for drink_packages
CREATE POLICY "Admin kan hantera dryckespaket" ON public.drink_packages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Alla inloggade kan se aktiva dryckespaket" ON public.drink_packages FOR SELECT USING (is_active = true);

-- RLS Policies for drink_extras
CREATE POLICY "Admin kan hantera dryckestillval" ON public.drink_extras FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Alla inloggade kan se aktiva dryckestillval" ON public.drink_extras FOR SELECT USING (is_active = true);

-- RLS Policies for bookings (org-based access like logbooks)
CREATE POLICY "Organisationsmedlemmar kan se bokningar" ON public.bookings FOR SELECT 
USING (vessel_id IN (SELECT v.id FROM vessels v WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

CREATE POLICY "Skeppare kan skapa bokningar" ON public.bookings FOR INSERT 
WITH CHECK (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Skeppare kan uppdatera bokningar" ON public.bookings FOR UPDATE 
USING (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Admin kan ta bort bokningar" ON public.bookings FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for booking_food
CREATE POLICY "Organisationsmedlemmar kan se bokningsmat" ON public.booking_food FOR SELECT 
USING (booking_id IN (SELECT b.id FROM bookings b JOIN vessels v ON v.id = b.vessel_id WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

CREATE POLICY "Skeppare kan hantera bokningsmat" ON public.booking_food FOR ALL 
USING (is_admin_or_skeppare(auth.uid()));

-- RLS Policies for booking_drinks
CREATE POLICY "Organisationsmedlemmar kan se bokningsdryck" ON public.booking_drinks FOR SELECT 
USING (booking_id IN (SELECT b.id FROM bookings b JOIN vessels v ON v.id = b.vessel_id WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

CREATE POLICY "Skeppare kan hantera bokningsdryck" ON public.booking_drinks FOR ALL 
USING (is_admin_or_skeppare(auth.uid()));

-- RLS Policies for booking_crew
CREATE POLICY "Organisationsmedlemmar kan se bokningsbesattning" ON public.booking_crew FOR SELECT 
USING (booking_id IN (SELECT b.id FROM bookings b JOIN vessels v ON v.id = b.vessel_id WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

CREATE POLICY "Skeppare kan hantera bokningsbesattning" ON public.booking_crew FOR ALL 
USING (is_admin_or_skeppare(auth.uid()));

-- RLS Policies for booking_pms
CREATE POLICY "Organisationsmedlemmar kan se PM" ON public.booking_pms FOR SELECT 
USING (booking_id IN (SELECT b.id FROM bookings b JOIN vessels v ON v.id = b.vessel_id WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

CREATE POLICY "Skeppare kan skapa PM" ON public.booking_pms FOR INSERT 
WITH CHECK (is_admin_or_skeppare(auth.uid()));

-- RLS Policies for booking_audit_logs
CREATE POLICY "Organisationsmedlemmar kan se bokningslogg" ON public.booking_audit_logs FOR SELECT 
USING (booking_id IN (SELECT b.id FROM bookings b JOIN vessels v ON v.id = b.vessel_id WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))));

-- Triggers for updated_at
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_drink_packages_updated_at BEFORE UPDATE ON public.drink_packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_food_updated_at BEFORE UPDATE ON public.booking_food FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_booking_drinks_updated_at BEFORE UPDATE ON public.booking_drinks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to log booking changes
CREATE OR REPLACE FUNCTION public.log_booking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO public.booking_audit_logs (booking_id, user_id, action, old_value, new_value)
        VALUES (NEW.id, auth.uid(), 'UPDATE', to_jsonb(OLD)::text, to_jsonb(NEW)::text);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.booking_audit_logs (booking_id, user_id, action, new_value)
        VALUES (NEW.id, auth.uid(), 'INSERT', to_jsonb(NEW)::text);
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger for booking audit log
CREATE TRIGGER audit_booking_changes 
AFTER INSERT OR UPDATE ON public.bookings 
FOR EACH ROW EXECUTE FUNCTION public.log_booking_change();

-- Function to mark old PMs as not latest when new one is created
CREATE OR REPLACE FUNCTION public.update_pm_latest_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.booking_pms 
    SET is_latest = false 
    WHERE booking_id = NEW.booking_id 
      AND pm_type = NEW.pm_type 
      AND id != NEW.id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_pm_versions
AFTER INSERT ON public.booking_pms
FOR EACH ROW EXECUTE FUNCTION public.update_pm_latest_flag();

-- Index for faster queries
CREATE INDEX idx_bookings_vessel_date ON public.bookings(vessel_id, booking_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_booking_pms_booking_type ON public.booking_pms(booking_id, pm_type);