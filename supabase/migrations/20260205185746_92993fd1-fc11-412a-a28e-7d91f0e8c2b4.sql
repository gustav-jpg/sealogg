-- Create bunker_events table for tracking fuel fill-ups
CREATE TABLE public.bunker_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logbook_id UUID NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  liters INTEGER NOT NULL,
  engine_hours NUMERIC(10,1),
  engine_name TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bunker_events ENABLE ROW LEVEL SECURITY;

-- Policies: org members can view/insert bunker events for their vessels
CREATE POLICY "Org members can view bunker events"
ON public.bunker_events
FOR SELECT
USING (
  vessel_id IN (
    SELECT v.id FROM public.vessels v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can insert bunker events"
ON public.bunker_events
FOR INSERT
WITH CHECK (
  vessel_id IN (
    SELECT v.id FROM public.vessels v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Org admins can delete bunker events"
ON public.bunker_events
FOR DELETE
USING (
  vessel_id IN (
    SELECT v.id FROM public.vessels v
    JOIN public.organization_members om ON om.organization_id = v.organization_id
    WHERE om.user_id = auth.uid() AND om.role = 'org_admin'
  )
);

-- Index for faster queries
CREATE INDEX idx_bunker_events_vessel_id ON public.bunker_events(vessel_id);
CREATE INDEX idx_bunker_events_recorded_at ON public.bunker_events(recorded_at);