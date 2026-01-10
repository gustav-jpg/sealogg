-- Add schedule/timeline column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN schedule JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.schedule IS 'Array of schedule items with time and description, e.g. [{"time": "18:00", "description": "Gäster anländer"}]';