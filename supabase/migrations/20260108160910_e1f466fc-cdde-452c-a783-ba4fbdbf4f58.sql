-- Add name column to vessel_engine_hours
ALTER TABLE public.vessel_engine_hours 
ADD COLUMN name text;

-- Add name column to logbook_engine_hours for storing the name at time of logging
ALTER TABLE public.logbook_engine_hours
ADD COLUMN engine_name text;