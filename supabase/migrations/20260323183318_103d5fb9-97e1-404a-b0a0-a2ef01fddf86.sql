
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read app settings (needed for version check before auth)
CREATE POLICY "Anyone can read app_settings"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (true);

-- Only superadmins can modify
CREATE POLICY "Superadmins can manage app_settings"
ON public.app_settings FOR ALL
TO authenticated
USING (public.is_superadmin(auth.uid()))
WITH CHECK (public.is_superadmin(auth.uid()));

-- Insert initial min version
INSERT INTO public.app_settings (key, value) VALUES ('min_app_version', '2.0.0');
INSERT INTO public.app_settings (key, value) VALUES ('force_update', 'false');
