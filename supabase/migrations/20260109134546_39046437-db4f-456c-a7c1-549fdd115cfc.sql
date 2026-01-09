-- Add bunker_liters column to logbooks table
ALTER TABLE public.logbooks
ADD COLUMN bunker_liters integer;