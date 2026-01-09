-- Add preferred vessel for resolving double-day conflicts in sea days reporting
ALTER TABLE public.profiles 
ADD COLUMN preferred_vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.preferred_vessel_id IS 'Preferred vessel for sea days when crew member works on multiple vessels same day';