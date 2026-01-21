-- Routes table - predefined routes per organization
CREATE TABLE public.passenger_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Docks/piers registry per organization
CREATE TABLE public.passenger_docks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Route stops - docks in a route with order
CREATE TABLE public.passenger_route_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.passenger_routes(id) ON DELETE CASCADE,
  dock_id UUID NOT NULL REFERENCES public.passenger_docks(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(route_id, stop_order)
);

-- Active registration sessions linked to logbook
CREATE TABLE public.passenger_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logbook_id UUID NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE UNIQUE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.passenger_routes(id) ON DELETE SET NULL,
  current_stop_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Individual passenger entries
CREATE TABLE public.passenger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.passenger_sessions(id) ON DELETE CASCADE,
  dock_id UUID REFERENCES public.passenger_docks(id) ON DELETE SET NULL,
  dock_name TEXT NOT NULL, -- Store name for historical records
  departure_time TIME WITHOUT TIME ZONE NOT NULL,
  pax_on INTEGER NOT NULL DEFAULT 0,
  pax_off INTEGER NOT NULL DEFAULT 0,
  entry_order INTEGER NOT NULL,
  registered_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.passenger_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_docks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for passenger_routes
CREATE POLICY "Org members can view routes"
  ON public.passenger_routes FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage routes"
  ON public.passenger_routes FOR ALL
  USING (has_role(auth.uid(), 'admin') AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- RLS Policies for passenger_docks
CREATE POLICY "Org members can view docks"
  ON public.passenger_docks FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins can manage docks"
  ON public.passenger_docks FOR ALL
  USING (has_role(auth.uid(), 'admin') AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- RLS Policies for passenger_route_stops
CREATE POLICY "Org members can view route stops"
  ON public.passenger_route_stops FOR SELECT
  USING (route_id IN (
    SELECT id FROM public.passenger_routes 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  ));

CREATE POLICY "Admins can manage route stops"
  ON public.passenger_route_stops FOR ALL
  USING (route_id IN (
    SELECT id FROM public.passenger_routes 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  ) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for passenger_sessions
CREATE POLICY "Org members can view sessions"
  ON public.passenger_sessions FOR SELECT
  USING (vessel_id IN (
    SELECT id FROM public.vessels 
    WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
  ));

CREATE POLICY "Skeppare can create sessions"
  ON public.passenger_sessions FOR INSERT
  WITH CHECK (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Skeppare can update sessions"
  ON public.passenger_sessions FOR UPDATE
  USING (is_admin_or_skeppare(auth.uid()));

-- RLS Policies for passenger_entries
CREATE POLICY "Org members can view entries"
  ON public.passenger_entries FOR SELECT
  USING (session_id IN (
    SELECT ps.id FROM public.passenger_sessions ps
    JOIN public.vessels v ON v.id = ps.vessel_id
    WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
  ));

CREATE POLICY "Skeppare can create entries"
  ON public.passenger_entries FOR INSERT
  WITH CHECK (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Skeppare can update entries"
  ON public.passenger_entries FOR UPDATE
  USING (is_admin_or_skeppare(auth.uid()));

CREATE POLICY "Skeppare can delete entries"
  ON public.passenger_entries FOR DELETE
  USING (is_admin_or_skeppare(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_passenger_routes_updated_at
  BEFORE UPDATE ON public.passenger_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();