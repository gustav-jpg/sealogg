-- Allow superadmins to view profiles and organization members in backoffice

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Profiles: superadmins can read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Superadmins can select all profiles'
  ) THEN
    CREATE POLICY "Superadmins can select all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (public.is_superadmin(auth.uid()));
  END IF;
END $$;

-- Organization members: superadmins can read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'organization_members' AND policyname = 'Superadmins can select all org members'
  ) THEN
    CREATE POLICY "Superadmins can select all org members"
    ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (public.is_superadmin(auth.uid()));
  END IF;
END $$;