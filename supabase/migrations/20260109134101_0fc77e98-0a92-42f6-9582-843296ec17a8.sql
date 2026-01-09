-- Add category column to control_points table
ALTER TABLE public.control_points
ADD COLUMN category text;