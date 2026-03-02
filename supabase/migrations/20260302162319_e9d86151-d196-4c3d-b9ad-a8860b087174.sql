-- Add vehicle and cargo columns to logbook_stops
ALTER TABLE public.logbook_stops
  ADD COLUMN vehicles_on integer DEFAULT 0,
  ADD COLUMN vehicles_off integer DEFAULT 0,
  ADD COLUMN cargo_on_kg numeric DEFAULT 0,
  ADD COLUMN cargo_off_kg numeric DEFAULT 0;