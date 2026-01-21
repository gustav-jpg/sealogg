-- Remove unique constraint on vessel_id and date to allow multiple logbooks per vessel per day
ALTER TABLE public.logbooks DROP CONSTRAINT IF EXISTS logbooks_vessel_id_date_key;