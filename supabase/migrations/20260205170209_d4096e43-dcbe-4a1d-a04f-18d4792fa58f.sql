-- Add reference_image_url column to checklist_steps for storing reference images
ALTER TABLE public.checklist_steps 
ADD COLUMN reference_image_url TEXT;

-- Add a comment explaining the column's purpose
COMMENT ON COLUMN public.checklist_steps.reference_image_url IS 'URL to a reference image that shows how the control point should look';