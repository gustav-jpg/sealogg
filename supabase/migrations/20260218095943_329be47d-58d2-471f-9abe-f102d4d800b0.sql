
-- Organization settings for start page configuration
CREATE TABLE public.organization_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Weather station config
  weather_station_id text DEFAULT '141',
  weather_station_source text DEFAULT 'viva',
  smhi_forecast_lon numeric DEFAULT 18.0686,
  smhi_forecast_lat numeric DEFAULT 59.3293,
  -- UFS chart numbers (comma-separated or array)
  ufs_chart_numbers text[] DEFAULT '{99}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- Org members can view their org settings
CREATE POLICY "Org members can view settings"
  ON public.organization_settings FOR SELECT
  USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

-- Org admins can manage settings
CREATE POLICY "Org admins can manage settings"
  ON public.organization_settings FOR ALL
  USING (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()))
  WITH CHECK (is_org_admin(auth.uid(), organization_id) OR is_superadmin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
