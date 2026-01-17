import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Home, FileText, Cloud, Download, Thermometer, Wind, Droplets } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface WeatherData {
  time: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  precipitation: number;
  symbol: number;
}

export default function Startsida() {
  const { selectedOrgId } = useOrganization();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch today's message
  const { data: todayMessage, isLoading: messageLoading } = useQuery({
    queryKey: ['intranet-message-today', selectedOrgId, today],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('intranet_messages')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('message_date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Fetch weather from SMHI (Stockholm coordinates as default)
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: ['smhi-weather'],
    queryFn: async () => {
      try {
        // SMHI API for Stockholm (lat: 59.3293, lon: 18.0686)
        const response = await fetch(
          'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/18.0686/lat/59.3293/data.json'
        );
        if (!response.ok) throw new Error('Failed to fetch weather');
        const data = await response.json();
        
        // Get next 24 hours of forecast
        const now = new Date();
        const next24h = data.timeSeries
          .filter((ts: any) => {
            const time = new Date(ts.validTime);
            return time >= now && time <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
          })
          .slice(0, 8) // Get every 3 hours
          .map((ts: any) => {
            const params = ts.parameters.reduce((acc: any, p: any) => {
              acc[p.name] = p.values[0];
              return acc;
            }, {});
            return {
              time: ts.validTime,
              temperature: params.t || 0,
              windSpeed: params.ws || 0,
              windDirection: params.wd || 0,
              humidity: params.r || 0,
              precipitation: params.pmean || 0,
              symbol: params.Wsymb2 || 1,
            } as WeatherData;
          });
        
        return next24h;
      } catch (error) {
        console.error('Weather fetch error:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const getWeatherIcon = (symbol: number) => {
    // SMHI weather symbols: 1-2 = clear, 3-4 = partly cloudy, 5-6 = cloudy, 7+ = rain/snow
    if (symbol <= 2) return '☀️';
    if (symbol <= 4) return '⛅';
    if (symbol <= 6) return '☁️';
    if (symbol <= 9) return '🌧️';
    if (symbol <= 15) return '🌧️';
    if (symbol <= 21) return '❄️';
    return '🌧️';
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('intranet-documents')
        .download(url.split('/').pop() || '');
      
      if (error) throw error;
      
      const blob = new Blob([data]);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Home className="h-8 w-8" />
            Startsida
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), "EEEE d MMMM yyyy", { locale: sv })}
          </p>
        </div>

        {/* Today's Message */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Dagens meddelande
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messageLoading ? (
              <p className="text-muted-foreground">Laddar...</p>
            ) : todayMessage ? (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{todayMessage.title}</h3>
                  {todayMessage.content && (
                    <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                      {todayMessage.content}
                    </p>
                  )}
                </div>
                {todayMessage.document_url && todayMessage.document_name && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(todayMessage.document_url!, todayMessage.document_name!)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {todayMessage.document_name}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Inget meddelande för idag
              </p>
            )}
          </CardContent>
        </Card>

        {/* Weather Forecast */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="h-5 w-5" />
              Väder kommande 24h
              <Badge variant="outline" className="ml-auto text-xs font-normal">SMHI</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weatherLoading ? (
              <p className="text-muted-foreground">Laddar väderdata...</p>
            ) : weatherData && weatherData.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {weatherData.map((hour: WeatherData, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col items-center p-2 rounded-lg bg-muted/50 text-center"
                  >
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(hour.time), 'HH:mm')}
                    </span>
                    <span className="text-2xl my-1">{getWeatherIcon(hour.symbol)}</span>
                    <span className="font-semibold">{Math.round(hour.temperature)}°</span>
                    <div className="flex items-center gap-0.5 text-xs text-muted-foreground mt-1">
                      <Wind className="h-3 w-3" />
                      <span>{Math.round(hour.windSpeed)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Kunde inte hämta väderdata
              </p>
            )}
            
            {weatherData && weatherData.length > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Thermometer className="h-4 w-4" />
                  <span>Temperatur i °C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="h-4 w-4" />
                  <span>Vind i m/s</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
