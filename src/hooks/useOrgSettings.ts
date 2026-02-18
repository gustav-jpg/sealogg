import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface OrgSettings {
  id: string;
  organization_id: string;
  weather_station_id: string;
  weather_station_source: string;
  smhi_forecast_lon: number;
  smhi_forecast_lat: number;
  ufs_chart_numbers: string[];
}

const DEFAULT_SETTINGS: Omit<OrgSettings, 'id' | 'organization_id'> = {
  weather_station_id: '141',
  weather_station_source: 'viva',
  smhi_forecast_lon: 18.0686,
  smhi_forecast_lat: 59.3293,
  ufs_chart_numbers: ['99'],
};

export function useOrgSettings() {
  const { selectedOrgId } = useOrganization();

  return useQuery({
    queryKey: ['org-settings', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_SETTINGS, organization_id: selectedOrgId } as OrgSettings;
      return data as unknown as OrgSettings;
    },
    enabled: !!selectedOrgId,
  });
}
