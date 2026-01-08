-- Rename user_id to profile_id in user_certificates to reflect the new model
-- where we link to profiles (which may or may not have auth users)

-- First, update user_vessel_inductions to use profile_id
ALTER TABLE public.user_vessel_inductions 
RENAME COLUMN user_id TO profile_id;

-- Update user_certificates to use profile_id
ALTER TABLE public.user_certificates
RENAME COLUMN user_id TO profile_id;

-- Update logbook_crew to use profile_id
ALTER TABLE public.logbook_crew
RENAME COLUMN user_id TO profile_id;

-- Update RLS policies for user_certificates
DROP POLICY IF EXISTS "Användare och skeppare kan se certifikat" ON public.user_certificates;

CREATE POLICY "Användare och skeppare kan se certifikat"
ON public.user_certificates
FOR SELECT
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'skeppare'::app_role)
);

-- Update RLS for user_vessel_inductions (already allows all to see)