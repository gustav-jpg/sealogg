-- Add checklist_items column for storing multiple check items
ALTER TABLE public.checklist_steps 
ADD COLUMN IF NOT EXISTS checklist_items text[] DEFAULT NULL;