-- Create logbook exercises table
CREATE TABLE public.logbook_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  logbook_id UUID NOT NULL REFERENCES public.logbooks(id) ON DELETE CASCADE,
  exercise_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.logbook_exercises ENABLE ROW LEVEL SECURITY;

-- Create policy: users can view exercises for logbooks they have access to
CREATE POLICY "Users can view logbook exercises"
ON public.logbook_exercises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM logbooks l
    JOIN vessels v ON l.vessel_id = v.id
    WHERE l.id = logbook_exercises.logbook_id
    AND v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Create policy: users can insert exercises
CREATE POLICY "Users can insert logbook exercises"
ON public.logbook_exercises
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM logbooks l
    JOIN vessels v ON l.vessel_id = v.id
    WHERE l.id = logbook_exercises.logbook_id
    AND v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Create policy: users can update exercises
CREATE POLICY "Users can update logbook exercises"
ON public.logbook_exercises
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM logbooks l
    JOIN vessels v ON l.vessel_id = v.id
    WHERE l.id = logbook_exercises.logbook_id
    AND v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Create policy: users can delete exercises
CREATE POLICY "Users can delete logbook exercises"
ON public.logbook_exercises
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM logbooks l
    JOIN vessels v ON l.vessel_id = v.id
    WHERE l.id = logbook_exercises.logbook_id
    AND v.organization_id IN (SELECT public.get_user_org_ids(auth.uid()))
  )
);

-- Create index for faster lookups
CREATE INDEX idx_logbook_exercises_logbook_id ON public.logbook_exercises(logbook_id);