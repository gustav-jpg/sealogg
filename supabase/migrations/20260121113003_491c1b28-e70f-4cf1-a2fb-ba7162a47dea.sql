-- Fix linter: avoid permissive write policy on page_views
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;

CREATE POLICY "Authenticated can insert page views"
ON public.page_views
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
