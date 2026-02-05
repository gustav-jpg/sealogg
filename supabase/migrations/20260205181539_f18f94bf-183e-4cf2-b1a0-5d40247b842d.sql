-- Add primary_engine_id to vessels
ALTER TABLE public.vessels 
ADD COLUMN primary_engine_id UUID REFERENCES public.vessel_engine_hours(id);

-- Set default primary engines for existing vessels
-- For vessels with multiple engines, use SB (styrbord) main engine
-- For vessels with single engine, use HM (huvudmaskin)
UPDATE public.vessels v
SET primary_engine_id = (
  SELECT veh.id 
  FROM public.vessel_engine_hours veh 
  WHERE veh.vessel_id = v.id 
    AND veh.engine_type = 'main'
  ORDER BY 
    CASE 
      WHEN veh.name ILIKE '%SB%' OR veh.name ILIKE '%styrbord%' THEN 1
      WHEN veh.name ILIKE '%HM%' OR veh.name ILIKE '%huvud%' THEN 2
      ELSE 3
    END,
    veh.engine_number
  LIMIT 1
)
WHERE v.primary_engine_id IS NULL;