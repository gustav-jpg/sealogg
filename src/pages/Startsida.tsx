import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Home, FileText, Cloud, Download, Wind, AlertTriangle, ExternalLink, Navigation, Gauge } from 'lucide-react';
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

interface UFSWarning {
  noticeNumber: string;
  chartNumber: string;
  publishedDate: string;
  headline: string;
  isTemporary: boolean;
  isPreliminary: boolean;
  url: string;
}

interface WindData {
  stationName: string;
  gustSpeed: string;
  averageSpeed: string;
  direction: string;
  timestamp: string;
  source: string;
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
        const response = await fetch(
          'https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/18.0686/lat/59.3293/data.json'
        );
        if (!response.ok) throw new Error('Failed to fetch weather');
        const data = await response.json();
        
        const now = new Date();
        const next24h = data.timeSeries
          .filter((ts: any) => {
            const time = new Date(ts.validTime);
            return time >= now && time <= new Date(now.getTime() + 24 * 60 * 60 * 1000);
          })
          .slice(0, 8)
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
    staleTime: 1000 * 60 * 30,
  });

  // Fetch wind data from Sjöfartsverket/SMHI
  const { data: windData, isLoading: windLoading } = useQuery({
    queryKey: ['wind-data'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-wind-data', {
          body: { stationId: '141', source: 'viva' },
        });
        if (error) throw error;
        return data?.data as WindData || null;
      } catch (error) {
        console.error('Wind data fetch error:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Fetch UFS warnings
  const { data: ufsWarnings, isLoading: ufsLoading } = useQuery({
    queryKey: ['ufs-warnings'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-ufs-warnings', {
          body: { limit: 20 },
        });
        if (error) throw error;
        return data?.data as UFSWarning[] || [];
      } catch (error) {
        console.error('UFS fetch error:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const getWeatherIcon = (symbol: number) => {
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

        {/* Wind and UFS side by side on larger screens */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Wind Data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wind className="h-5 w-5" />
                Aktuellt väder
                <Badge variant="outline" className="ml-auto text-xs font-normal">
                  {windData?.source || 'SMHI'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {windLoading ? (
                <p className="text-muted-foreground">Laddar vinddata...</p>
              ) : windData ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">{windData.stationName}</p>
                    <p className="text-xs text-muted-foreground">Uppdaterad: {windData.timestamp}</p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                      <Wind className="h-5 w-5 text-primary mb-1" />
                      <span className="text-xs text-muted-foreground">Medelvind</span>
                      <span className="font-semibold text-lg">{windData.averageSpeed}</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                      <Gauge className="h-5 w-5 text-orange-500 mb-1" />
                      <span className="text-xs text-muted-foreground">Byvind</span>
                      <span className="font-semibold text-lg">{windData.gustSpeed}</span>
                    </div>
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                      <Navigation className="h-5 w-5 text-blue-500 mb-1" />
                      <span className="text-xs text-muted-foreground">Riktning</span>
                      <span className="font-semibold text-lg">{windData.direction}</span>
                    </div>
                  </div>
                  
                  {/* SMHI Weather Forecast */}
                  {weatherData && weatherData.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Cloud className="h-3 w-3" />
                        Prognos kommande timmar (Stockholm)
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {weatherData.slice(0, 4).map((hour: WeatherData, index: number) => (
                          <div
                            key={index}
                            className="flex flex-col items-center p-2 rounded-lg bg-muted/30 text-center"
                          >
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(hour.time), 'HH:mm')}
                            </span>
                            <span className="text-lg my-0.5">{getWeatherIcon(hour.symbol)}</span>
                            <span className="font-medium text-sm">{Math.round(hour.temperature)}°</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Kunde inte hämta väderdata
                </p>
              )}
            </CardContent>
          </Card>

          {/* UFS Warnings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5" />
                UFS Varningar
                <Badge variant="outline" className="ml-auto text-xs font-normal">Sjöfartsverket</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ufsLoading ? (
                <p className="text-muted-foreground">Laddar UFS-data...</p>
              ) : ufsWarnings && ufsWarnings.length > 0 ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {ufsWarnings.map((warning, index) => (
                    <a
                      key={index}
                      href={warning.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs font-mono">
                            {warning.noticeNumber}
                          </Badge>
                          {warning.isTemporary && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              Tillfällig
                            </Badge>
                          )}
                          {warning.isPreliminary && (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                              Preliminär
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                          <span>{warning.publishedDate}</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed">
                        {warning.headline || 'Ingen rubrik tillgänglig'}
                      </p>
                      {warning.chartNumber && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Sjökort: {warning.chartNumber}
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Kunde inte hämta UFS-varningar
                </p>
              )}
              
              {ufsWarnings && ufsWarnings.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <a
                    href="https://ufs.sjofartsverket.se/Notice/Search/?SearchFormModel.ChartNumbers=99&SearchFormModel.SearchTimePeriod=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1.5"
                  >
                    Visa alla varningar på Sjöfartsverket
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
