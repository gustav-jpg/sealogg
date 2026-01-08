-- Make user_id nullable to allow profiles without login
ALTER TABLE public.profiles
ALTER COLUMN user_id DROP NOT NULL;

-- Add a column to distinguish external crew
ALTER TABLE public.profiles
ADD COLUMN is_external BOOLEAN NOT NULL DEFAULT false;

-- Update RLS to allow admins to create external profiles
DROP POLICY IF EXISTS "Användare kan skapa sin profil" ON public.profiles;

CREATE POLICY "Användare kan skapa sin profil"
ON public.profiles
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) OR 
  (is_external = true AND has_role(auth.uid(), 'admin'::app_role))
);

-- Allow admins to update external profiles
DROP POLICY IF EXISTS "Användare kan uppdatera sin profil" ON public.profiles;

CREATE POLICY "Användare kan uppdatera sin profil"
ON public.profiles
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  (is_external = true AND has_role(auth.uid(), 'admin'::app_role))
);

-- Allow admins to delete external profiles
CREATE POLICY "Admin kan ta bort externa profiler"
ON public.profiles
FOR DELETE
USING (is_external = true AND has_role(auth.uid(), 'admin'::app_role));