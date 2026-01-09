-- Create logbook_stops table for multiple stops per logbook
CREATE TABLE public.logbook_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logbook_id UUID NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  departure_time TIME WITHOUT TIME ZONE,
  departure_location TEXT,
  arrival_time TIME WITHOUT TIME ZONE,
  arrival_location TEXT,
  passenger_count INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.logbook_stops ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can view stops
CREATE POLICY "Organisationsmedlemmar kan se stopp" 
ON public.logbook_stops 
FOR SELECT 
USING (logbook_id IN (
  SELECT l.id FROM logbooks l
  JOIN vessels v ON v.id = l.vessel_id
  WHERE v.organization_id IN (SELECT get_user_org_ids(auth.uid()))
));

-- Policy: Skeppare can manage stops
CREATE POLICY "Skeppare kan hantera stopp" 
ON public.logbook_stops 
FOR ALL 
USING (is_admin_or_skeppare(auth.uid()));

-- Create index for performance
CREATE INDEX idx_logbook_stops_logbook_id ON public.logbook_stops(logbook_id);
CREATE INDEX idx_logbook_stops_order ON public.logbook_stops(logbook_id, stop_order);