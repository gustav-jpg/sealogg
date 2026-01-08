-- Drop the old foreign key constraint that references auth.users
ALTER TABLE public.user_certificates 
DROP CONSTRAINT IF EXISTS user_certificates_user_id_fkey;

-- Add new foreign key constraint to reference profiles.id
ALTER TABLE public.user_certificates 
ADD CONSTRAINT user_certificates_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Do the same for user_vessel_inductions
ALTER TABLE public.user_vessel_inductions 
DROP CONSTRAINT IF EXISTS user_vessel_inductions_user_id_fkey;

ALTER TABLE public.user_vessel_inductions 
ADD CONSTRAINT user_vessel_inductions_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Do the same for logbook_crew
ALTER TABLE public.logbook_crew 
DROP CONSTRAINT IF EXISTS logbook_crew_user_id_fkey;

ALTER TABLE public.logbook_crew 
ADD CONSTRAINT logbook_crew_profile_id_fkey 
FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;