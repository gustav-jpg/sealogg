-- Add help_text column to checklist_steps table
ALTER TABLE public.checklist_steps 
ADD COLUMN help_text TEXT NULL;