-- Create a function to get a profile's full name, bypassing RLS
-- This is safe because it only returns the name, not sensitive data
CREATE OR REPLACE FUNCTION public.get_profile_name_by_user_id(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;