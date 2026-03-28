import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from 'react-router-dom';
import { AlertTriangle, Wrench, Award, Ship, CheckCircle, Clock, ChevronDown, Users } from 'lucide-react';
import { AiStatusSummary } from '@/components/admin/AiStatusSummary';
import { format, addDays, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';

const FAULT_PRIORITY_LABELS: Record<string, string> = {
  lag: 'Låg', normal: 'Normal', hog: 'Hög', kritisk: 'Kritisk',
};
const FAULT_STATUS_LABELS: Record<string, string> = {
  ny: 'Ny', varvsatgard: 'Varvsåtgärd', arbete_pagar: 'Arbete pågår', atgardad: 'Åtgärdad', avslutad: 'Avslutad',
};

const PERIOD_OPTIONS = [
  { value: '30', label: '30 dagar' },
  { value: '60', label: '60 dagar' },
  { value: '90', label: '90 dagar' },
  { value: '180', label: '180 dagar' },
  { value: '365', label: '1 år' },
];

export default function AdminStatus() {
  const { selectedOrgId } = useOrganization();
  const { data: vessels } = useOrgVessels(selectedOrgId);
  const { data: profiles } = useOrgProfiles(selectedOrgId);
  const [period, setPeriod] = useState('60');
  const queryClient = useQueryClient();

  const vesselIds = vessels?.map(v => v.id) || [];
  const profileIds = profiles?.map(p => p.id) || [];

  // --- Realtime passenger counts ---
  const today = new Date().toISOString().split('T')[0];

  const { data: activeSessions = [] } = useQuery({
    queryKey: ['status-active-sessions', vesselIds, today],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const todayStart = `${today}T00:00:00`;
      const todayEnd = `${today}T23:59:59`;
      const { data, error } = await supabase
        .from('passenger_sessions')
        .select('id, vessel_id, is_active')
        .in('vessel_id', vesselIds)
        .eq('is_active', true)
        .gte('started_at', todayStart)
        .lte('started_at', todayEnd);
      if (error) throw error;
      return data || [];
    },
    enabled: vesselIds.length > 0,
  });

  const activeSessionIds = activeSessions.map(s => s.id);

  const { data: passengerEntries = [] } = useQuery({
    queryKey: ['status-passenger-entries', activeSessionIds],
    queryFn: async () => {
      if (activeSessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from('passenger_entries')
        .select('session_id, pax_on, pax_off')
        .in('session_id', activeSessionIds);
      if (error) throw error;
      return data || [];
    },
    enabled: activeSessionIds.length > 0,
  });

  // Realtime subscription for passenger entries changes
  useEffect(() => {
    if (activeSessionIds.length === 0) return;
    
    const channel = supabase
      .channel('status-passenger-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passenger_entries' }, () => {
        queryClient.invalidateQueries({ queryKey: ['status-passenger-entries'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passenger_sessions' }, () => {
        queryClient.invalidateQueries({ queryKey: ['status-active-sessions'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSessionIds.length, queryClient]);

  const vesselPassengerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const session of activeSessions) {
      const sessionEntries = passengerEntries.filter(e => e.session_id === session.id);
      const onboard = sessionEntries.reduce((sum, e) => sum + e.pax_on - e.pax_off, 0);
      counts[session.vessel_id] = (counts[session.vessel_id] || 0) + onboard;
    }
    return counts;
  }, [activeSessions, passengerEntries]);

  const vesselsWithPassengers = vessels?.filter(v => vesselPassengerCounts[v.id] !== undefined) || [];

  // --- Existing queries ---
  const { data: faultCases } = useQuery({
    queryKey: ['status-fault-cases', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .in('status', ['ny', 'varvsatgard', 'arbete_pagar'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const { data: engineHours } = useQuery({
    queryKey: ['status-engine-hours', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase.from('vessel_engine_hours').select('*').in('vessel_id', vesselIds);
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const { data: controlStates } = useQuery({
    queryKey: ['status-control-states', vesselIds, engineHours, period],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_control_point_state')
        .select(`*, control_point:control_points(name, type), vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .order('next_due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      
      const periodDays = parseInt(period);
      const now = new Date();
      return data?.map(s => {
        let dynamicStatus: string = 'ok';
        let daysOrHoursInfo: string | null = null;
        
        if (!s.last_done_date && !s.next_due_date && !s.next_due_at_engine_hours) {
          dynamicStatus = 'ej_utford';
          daysOrHoursInfo = 'Ej utförd';
        } else if (s.next_due_date) {
          const daysUntil = differenceInDays(new Date(s.next_due_date), now);
          if (daysUntil < 0) {
            dynamicStatus = 'forfallen';
            daysOrHoursInfo = `${Math.abs(daysUntil)} dagar sedan`;
          } else if (daysUntil <= periodDays) {
            dynamicStatus = 'kommande';
            daysOrHoursInfo = daysUntil === 0 ? 'Idag' : daysUntil === 1 ? 'Imorgon' : `${daysUntil} dagar`;
          }
        } else if (s.next_due_at_engine_hours && s.engine_id) {
          const currentEngine = engineHours?.find(e => e.id === s.engine_id);
          if (currentEngine?.current_hours) {
            const hoursRemaining = s.next_due_at_engine_hours - currentEngine.current_hours;
            if (hoursRemaining < 0) {
              dynamicStatus = 'forfallen';
              daysOrHoursInfo = `${Math.abs(hoursRemaining)} h sedan`;
            } else if (hoursRemaining <= 100) {
              dynamicStatus = 'kommande';
              daysOrHoursInfo = `${hoursRemaining} h kvar`;
            }
          }
        }
        
        return { ...s, dynamicStatus, daysOrHoursInfo };
      }).filter(s => s.dynamicStatus !== 'ok');
    },
    enabled: vesselIds.length > 0 && engineHours !== undefined,
  });

  const { data: vesselCertificates } = useQuery({
    queryKey: ['status-vessel-certificates', vesselIds, period],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const cutoff = addDays(new Date(), parseInt(period));
      const { data, error } = await supabase
        .from('vessel_certificates')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .lte('expiry_date', cutoff.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const { data: userCertificates } = useQuery({
    queryKey: ['status-user-certificates', profileIds, period],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const cutoff = addDays(new Date(), parseInt(period));
      const { data, error } = await supabase
        .from('user_certificates')
        .select(`*, profile:profiles(full_name), certificate_type:certificate_types(name)`)
        .in('profile_id', profileIds)
        .lte('expiry_date', cutoff.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: profileIds.length > 0,
  });

  const { data: deviations } = useQuery({
    queryKey: ['status-deviations', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('deviations')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .in('status', ['oppen', 'under_utredning'])
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const getDaysUntil = (dateStr: string) => {
    const days = differenceInDays(new Date(dateStr), new Date());
    if (days < 0) return `Utgånget ${Math.abs(days)}d sedan`;
    if (days === 0) return 'Idag';
    if (days === 1) return 'Imorgon';
    return `${days} dagar`;
  };

  const getUrgencyVariant = (dateStr: string): 'destructive' | 'default' | 'secondary' => {
    const days = differenceInDays(new Date(dateStr), new Date());
    if (days <= 7) return 'destructive';
    if (days <= 30) return 'default';
    return 'secondary';
  };

  const counts = {
    faults: faultCases?.length || 0,
    controls: controlStates?.length || 0,
    vesselCerts: vesselCertificates?.length || 0,
    userCerts: userCertificates?.length || 0,
    deviations: deviations?.length || 0,
  };
  const totalIssues = Object.values(counts).reduce((a, b) => a + b, 0);
  const forfallnaControls = controlStates?.filter(c => (c as any).dynamicStatus === 'forfallen' || (c as any).dynamicStatus === 'ej_utford').length || 0;
  const kritiskaFaults = faultCases?.filter(f => f.priority === 'kritisk' || f.priority === 'hog').length || 0;

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Statusöversikt</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {totalIssues} ärenden kräver uppmärksamhet
            </p>
          </div>
        </div>

        {/* Live passenger counts */}
        {vessels && vessels.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {vessels.map(vessel => {
              const hasActiveSession = vesselPassengerCounts[vessel.id] !== undefined;
              const count = vesselPassengerCounts[vessel.id] || 0;
              const maxPax = (vessel as any).max_passengers;
              const isOver = maxPax && count > maxPax;
              return (
                <Card key={vessel.id} className={`p-3 ${isOver ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isOver ? 'bg-destructive/10' : hasActiveSession ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Users className={`h-4 w-4 ${isOver ? 'text-destructive' : hasActiveSession ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{vessel.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-lg font-bold leading-none ${isOver ? 'text-destructive' : !hasActiveSession ? 'text-muted-foreground' : ''}`}>
                          {count}
                        </span>
                        {maxPax && (
                          <span className="text-xs text-muted-foreground">/ {maxPax}</span>
                        )}
                      </div>
                    </div>
                    <div className="relative h-2 w-2 flex-shrink-0">
                      {hasActiveSession ? (
                        <>
                          <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse" />
                          <span className="absolute inset-0 rounded-full bg-green-500" />
                        </>
                      ) : (
                        <span className="absolute inset-0 rounded-full bg-destructive" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="overview">Översikt</TabsTrigger>
            <TabsTrigger value="issues" className="gap-1.5">
              Åtgärder
              {totalIssues > 0 && (
                <Badge variant="secondary" className="text-xs h-5 px-1.5">{totalIssues}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Overview tab - vessels & passengers only */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            {vessels && vessels.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Ship className="h-4 w-4" />
                    Fartyg ({vessels.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {vessels.map(v => {
                      const paxCount = vesselPassengerCounts[v.id];
                      const maxPax = (v as any).max_passengers;
                      const hasActiveSession = paxCount !== undefined;
                      return (
                        <Link key={v.id} to={`/portal/admin/vessels/${v.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors">
                          <span className="text-sm font-medium">{v.name}</span>
                          <div className="flex items-center gap-2">
                            {hasActiveSession && (
                              <Badge variant={maxPax && paxCount > maxPax ? 'destructive' : 'default'} className="text-xs gap-1">
                                <Users className="h-3 w-3" />
                                {paxCount}{maxPax ? `/${maxPax}` : ''}
                              </Badge>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <AiStatusSummary organizationId={selectedOrgId} periodDays={parseInt(period)} />
          </TabsContent>

          {/* Issues tab - all oversight items */}
          <TabsContent value="issues" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SummaryCard icon={Wrench} count={counts.faults} label="Felärenden" alert={kritiskaFaults > 0} sublabel={kritiskaFaults > 0 ? `${kritiskaFaults} kritiska/höga` : undefined} />
              <SummaryCard icon={CheckCircle} count={counts.controls} label="Underhåll" alert={forfallnaControls > 0} sublabel={forfallnaControls > 0 ? `${forfallnaControls} förfallna` : undefined} />
              <SummaryCard icon={Ship} count={counts.vesselCerts} label="Fartygscert." />
              <SummaryCard icon={Award} count={counts.userCerts} label="Personliga cert." />
              <SummaryCard icon={AlertTriangle} count={counts.deviations} label="Avvikelser" />
            </div>

            <div className="flex justify-end">
              <div className="space-y-1">
                <Label className="text-xs">Tidsperiod</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fault Cases */}
            <StatusSection
              title="Öppna felärenden"
              icon={<Wrench className="h-4 w-4" />}
              count={counts.faults}
              alertCount={kritiskaFaults}
              defaultOpen={kritiskaFaults > 0}
            >
              {faultCases?.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Inga öppna felärenden</p>
              ) : (
                <div className="divide-y">
                  {faultCases?.map(fc => (
                    <Link key={fc.id} to={`/portal/fault-cases/${fc.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{fc.title}</p>
                        <p className="text-xs text-muted-foreground">{(fc as any).vessel?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={fc.priority === 'kritisk' || fc.priority === 'hog' ? 'destructive' : 'secondary'} className="text-xs">
                          {FAULT_PRIORITY_LABELS[fc.priority]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{FAULT_STATUS_LABELS[fc.status]}</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </StatusSection>

            {/* Control Points */}
            <StatusSection
              title="Underhåll"
              icon={<CheckCircle className="h-4 w-4" />}
              count={counts.controls}
              alertCount={forfallnaControls}
              defaultOpen={forfallnaControls > 0}
            >
              {controlStates?.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Inga kommande egenkontroller</p>
              ) : (
                <div className="divide-y">
                  {controlStates?.map(cs => (
                    <Link key={cs.id} to="/portal/self-control" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{(cs as any).control_point?.name}</p>
                        <p className="text-xs text-muted-foreground">{(cs as any).vessel?.name}</p>
                      </div>
                      {(cs as any).daysOrHoursInfo && (
                        <Badge variant={(cs as any).dynamicStatus === 'forfallen' ? 'destructive' : (cs as any).dynamicStatus === 'ej_utford' ? 'outline' : 'secondary'} className="text-xs">
                          {(cs as any).daysOrHoursInfo}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </StatusSection>

            {/* Vessel Certificates */}
            <StatusSection
              title="Fartygscertifikat"
              icon={<Ship className="h-4 w-4" />}
              count={counts.vesselCerts}
              alertCount={vesselCertificates?.filter(vc => differenceInDays(new Date(vc.expiry_date), new Date()) < 0).length || 0}
            >
              {vesselCertificates?.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Inga certifikat löper ut inom vald period</p>
              ) : (
                <div className="divide-y">
                  {vesselCertificates?.map(vc => (
                    <div key={vc.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{vc.name}</p>
                        <p className="text-xs text-muted-foreground">{(vc as any).vessel?.name}</p>
                      </div>
                      <Badge variant={getUrgencyVariant(vc.expiry_date)} className="text-xs">{getDaysUntil(vc.expiry_date)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </StatusSection>

            {/* User Certificates */}
            <StatusSection
              title="Personliga certifikat"
              icon={<Award className="h-4 w-4" />}
              count={counts.userCerts}
              alertCount={userCertificates?.filter(uc => differenceInDays(new Date(uc.expiry_date), new Date()) < 0).length || 0}
            >
              {userCertificates?.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Inga certifikat löper ut inom vald period</p>
              ) : (
                <div className="divide-y">
                  {userCertificates?.map(uc => (
                    <Link key={uc.id} to="/portal/qualifications" className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{(uc as any).certificate_type?.name}</p>
                        <p className="text-xs text-muted-foreground">{(uc as any).profile?.full_name}</p>
                      </div>
                      <Badge variant={getUrgencyVariant(uc.expiry_date)} className="text-xs">{getDaysUntil(uc.expiry_date)}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </StatusSection>

            {/* Deviations */}
            <StatusSection
              title="Öppna avvikelser"
              icon={<AlertTriangle className="h-4 w-4" />}
              count={counts.deviations}
              alertCount={deviations?.filter(d => d.severity === 'hog').length || 0}
            >
              {deviations?.length === 0 ? (
                <p className="text-muted-foreground text-sm p-4">Inga öppna avvikelser</p>
              ) : (
                <div className="divide-y">
                  {deviations?.map(d => (
                    <Link key={d.id} to={`/portal/deviations/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{(d as any).vessel?.name} • {format(new Date(d.date), 'd MMM yyyy', { locale: sv })}</p>
                      </div>
                      <Badge variant={d.severity === 'hog' ? 'destructive' : d.severity === 'medel' ? 'default' : 'secondary'} className="text-xs">
                        {d.severity === 'hog' ? 'Hög' : d.severity === 'medel' ? 'Medel' : 'Låg'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </StatusSection>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// --- Sub-components ---

function SummaryCard({ icon: Icon, count, label, alert, sublabel }: {
  icon: any; count: number; label: string; alert?: boolean; sublabel?: string;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${alert ? 'bg-destructive/10' : 'bg-muted'}`}>
          <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <p className="text-xl font-bold leading-none">{count}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sublabel && <p className="text-xs text-destructive">{sublabel}</p>}
        </div>
      </div>
    </Card>
  );
}

function StatusSection({ title, icon, count, alertCount = 0, defaultOpen = false, children }: {
  title: string; icon: React.ReactNode; count: number; alertCount?: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen || count > 0}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2">
                {icon}
                {title}
              </span>
              <span className="flex items-center gap-2">
                {alertCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {alertCount} kritiska
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">{count}</Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
              </span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
