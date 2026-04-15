import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { useToast } from '@/hooks/use-toast';
import { Home, FileText, Cloud, Download, Wind, AlertTriangle, ExternalLink, Navigation, Gauge, Check, CheckCheck } from 'lucide-react';
import { format, addDays } from 'date-fns';
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

type DateSelection = 'today' | 'tomorrow';

export default function Startsida() {
  const { selectedOrgId } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: orgSettings } = useOrgSettings();
  const [dateSelection, setDateSelection] = useState<DateSelection>('today');
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const selectedDate = dateSelection === 'today' 
    ? format(new Date(), 'yyyy-MM-dd')
    : format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // Fetch all messages active on the selected date (single-day + multi-day)
  const { data: activeMessages, isLoading: messageLoading } = useQuery({
    queryKey: ['intranet-messages-active', selectedOrgId, selectedDate],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      // Messages where: message_date <= selectedDate AND (end_date >= selectedDate OR end_date IS NULL AND message_date = selectedDate)
      const { data, error } = await supabase
        .from('intranet_messages')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .lte('message_date', selectedDate)
        .or(`end_date.gte.${selectedDate},and(end_date.is.null,message_date.eq.${selectedDate})`)
        .order('requires_confirmation', { ascending: false })
        .order('message_date');
      if (error) throw error;

      // Fetch documents for all messages
      if (!data || data.length === 0) return [];
      const messageIds = data.map(m => m.id);
      const { data: documents } = await supabase
        .from('intranet_documents')
        .select('id, display_name, file_name, file_url, message_id')
        .in('message_id', messageIds)
        .order('created_at');

      return data.map(msg => ({
        ...msg,
        documents: documents?.filter(d => d.message_id === msg.id) || [],
      }));
    },
    enabled: !!selectedOrgId,
  });

  // Fetch user's confirmations
  const { data: userConfirmations } = useQuery({
    queryKey: ['intranet-user-confirmations', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('intranet_confirmations')
        .select('message_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data?.map(c => c.message_id) || [];
    },
    enabled: !!user,
  });

  const confirmMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!user) throw new Error('Ej inloggad');
      const { error } = await supabase
        .from('intranet_confirmations')
        .insert({ message_id: messageId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intranet-user-confirmations'] });
      toast({ title: 'Bekräftat', description: 'Du har bekräftat meddelandet.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const smhiLon = orgSettings?.smhi_forecast_lon ?? 18.0686;
  const smhiLat = orgSettings?.smhi_forecast_lat ?? 59.3293;

  // Fetch weather from SMHI
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: ['smhi-weather', smhiLon, smhiLat],
    queryFn: async () => {
      try {
        const response = await fetch(
          `https://opendata-download-metfcst.smhi.se/api/category/pmp3g/version/2/geotype/point/lon/${smhiLon}/lat/${smhiLat}/data.json`
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

  const windStationId = orgSettings?.weather_station_id ?? '141';
  const windSource = orgSettings?.weather_station_source ?? 'viva';

  // Fetch wind data from Sjöfartsverket/SMHI
  const { data: windData, isLoading: windLoading } = useQuery({
    queryKey: ['wind-data', windStationId, windSource],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-wind-data', {
          body: { stationId: windStationId, source: windSource },
        });
        if (error) throw error;
        return data?.data as WindData || null;
      } catch (error) {
        console.error('Wind data fetch error:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 10,
  });

  const ufsChartNumbers = orgSettings?.ufs_chart_numbers ?? ['99'];

  // Fetch UFS warnings
  const { data: ufsWarnings, isLoading: ufsLoading } = useQuery({
    queryKey: ['ufs-warnings', ufsChartNumbers],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fetch-ufs-warnings', {
          body: { limit: 20, chartNumbers: ufsChartNumbers.join(',') },
        });
        if (error) throw error;
        return (data?.data as UFSWarning[]) || [];
      } catch (error) {
        console.error('UFS fetch error:', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 60,
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

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const urlParts = fileUrl.split('/intranet-documents/');
      if (urlParts.length < 2) {
        throw new Error('Invalid file URL');
      }
      const filePath = decodeURIComponent(urlParts[1]);
      
      const { data, error } = await supabase.storage
        .from('intranet-documents')
        .createSignedUrl(filePath, 300);
      
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL returned');
      
      setViewerUrl(data.signedUrl);
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

        {/* Messages with Day Toggle */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                {dateSelection === 'today' ? 'Dagens meddelanden' : 'Morgondagens meddelanden'}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={dateSelection === 'today' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateSelection('today')}
                >
                  Idag
                </Button>
                <Button
                  variant={dateSelection === 'tomorrow' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateSelection('tomorrow')}
                >
                  Imorgon
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {messageLoading ? (
              <p className="text-muted-foreground">Laddar...</p>
            ) : activeMessages && activeMessages.length > 0 ? (
              <div className="space-y-4">
                {activeMessages.map((msg) => {
                  const isConfirmed = userConfirmations?.includes(msg.id);
                  const isMultiDay = !!msg.end_date;
                  return (
                    <div key={msg.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{msg.title}</h3>
                            {isMultiDay && (
                              <Badge variant="secondary" className="text-xs">
                                {format(new Date(msg.message_date + 'T00:00:00'), 'd MMM', { locale: sv })} – {format(new Date(msg.end_date + 'T00:00:00'), 'd MMM', { locale: sv })}
                              </Badge>
                            )}
                          </div>
                          {msg.content && (
                            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        {msg.requires_confirmation && (
                          isConfirmed ? (
                            <Badge variant="outline" className="shrink-0 gap-1 text-primary border-primary">
                              <CheckCheck className="h-3.5 w-3.5" />
                              Bekräftad
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => confirmMessage.mutate(msg.id)}
                              disabled={confirmMessage.isPending}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Bekräfta
                            </Button>
                          )
                        )}
                      </div>

                      {msg.documents && msg.documents.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.documents.map((doc: { id: string; display_name: string; file_name: string; file_url: string }) => (
                            <Button
                              key={doc.id}
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(doc.file_url, doc.file_name)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              {doc.display_name}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Legacy single document */}
                      {msg.document_url && msg.document_name && (!msg.documents || msg.documents.length === 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(msg.document_url!, msg.document_name!)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {msg.document_name}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Inga meddelanden för {dateSelection === 'today' ? 'idag' : 'imorgon'}
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
                        Prognos kommande timmar
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
                      className="block p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-mono">
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
              ) : ufsWarnings ? (
                <p className="text-muted-foreground text-center py-4">
                  Inga aktiva UFS-varningar för valda sjökort
                </p>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Kunde inte hämta UFS-varningar
                </p>
              )}
              
              {ufsWarnings && ufsWarnings.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <a
                    href={`https://ufs.sjofartsverket.se/Notice/Search/?SearchFormModel.ChartNumbers=${encodeURIComponent(ufsChartNumbers.join(','))}&SearchFormModel.SearchTimePeriod=0`}
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

      {/* Document viewer dialog */}
      <Dialog open={!!viewerUrl} onOpenChange={(open) => !open && setViewerUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-[90vh] p-2 sm:p-4">
          {viewerUrl && (
            <iframe
              src={viewerUrl}
              title="Dokument"
              className="w-full h-full rounded border-0"
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
