
-- Update handle_new_user to support organization_id from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email, organization_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      (NEW.raw_user_meta_data->>'organization_id')::uuid
    );
    RETURN NEW;
END;
$$;

-- Fix existing user profile
INSERT INTO public.profiles (user_id, full_name, email, organization_id)
SELECT 
  'c2b26639-521d-4f6a-af2e-7fdc2d299738',
  COALESCE(raw_user_meta_data->>'full_name', email),
  email,
  '611d9e90-4268-489a-a7ee-7211e0ab2523'
FROM auth.users 
WHERE id = 'c2b26639-521d-4f6a-af2e-7fdc2d299738'
AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = 'c2b26639-521d-4f6a-af2e-7fdc2d299738');
