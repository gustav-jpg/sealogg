import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Settings, Wind, AlertTriangle, Plus, X, Save } from 'lucide-react';

export default function StartPageSettings() {
  const { toast } = useToast();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();

  const [weatherStationId, setWeatherStationId] = useState('141');
  const [weatherSource, setWeatherSource] = useState('viva');
  const [smhiLon, setSmhiLon] = useState('18.0686');
  const [smhiLat, setSmhiLat] = useState('59.3293');
  const [chartNumbers, setChartNumbers] = useState<string[]>(['99']);
  const [newChart, setNewChart] = useState('');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['org-settings', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  useEffect(() => {
    if (settings) {
      setWeatherStationId(settings.weather_station_id || '141');
      setWeatherSource(settings.weather_station_source || 'viva');
      setSmhiLon(String(settings.smhi_forecast_lon ?? '18.0686'));
      setSmhiLat(String(settings.smhi_forecast_lat ?? '59.3293'));
      setChartNumbers(settings.ufs_chart_numbers || ['99']);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      
      const payload = {
        organization_id: selectedOrgId,
        weather_station_id: weatherStationId,
        weather_station_source: weatherSource,
        smhi_forecast_lon: parseFloat(smhiLon),
        smhi_forecast_lat: parseFloat(smhiLat),
        ufs_chart_numbers: chartNumbers,
      };

      const { error } = await supabase
        .from('organization_settings')
        .upsert(payload, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      toast({ title: 'Inställningar sparade' });
    },
    onError: (error) => {
      toast({ title: 'Kunde inte spara', description: String(error), variant: 'destructive' });
    },
  });

  const addChart = () => {
    const trimmed = newChart.trim();
    if (trimmed && !chartNumbers.includes(trimmed)) {
      setChartNumbers([...chartNumbers, trimmed]);
      setNewChart('');
    }
  };

  const removeChart = (chart: string) => {
    setChartNumbers(chartNumbers.filter(c => c !== chart));
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Startsida-inställningar
          </h1>
          <p className="text-muted-foreground text-sm">
            Konfigurera väderstation och UFS-varningar för er organisation
          </p>
        </div>

        {isLoading ? (
          <div className="h-40 bg-muted animate-pulse rounded-lg" />
        ) : (
          <>
            {/* Weather Station */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wind className="h-5 w-5" />
                  Väderstation
                </CardTitle>
                <CardDescription>
                  Ange vilken väderstation som ska användas för vinddata på startsidan.
                  Stations-ID:t hittar du på{' '}
                  <a
                    href="https://viva.sjofartsverket.se/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Sjöfartsverket ViVa
                  </a>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stationId">ViVa Station-ID</Label>
                    <Input
                      id="stationId"
                      value={weatherStationId}
                      onChange={e => setWeatherStationId(e.target.value)}
                      placeholder="t.ex. 141"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Källa</Label>
                    <Input
                      id="source"
                      value={weatherSource}
                      onChange={e => setWeatherSource(e.target.value)}
                      placeholder="viva"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lon">SMHI Prognos Longitud</Label>
                    <Input
                      id="lon"
                      type="number"
                      step="0.0001"
                      value={smhiLon}
                      onChange={e => setSmhiLon(e.target.value)}
                      placeholder="18.0686"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lat">SMHI Prognos Latitud</Label>
                    <Input
                      id="lat"
                      type="number"
                      step="0.0001"
                      value={smhiLat}
                      onChange={e => setSmhiLat(e.target.value)}
                      placeholder="59.3293"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* UFS Chart Numbers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" />
                  UFS Sjökort
                </CardTitle>
                <CardDescription>
                  Ange vilka sjökortsnummer som ska visas för UFS-varningar.
                  Sjökort 99 visar alla vatten.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {chartNumbers.map(chart => (
                    <Badge key={chart} variant="secondary" className="text-sm py-1 px-3 gap-1">
                      {chart}
                      <button
                        onClick={() => removeChart(chart)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newChart}
                    onChange={e => setNewChart(e.target.value)}
                    placeholder="Sjökortsnummer, t.ex. 612"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addChart())}
                  />
                  <Button variant="outline" size="sm" onClick={addChart} disabled={!newChart.trim()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Sparar...' : 'Spara inställningar'}
            </Button>
          </>
        )}
      </div>
    </MainLayout>
  );
}
