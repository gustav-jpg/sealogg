-- Add policy for users to read their own superadmin status
CREATE POLICY "Users can read own superadmin status"
ON public.superadmins
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);