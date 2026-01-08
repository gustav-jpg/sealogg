-- Lägg till maskinkonfiguration på vessels
ALTER TABLE public.vessels 
ADD COLUMN main_engine_count INTEGER NOT NULL DEFAULT 1,
ADD COLUMN auxiliary_engine_count INTEGER NOT NULL DEFAULT 0;

-- Skapa tabell för att spåra aktuella maskintimmar per fartyg och maskin
CREATE TABLE public.vessel_engine_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_id UUID NOT NULL REFERENCES public.vessels(id) ON DELETE CASCADE,
  engine_type TEXT NOT NULL CHECK (engine_type IN ('main', 'auxiliary')),
  engine_number INTEGER NOT NULL DEFAULT 1,
  current_hours INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(vessel_id, engine_type, engine_number)
);

-- Enable RLS
ALTER TABLE public.vessel_engine_hours ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Alla kan se maskintimmar"
ON public.vessel_engine_hours FOR SELECT
USING (true);

CREATE POLICY "Skeppare kan uppdatera maskintimmar"
ON public.vessel_engine_hours FOR ALL
USING (is_admin_or_skeppare(auth.uid()));

-- Lägg till engine_type och engine_number på logbook_engine_hours
ALTER TABLE public.logbook_engine_hours
ADD COLUMN engine_type TEXT DEFAULT 'main',
ADD COLUMN engine_number INTEGER DEFAULT 1;