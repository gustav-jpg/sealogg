-- Fix CHECK constraint so checklist_steps.confirmation_type supports 'checklist'
ALTER TABLE public.checklist_steps
  DROP CONSTRAINT IF EXISTS checklist_steps_confirmation_type_check;

ALTER TABLE public.checklist_steps
  ADD CONSTRAINT checklist_steps_confirmation_type_check
  CHECK (confirmation_type = ANY (ARRAY['checkbox'::text, 'yes_no'::text, 'checklist'::text]));
