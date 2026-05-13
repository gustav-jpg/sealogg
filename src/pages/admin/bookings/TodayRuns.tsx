import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO, addDays, startOfDay, endOfDay, isToday } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Ship, Calendar as CalIcon, ChevronLeft, ChevronRight, Users, MapPin, Clock, ArrowRight, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TodayRuns() {
  const { selectedOrgId } = useOrganization();
  const { data: vessels } = useOrgVessels(selectedOrgId);
  const [vesselId, setVesselId] = useState<string>('all');
  const [date, setDate] = useState<Date>(new Date());

  const { data: trips, isLoading } = useQuery({
    queryKey: ['today-runs', selectedOrgId, format(date, 'yyyy-MM-dd')],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const from = startOfDay(date).toISOString();
      const to = endOfDay(date).toISOString();
      const { data, error } = await supabase
        .from('booking_departures')
        .select('*, booking_routes(name), vessels(name), bookings(id, customer_name, total_passengers, status, customer_phone, checked_in_at)')
        .eq('organization_id', selectedOrgId!)
        .gte('departure_at', from)
        .lte('departure_at', to)
        .order('departure_at');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!trips) return [];
    if (vesselId === 'all') return trips;
    if (vesselId === 'unassigned') return trips.filter((t: any) => !t.vessel_id);
    return trips.filter((t: any) => t.vessel_id === vesselId);
  }, [trips, vesselId]);

  const totals = useMemo(() => {
    const departures = filtered.length;
    let pax = 0;
    let checked = 0;
    filtered.forEach((t: any) => {
      (t.bookings || []).filter((b: any) => b.status !== 'avbokad').forEach((b: any) => {
        pax += b.total_passengers || 0;
        if (b.checked_in_at) checked += b.total_passengers || 0;
      });
    });
    return { departures, pax, checked };
  }, [filtered]);

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ship className="h-6 w-6" />Dagens körningar</h1>
          <p className="text-sm text-muted-foreground">Körschema för befälhavare — välj fartyg och dag.</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[200px] justify-start font-normal">
                  <CalIcon className="h-4 w-4 mr-2" />
                  {format(date, 'EEEE d MMMM yyyy', { locale: sv })}
                  {isToday(date) && <Badge className="ml-2" variant="secondary">Idag</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  locale={sv}
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>Idag</Button>

            <div className="ml-auto flex items-center gap-2">
              <Ship className="h-4 w-4 text-muted-foreground" />
              <Select value={vesselId} onValueChange={setVesselId}>
                <SelectTrigger className="min-w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla fartyg</SelectItem>
                  <SelectItem value="unassigned">Ej tilldelade</SelectItem>
                  {vessels?.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPI */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Avgångar" value={totals.departures} icon={Ship} />
          <Kpi label="Bokade" value={totals.pax} icon={Users} />
          <Kpi label="Incheckade" value={totals.checked} icon={CheckCircle2} accent={totals.pax > 0 && totals.checked === totals.pax ? 'success' : undefined} />
        </div>

        {/* Schedule */}
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Laddar...</div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">
            Inga avgångar planerade {isToday(date) ? 'idag' : 'denna dag'} för valt fartyg.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((t: any) => <ScheduleRow key={t.id} trip={t} />)}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function Kpi({ label, value, icon: Icon, accent }: any) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg bg-muted', accent === 'success' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400')}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleRow({ trip }: any) {
  const bookings = (trip.bookings || []).filter((b: any) => b.status !== 'avbokad');
  const pax = bookings.reduce((s: number, b: any) => s + (b.total_passengers || 0), 0);
  const checked = bookings.reduce((s: number, b: any) => s + (b.checked_in_at ? (b.total_passengers || 0) : 0), 0);
  const fillPct = trip.max_passengers > 0 ? Math.round((pax / trip.max_passengers) * 100) : 0;
  const isPrivate = trip.trip_type === 'private';
  const isCanceled = trip.status === 'installd';
  const allCheckedIn = pax > 0 && checked === pax;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const toggle = useMutation({
    mutationFn: async (b: any) => {
      const payload = b.checked_in_at
        ? { checked_in_at: null, checked_in_count: 0 }
        : { checked_in_at: new Date().toISOString(), checked_in_count: b.total_passengers };
      const { error } = await supabase.from('bookings').update(payload as any).eq('id', b.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today-runs'] }),
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const checkInAll = useMutation({
    mutationFn: async () => {
      const ids = bookings.filter((b: any) => !b.checked_in_at).map((b: any) => b.id);
      if (ids.length === 0) return;
      const now = new Date().toISOString();
      // Update each (need per-row count)
      await Promise.all(bookings.filter((b: any) => !b.checked_in_at).map((b: any) =>
        supabase.from('bookings').update({ checked_in_at: now, checked_in_count: b.total_passengers } as any).eq('id', b.id)
      ));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['today-runs'] }); toast({ title: 'Alla incheckade' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card className={cn('transition', isCanceled && 'opacity-60')}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="text-center shrink-0 w-16">
              <div className="text-2xl font-bold tabular-nums leading-none">{format(parseISO(trip.departure_at), 'HH:mm')}</div>
              {trip.arrival_at && (
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />{format(parseISO(trip.arrival_at), 'HH:mm')}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <Badge variant={isPrivate ? 'secondary' : 'default'} className="text-[10px]">
                  {isPrivate ? 'Enskild' : 'Reguljär'}
                </Badge>
                {isCanceled && <Badge variant="destructive" className="text-[10px]">Inställd</Badge>}
                {allCheckedIn && !isCanceled && <Badge className="text-[10px] bg-emerald-600">Alla incheckade</Badge>}
                {!trip.vessel_id && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-400"><AlertCircle className="h-2.5 w-2.5 mr-0.5" />Ej tilldelad båt</Badge>}
              </div>
              <div className="font-semibold truncate">{trip.title || trip.booking_routes?.name || 'Tur'}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {trip.vessels?.name && <span className="flex items-center gap-1"><Ship className="h-3 w-3" />{trip.vessels.name}</span>}
                {(trip.booking_routes?.name || (trip.pickup_location && trip.dropoff_location)) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {trip.booking_routes?.name || `${trip.pickup_location} → ${trip.dropoff_location}`}
                  </span>
                )}
              </div>
              {bookings.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-1" />{pax} / {trip.max_passengers} pers · {bookings.length} bokningar</span>
                    <span className={cn('font-medium', allCheckedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>{checked} / {pax} incheckade</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full transition-all', allCheckedIn ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pax > 0 ? (checked / pax) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bookings.map((b: any) => {
                      const ok = !!b.checked_in_at;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggle.mutate(b)}
                          disabled={toggle.isPending}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition active:scale-95',
                            ok
                              ? 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600'
                              : 'bg-background border-input hover:bg-muted'
                          )}
                          title={ok ? 'Tryck för att ångra incheckning' : 'Tryck för att checka in'}
                        >
                          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          <span className="font-medium">{b.customer_name}</span>
                          <span className={cn('tabular-nums', ok ? 'text-white/80' : 'text-muted-foreground')}>×{b.total_passengers}</span>
                        </button>
                      );
                    })}
                  </div>
                  {!allCheckedIn && bookings.length > 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => checkInAll.mutate()} disabled={checkInAll.isPending}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" />Checka in alla
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Link to={`/portal/bookings/trip/${trip.id}`} className="shrink-0 text-muted-foreground hover:text-primary p-1" title="Öppna tur">
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
  );
}