-- Add pax_on and pax_off columns to logbook_stops
ALTER TABLE public.logbook_stops 
ADD COLUMN pax_on INTEGER DEFAULT 0,
ADD COLUMN pax_off INTEGER DEFAULT 0;

-- Migrate existing passenger_count data to pax_on (assuming it was passengers boarding)
UPDATE public.logbook_stops 
SET pax_on = COALESCE(passenger_count, 0)
WHERE passenger_count IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.logbook_stops.pax_on IS 'Number of passengers boarding at this stop';
COMMENT ON COLUMN public.logbook_stops.pax_off IS 'Number of passengers disembarking at this stop';