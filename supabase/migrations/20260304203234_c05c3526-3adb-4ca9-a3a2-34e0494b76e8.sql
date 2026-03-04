
-- Add assigned_to and deadline columns to fault_cases
ALTER TABLE public.fault_cases 
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) DEFAULT NULL,
  ADD COLUMN deadline date DEFAULT NULL;
