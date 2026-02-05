import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Fuel, TrendingDown, Clock, Ship, BarChart3, Activity } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { Link } from 'react-router-dom';

type PeriodType = 'month' | 'quarter' | 'year' | 'all';

export default function BunkerStats() {
  const { selectedOrgId } = useOrganization();
  const { data: vessels } = useOrgVessels(selectedOrgId);
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodType>('year');

  const vesselIds = vessels?.map(v => v.id) || [];

  const getDateRange = (periodType: PeriodType) => {
    const now = new Date();
    switch (periodType) {
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'quarter':
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'all':
        return { start: new Date('2020-01-01'), end: now };
    }
  };

  const dateRange = getDateRange(period);

  // Fetch logbooks with bunker data and engine hours
  const { data: logbooksData, isLoading } = useQuery({
    queryKey: ['bunker-stats', vesselIds, selectedVessel, period],
    queryFn: async () => {
      if (vesselIds.length === 0) return { logbooks: [], engineHours: [] };
      
      const targetVesselIds = selectedVessel === 'all' ? vesselIds : [selectedVessel];
      
      // Fetch logbooks with bunker info
      const { data: logbooks, error: logbooksError } = await supabase
        .from('logbooks')
        .select('id, vessel_id, date, bunker_liters, status')
        .in('vessel_id', targetVesselIds)
        .gte('date', dateRange.start.toISOString().split('T')[0])
        .lte('date', dateRange.end.toISOString().split('T')[0])
        .order('date', { ascending: false });
      
      if (logbooksError) throw logbooksError;
      
      // Fetch engine hours for these logbooks
      const logbookIds = logbooks?.map(l => l.id) || [];
      let engineHours: any[] = [];
      
      if (logbookIds.length > 0) {
        const { data: ehData, error: ehError } = await supabase
          .from('logbook_engine_hours')
          .select('logbook_id, start_hours, stop_hours, engine_name')
          .in('logbook_id', logbookIds);
        
        if (ehError) throw ehError;
        engineHours = ehData || [];
      }
      
      return { logbooks: logbooks || [], engineHours };
    },
    enabled: vesselIds.length > 0,
  });

  // Calculate statistics per vessel
  const calculateStats = () => {
    if (!logbooksData?.logbooks) return [];

    const vesselStats = new Map<string, {
      vesselId: string;
      vesselName: string;
      totalBunker: number;
      totalHours: number;
      bunkerEvents: number;
      logbookCount: number;
    }>();

    // Initialize vessel stats
    const targetVessels = selectedVessel === 'all' 
      ? vessels 
      : vessels?.filter(v => v.id === selectedVessel);
    
    targetVessels?.forEach(v => {
      vesselStats.set(v.id, {
        vesselId: v.id,
        vesselName: v.name,
        totalBunker: 0,
        totalHours: 0,
        bunkerEvents: 0,
        logbookCount: 0,
      });
    });

    // Aggregate logbook data
    logbooksData.logbooks.forEach(logbook => {
      const stats = vesselStats.get(logbook.vessel_id);
      if (!stats) return;

      stats.logbookCount++;
      
      if (logbook.bunker_liters && logbook.bunker_liters > 0) {
        stats.totalBunker += logbook.bunker_liters;
        stats.bunkerEvents++;
      }

      // Sum engine hours for this logbook
      const logbookEngineHours = logbooksData.engineHours.filter(eh => eh.logbook_id === logbook.id);
      logbookEngineHours.forEach(eh => {
        if (eh.start_hours != null && eh.stop_hours != null && eh.stop_hours > eh.start_hours) {
          stats.totalHours += (eh.stop_hours - eh.start_hours);
        }
      });
    });

    return Array.from(vesselStats.values());
  };

  const stats = calculateStats();
  
  const totalBunker = stats.reduce((sum, s) => sum + s.totalBunker, 0);
  const totalHours = stats.reduce((sum, s) => sum + s.totalHours, 0);
  const avgConsumption = totalHours > 0 ? (totalBunker / totalHours).toFixed(1) : '–';

  // Get recent bunker events
  const recentBunkerEvents = logbooksData?.logbooks
    .filter(l => l.bunker_liters && l.bunker_liters > 0)
    .slice(0, 10)
    .map(l => ({
      ...l,
      vesselName: vessels?.find(v => v.id === l.vessel_id)?.name || 'Okänt',
    })) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with navigation back */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/portal/admin/status" className="text-sm text-muted-foreground hover:text-foreground">
                Statusöversikt
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Bunkerstatistik</span>
            </div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Fuel className="h-8 w-8" />
              Bunkerstatistik
            </h1>
            <p className="text-muted-foreground mt-1">
              Dieselförbrukning och bunkringshistorik
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-48">
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj fartyg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla fartyg</SelectItem>
                    {vessels?.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodType)} className="w-auto">
                <TabsList>
                  <TabsTrigger value="month">Månad</TabsTrigger>
                  <TabsTrigger value="quarter">Kvartal</TabsTrigger>
                  <TabsTrigger value="year">År</TabsTrigger>
                  <TabsTrigger value="all">Allt</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Fuel className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBunker.toLocaleString('sv-SE')}</p>
                <p className="text-xs text-muted-foreground">Liter bunkrat</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHours.toLocaleString('sv-SE', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-muted-foreground">Maskintimmar</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingDown className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgConsumption}</p>
                <p className="text-xs text-muted-foreground">Liter/timme</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <BarChart3 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentBunkerEvents.length}</p>
                <p className="text-xs text-muted-foreground">Bunkringar</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Per vessel breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Förbrukning per fartyg
              </CardTitle>
              <CardDescription>Baserat på bunkrat bränsle och körda maskintimmar</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
                </div>
              ) : stats.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ingen data för vald period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fartyg</TableHead>
                      <TableHead className="text-right">Bunkrat (L)</TableHead>
                      <TableHead className="text-right">Timmar</TableHead>
                      <TableHead className="text-right">L/h</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.map(s => (
                      <TableRow key={s.vesselId}>
                        <TableCell className="font-medium">{s.vesselName}</TableCell>
                        <TableCell className="text-right">{s.totalBunker.toLocaleString('sv-SE')}</TableCell>
                        <TableCell className="text-right">{s.totalHours.toLocaleString('sv-SE', { maximumFractionDigits: 0 })}</TableCell>
                        <TableCell className="text-right">
                          {s.totalHours > 0 ? (
                            <Badge variant="outline">
                              {(s.totalBunker / s.totalHours).toFixed(1)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent bunker events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Senaste bunkringar
              </CardTitle>
              <CardDescription>De senaste tillfällena då diesel tankades</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded" />)}
                </div>
              ) : recentBunkerEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga bunkringar registrerade</p>
              ) : (
                <div className="space-y-3">
                  {recentBunkerEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="font-medium">{event.vesselName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(event.date), 'PPP', { locale: sv })}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-base">
                        +{event.bunker_liters?.toLocaleString('sv-SE')} L
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info note */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Obs:</strong> Förbrukning per timme beräknas genom att dividera totalt bunkrad diesel med totala maskintimmar. 
              Detta ger en uppskattning av den genomsnittliga förbrukningen, men exakt förbrukning kan variera beroende på körförhållanden.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
