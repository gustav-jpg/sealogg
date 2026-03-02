
-- Add deviation_number column
ALTER TABLE public.deviations ADD COLUMN deviation_number integer;

-- Create a function to auto-assign deviation numbers per organization (vessel's org)
CREATE OR REPLACE FUNCTION public.assign_deviation_number()
RETURNS TRIGGER AS $$
DECLARE
  org_id uuid;
  next_number integer;
BEGIN
  -- Get the organization_id from the vessel
  SELECT organization_id INTO org_id FROM public.vessels WHERE id = NEW.vessel_id;
  
  -- Get the next number for this organization
  SELECT COALESCE(MAX(d.deviation_number), 0) + 1 INTO next_number
  FROM public.deviations d
  JOIN public.vessels v ON v.id = d.vessel_id
  WHERE v.organization_id = org_id;
  
  NEW.deviation_number := next_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER set_deviation_number
BEFORE INSERT ON public.deviations
FOR EACH ROW
EXECUTE FUNCTION public.assign_deviation_number();

-- Backfill existing deviations with numbers (ordered by created_at)
WITH numbered AS (
  SELECT d.id, ROW_NUMBER() OVER (
    PARTITION BY v.organization_id 
    ORDER BY d.created_at
  ) as rn
  FROM public.deviations d
  JOIN public.vessels v ON v.id = d.vessel_id
)
UPDATE public.deviations SET deviation_number = numbered.rn
FROM numbered WHERE deviations.id = numbered.id;
