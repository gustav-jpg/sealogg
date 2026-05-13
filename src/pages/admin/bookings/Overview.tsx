import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Calendar as CalendarIcon, Ticket, ChevronLeft, ChevronRight, Repeat, Zap, User, Users, Ship, TrendingUp, Wallet, LayoutGrid } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, parseISO, addDays, addWeeks, subWeeks, isToday as isTodayFn } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CreateTripDialog } from '@/components/bookings/CreateTripDialog';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function BookingsOverview() {
  const { selectedOrgId } = useOrganization();
  const [tab, setTab] = useState('calendar');

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon className="h-6 w-6" />Översikt</h1>
          <p className="text-muted-foreground">Alla turer – enskilda och delade</p>
        </div>

        <KpiStrip orgId={selectedOrgId} />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" />Kalender</TabsTrigger>
            <TabsTrigger value="resource"><LayoutGrid className="h-4 w-4 mr-2" />Resursplan</TabsTrigger>
            <TabsTrigger value="taxi"><Zap className="h-4 w-4 mr-2" />Förfrågningar</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4"><CalendarTab orgId={selectedOrgId} /></TabsContent>
          <TabsContent value="resource" className="mt-4"><ResourceTab orgId={selectedOrgId} /></TabsContent>
          <TabsContent value="taxi" className="mt-4"><TaxiTab orgId={selectedOrgId} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ============================================================
// KPI STRIP – snabb sammanfattning kommande 30 dagar
// ============================================================
function KpiStrip({ orgId }: { orgId: string | null }) {
  const from = useMemo(() => new Date(), []);
  const to = useMemo(() => addDays(new Date(), 30), []);

  const { data } = useQuery({
    queryKey: ['booking-kpis', orgId, format(from, 'yyyy-MM-dd')],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: deps } = await supabase.from('booking_departures')
        .select('id, departure_at, max_passengers, trip_type, status, bookings(total_passengers, total_price_sek, status)')
        .eq('organization_id', orgId!)
        .gte('departure_at', from.toISOString())
        .lte('departure_at', to.toISOString());
      return deps || [];
    },
  });

  const stats = useMemo(() => {
    const deps = data || [];
    let booked = 0, capacity = 0, revenue = 0, bookings = 0, today = 0;
    deps.forEach((d: any) => {
      const active = (d.bookings || []).filter((b: any) => b.status !== 'avbokad');
      const pax = active.reduce((s: number, b: any) => s + (b.total_passengers || 0), 0);
      const rev = active.reduce((s: number, b: any) => s + Number(b.total_price_sek || 0), 0);
      booked += pax;
      revenue += rev;
      bookings += active.length;
      if (d.trip_type === 'shared') capacity += d.max_passengers || 0;
      if (isTodayFn(parseISO(d.departure_at))) today += 1;
    });
    const occ = capacity > 0 ? Math.round((booked / capacity) * 100) : 0;
    return { departures: deps.length, today, bookings, booked, occ, revenue };
  }, [data]);

  const items = [
    { label: 'Turer idag', value: stats.today, icon: CalendarIcon, tone: 'text-primary' },
    { label: 'Avgångar (30d)', value: stats.departures, icon: Ship, tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Bokningar', value: stats.bookings, icon: Ticket, tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Bokade platser', value: stats.booked, icon: Users, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Beläggning', value: `${stats.occ}%`, icon: TrendingUp, tone: stats.occ >= 70 ? 'text-emerald-600 dark:text-emerald-400' : stats.occ >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground' },
    { label: 'Intäkt (kr)', value: stats.revenue.toLocaleString('sv-SE'), icon: Wallet, tone: 'text-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <it.icon className={`h-4 w-4 ${it.tone}`} />
            </div>
            <div className={`text-xl font-bold tabular-nums mt-0.5 ${it.tone}`}>{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// RESURSPLAN – fartyg × dag (vecka)
// ============================================================
function ResourceTab({ orgId }: { orgId: string | null }) {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) }), [weekStart]);

  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId!).order('name')).data || [],
  });

  const { data: departures } = useQuery({
    queryKey: ['booking-departures-week', orgId, format(weekStart, 'yyyy-MM-dd')],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from('booking_departures')
        .select('id, departure_at, arrival_at, vessel_id, max_passengers, trip_type, title, status, booking_routes(name), bookings(total_passengers, status)')
        .eq('organization_id', orgId!)
        .gte('departure_at', weekStart.toISOString())
        .lte('departure_at', addDays(weekStart, 7).toISOString())
        .order('departure_at');
      return data || [];
    },
  });

  const byVesselDay = useMemo(() => {
    const map = new Map<string, any[]>();
    (departures || []).forEach((d: any) => {
      const key = `${d.vessel_id}|${format(parseISO(d.departure_at), 'yyyy-MM-dd')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [departures]);

  const vesselDayStats = (vesselId: string, day: Date) => {
    const list = byVesselDay.get(`${vesselId}|${format(day, 'yyyy-MM-dd')}`) || [];
    let booked = 0, capacity = 0;
    list.forEach((d: any) => {
      const pax = (d.bookings || []).filter((b: any) => b.status !== 'avbokad').reduce((s: number, b: any) => s + (b.total_passengers || 0), 0);
      booked += pax;
      if (d.trip_type === 'shared') capacity += d.max_passengers || 0;
    });
    return { list, booked, capacity };
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-sm font-semibold w-56 text-center">
            v.{format(weekStart, 'I')} · {format(weekStart, 'd MMM', { locale: sv })} – {format(addDays(weekStart, 6), 'd MMM yyyy', { locale: sv })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Idag</Button>
        </div>
        <div className="text-xs text-muted-foreground hidden md:block">Klicka på en avgång för att öppna</div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Header row */}
            <div className="grid border-b" style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))' }}>
              <div className="p-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 bg-muted/30">
                <Ship className="h-3.5 w-3.5" />Fartyg
              </div>
              {days.map((d) => (
                <div key={d.toISOString()} className={`p-2 text-center border-l ${isTodayFn(d) ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <div className="text-[10px] uppercase text-muted-foreground">{format(d, 'EEE', { locale: sv })}</div>
                  <div className={`text-sm font-semibold ${isTodayFn(d) ? 'text-primary' : ''}`}>{format(d, 'd MMM', { locale: sv })}</div>
                </div>
              ))}
            </div>

            {/* Vessel rows */}
            {(vessels || []).length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Inga fartyg</div>
            )}
            {(vessels || []).map((v: any) => (
              <div key={v.id} className="grid border-b" style={{ gridTemplateColumns: '180px repeat(7, minmax(0, 1fr))' }}>
                <div className="p-2 text-sm font-medium flex items-center gap-2 bg-muted/20">
                  <Ship className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{v.name}</span>
                </div>
                {days.map((day) => {
                  const { list, booked, capacity } = vesselDayStats(v.id, day);
                  const ratio = capacity > 0 ? booked / capacity : 0;
                  return (
                    <div key={day.toISOString()} className={`border-l p-1 min-h-[110px] ${isTodayFn(day) ? 'bg-primary/[0.03]' : ''}`}>
                      {list.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground/40">–</div>
                      ) : (
                        <div className="space-y-1">
                          {list.map((d: any) => {
                            const isPrivate = d.trip_type === 'private';
                            const pax = (d.bookings || []).filter((b: any) => b.status !== 'avbokad').reduce((s: number, b: any) => s + (b.total_passengers || 0), 0);
                            const cap = d.max_passengers || 0;
                            const r = cap > 0 ? Math.min(100, (pax / cap) * 100) : 0;
                            const isFull = !isPrivate && pax >= cap;
                            return (
                              <button
                                key={d.id}
                                onClick={() => isPrivate ? null : navigate(`/portal/bookings/trip/${d.id}`)}
                                className={`w-full text-left rounded border px-1.5 py-1 transition hover:shadow-sm ${
                                  isPrivate
                                    ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                                    : isFull
                                      ? 'bg-destructive/10 border-destructive/30 hover:bg-destructive/20'
                                      : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                                }`}
                              >
                                <div className="flex items-center gap-1 text-[10px] font-semibold">
                                  {isPrivate ? <User className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                                  <span className="tabular-nums">{format(parseISO(d.departure_at), 'HH:mm')}</span>
                                  {!isPrivate && <span className="ml-auto tabular-nums">{pax}/{cap}</span>}
                                </div>
                                <div className="text-[10px] truncate text-muted-foreground">
                                  {isPrivate ? 'Enskild' : (d.title || d.booking_routes?.name || 'Delad')}
                                </div>
                                {!isPrivate && cap > 0 && (
                                  <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full ${isFull ? 'bg-destructive' : r >= 80 ? 'bg-orange-500' : 'bg-primary'}`} style={{ width: `${r}%` }} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          {capacity > 0 && (
                            <div className="text-[9px] text-muted-foreground text-right pt-0.5">
                              {booked}/{capacity} ({Math.round(ratio * 100)}%)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />Delad</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />Enskild</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />Fullbokad</div>
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR – månadskalender
// ============================================================
function CalendarTab({ orgId }: { orgId: string | null }) {
  const [month, setMonth] = useState(new Date());
  const [createOpen, setCreateOpen] = useState(false);
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const navigate = useNavigate();

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const { data: departures } = useQuery({
    queryKey: ['booking-departures-month', orgId, format(month, 'yyyy-MM')],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase.from('booking_departures')
        .select('*, booking_routes(name), vessels(name), bookings(total_passengers, status)')
        .eq('organization_id', orgId!)
        .gte('departure_at', calStart.toISOString())
        .lte('departure_at', calEnd.toISOString())
        .order('departure_at');
      return data || [];
    },
  });

  const departuresByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    (departures || []).forEach(d => {
      const key = format(parseISO(d.departure_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return map;
  }, [departures]);

  const openCreate = (date?: Date) => {
    setDefaultDate(date || null);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-lg font-semibold capitalize w-40 text-center">{format(month, 'MMMM yyyy', { locale: sv })}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Idag</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSeriesOpen(true)}><Repeat className="h-4 w-4 mr-2" />Skapa serie</Button>
          <Button onClick={() => openCreate()}><Plus className="h-4 w-4 mr-2" />Skapa</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
            {WEEKDAYS.map(d => <div key={d} className="text-center py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayDeps = departuresByDay.get(key) || [];
              const isCurMonth = isSameMonth(day, month);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={key}
                  onClick={() => openCreate(day)}
                  className={`min-h-[90px] p-1 border rounded text-left hover:bg-muted/50 transition ${
                    !isCurMonth ? 'opacity-40' : ''
                  } ${isToday ? 'border-primary border-2' : 'border-border'}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayDeps.slice(0, 3).map((d: any) => {
                      const isPrivate = d.trip_type === 'private';
                      const booked = (d.bookings || []).filter((b: any) => b.status !== 'avbokad').reduce((s: number, b: any) => s + (b.total_passengers || 0), 0);
                      const cap = d.max_passengers || 0;
                      const ratio = cap > 0 ? booked / cap : 0;
                      const isFull = !isPrivate && booked >= cap;
                      const nearlyFull = !isPrivate && !isFull && ratio >= 0.8;
                      return (
                        <div
                          key={d.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPrivate) setEditing(d);
                            else navigate(`/portal/bookings/trip/${d.id}`);
                          }}
                          className={`text-[10px] px-1 py-0.5 rounded cursor-pointer flex items-center gap-1 ${
                            isPrivate
                              ? 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300'
                              : isFull
                                ? 'bg-destructive/15 text-destructive hover:bg-destructive/25'
                                : nearlyFull
                                  ? 'bg-orange-500/15 text-orange-800 hover:bg-orange-500/25 dark:text-orange-300'
                                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                          title={`${format(parseISO(d.departure_at), 'HH:mm')} ${isPrivate ? '(Enskild)' : (d.title || d.booking_routes?.name)}`}
                        >
                          {isPrivate ? <User className="h-2.5 w-2.5 shrink-0" /> : <Users className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate flex-1 min-w-0">
                            {format(parseISO(d.departure_at), 'HH:mm')} {isPrivate ? 'Enskild' : (d.title || d.booking_routes?.name)}
                          </span>
                          {!isPrivate && (
                            <span className="shrink-0 font-semibold tabular-nums">
                              {booked}/{cap}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {dayDeps.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayDeps.length - 3} till</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary/20" /><Users className="h-3 w-3" />Delad körning</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500/20" /><User className="h-3 w-3" />Enskild körning</div>
      </div>

      <CreateTripDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={orgId}
        defaultDate={defaultDate}
      />

      <SeriesDialog open={seriesOpen} onOpenChange={setSeriesOpen} orgId={orgId} />

      <EditDepartureDialog
        departure={editing}
        onClose={() => setEditing(null)}
        orgId={orgId}
      />
    </div>
  );
}

// ============================================================
// EDIT DEPARTURE (enkel redigering av befintlig avgång)
// ============================================================
function EditDepartureDialog({ departure, onClose, orgId }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [maxPax, setMaxPax] = useState('');
  const [status, setStatus] = useState('planerad');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [showTickets, setShowTickets] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Private booking edit fields
  const [pCustomerName, setPCustomerName] = useState('');
  const [pCustomerEmail, setPCustomerEmail] = useState('');
  const [pCustomerPhone, setPCustomerPhone] = useState('');
  const [pPax, setPPax] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCustomerNotes, setPCustomerNotes] = useState('');
  const [pBookingStatus, setPBookingStatus] = useState('bekraftad');

  // Load full booking row for private trips
  const { data: privateBooking } = useQuery({
    queryKey: ['private-booking-for-departure', departure?.id],
    enabled: !!departure?.id && departure?.trip_type === 'private',
    queryFn: async () => {
      const { data } = await supabase
        .from('bookings')
        .select('*')
        .eq('departure_id', departure.id)
        .maybeSingle();
      return data;
    },
  });

  useMemo(() => {
    if (departure) {
      setMaxPax(departure.max_passengers?.toString() || '12');
      setStatus(departure.status || 'planerad');
      setNotes(departure.notes || '');
      setTitle(departure.title || '');
      setShowTickets(false);
      setEditMode(false);
    }
  }, [departure?.id]);

  useMemo(() => {
    if (privateBooking) {
      setPCustomerName(privateBooking.customer_name || '');
      setPCustomerEmail(privateBooking.customer_email || '');
      setPCustomerPhone(privateBooking.customer_phone || '');
      setPPax(privateBooking.total_passengers?.toString() || '1');
      setPPrice(privateBooking.total_price_sek?.toString() || '');
      setPCustomerNotes(privateBooking.customer_notes || '');
      setPBookingStatus(privateBooking.status || 'bekraftad');
    }
  }, [privateBooking?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { max_passengers: Number(maxPax), status, notes: notes || null };
      if (departure.trip_type === 'shared') payload.title = title || null;
      const { error } = await supabase.from('booking_departures').update(payload).eq('id', departure.id);
      if (error) throw error;

      // Also update linked booking for private trips
      if (departure.trip_type === 'private' && privateBooking?.id) {
        const { error: bErr } = await supabase.from('bookings').update({
          customer_name: pCustomerName,
          customer_email: pCustomerEmail,
          customer_phone: pCustomerPhone || null,
          total_passengers: Number(pPax),
          total_price_sek: pPrice ? Number(pPrice) : 0,
          customer_notes: pCustomerNotes || null,
          status: pBookingStatus as any,
        }).eq('id', privateBooking.id);
        if (bErr) throw bErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      queryClient.invalidateQueries({ queryKey: ['private-booking-for-departure'] });
      onClose();
      toast({ title: 'Sparat' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('booking_departures').delete().eq('id', departure.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      onClose();
      toast({ title: 'Raderad' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  if (!departure) return null;
  const isPrivate = departure.trip_type === 'private';
  const fmtDt = (s?: string | null) => s ? format(parseISO(s), 'yyyy-MM-dd HH:mm') : '–';

  return (
    <Dialog open={!!departure} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPrivate ? <User className="h-5 w-5 text-amber-600" /> : <Users className="h-5 w-5 text-primary" />}
            {isPrivate ? 'Enskild körning' : (departure.title || 'Delad körning')}
          </DialogTitle>
        </DialogHeader>

        {showTickets ? (
          <TicketTypesPanel departure={departure} orgId={orgId} onBack={() => setShowTickets(false)} />
        ) : isPrivate ? (
          <div className="space-y-4">
            {/* TRIP INFO CARD */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tur</div>
              <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Avgång</div><div className="font-medium">{fmtDt(departure.departure_at)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ankomst</div><div className="font-medium">{fmtDt(departure.arrival_at)}</div></div>
                <div><div className="text-xs text-muted-foreground">Fartyg</div><div className="font-medium">{departure.vessels?.name || '–'}</div></div>
                <div><div className="text-xs text-muted-foreground">Rutt</div><div className="font-medium">{departure.booking_routes?.name || '–'}</div></div>
                {(departure.pickup_location || departure.dropoff_location) && (
                  <div className="col-span-2"><div className="text-xs text-muted-foreground">Från → Till</div><div className="font-medium">{departure.pickup_location || '?'} → {departure.dropoff_location || '?'}</div></div>
                )}
                <div><div className="text-xs text-muted-foreground">Antal passagerare</div><div className="font-medium">{privateBooking?.total_passengers ?? '–'}</div></div>
                <div>
                  <div className="text-xs text-muted-foreground">Status (tur)</div>
                  <Badge variant={status === 'genomford' ? 'default' : status === 'installd' ? 'destructive' : 'secondary'} className="mt-0.5">{status}</Badge>
                </div>
              </div>
            </div>

            {/* CUSTOMER CARD */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kund</div>
              {!privateBooking ? (
                <div className="p-3 text-sm text-muted-foreground italic">Ingen kopplad bokning hittades</div>
              ) : (
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><div className="text-xs text-muted-foreground">Namn</div><div className="font-medium">{privateBooking.customer_name || '–'}</div></div>
                  <div>
                    <div className="text-xs text-muted-foreground">Bokningsstatus</div>
                    <Badge variant={privateBooking.status === 'bekraftad' ? 'default' : privateBooking.status === 'avbokad' ? 'destructive' : 'secondary'} className="mt-0.5">{privateBooking.status}</Badge>
                  </div>
                  <div><div className="text-xs text-muted-foreground">E-post</div><div className="font-medium break-all">{privateBooking.customer_email || '–'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Telefon</div><div className="font-medium">{privateBooking.customer_phone || '–'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Pris</div><div className="font-medium">{privateBooking.total_price_sek ? `${Number(privateBooking.total_price_sek).toFixed(0)} kr` : '–'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Bokningsref.</div><div className="font-mono text-xs">{(privateBooking.id || '').slice(0, 8)}</div></div>
                  {privateBooking.customer_notes && (
                    <div className="col-span-2"><div className="text-xs text-muted-foreground">Kommentar från kund</div><div className="italic">{privateBooking.customer_notes}</div></div>
                  )}
                </div>
              )}
            </div>

            {/* INTERNAL NOTE */}
            {departure.notes && !editMode && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Intern anteckning</div>
                <div className="p-3 text-sm whitespace-pre-wrap">{departure.notes}</div>
              </div>
            )}

            {/* EDIT FORM */}
            {editMode && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="text-sm font-semibold">Redigera</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div><Label>Kundnamn</Label><Input value={pCustomerName} onChange={(e) => setPCustomerName(e.target.value)} /></div>
                  <div><Label>Antal passagerare</Label><Input type="number" min="1" value={pPax} onChange={(e) => setPPax(e.target.value)} /></div>
                  <div><Label>E-post</Label><Input type="email" value={pCustomerEmail} onChange={(e) => setPCustomerEmail(e.target.value)} /></div>
                  <div><Label>Telefon</Label><Input value={pCustomerPhone} onChange={(e) => setPCustomerPhone(e.target.value)} /></div>
                  <div><Label>Pris (kr)</Label><Input type="number" value={pPrice} onChange={(e) => setPPrice(e.target.value)} /></div>
                  <div><Label>Max passagerare (tur)</Label><Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
                  <div>
                    <Label>Status (tur)</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planerad">Planerad</SelectItem>
                        <SelectItem value="fullbokad">Fullbokad</SelectItem>
                        <SelectItem value="installd">Inställd</SelectItem>
                        <SelectItem value="genomford">Genomförd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bokningsstatus</Label>
                    <Select value={pBookingStatus} onValueChange={setPBookingStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bekraftad">Bekräftad</SelectItem>
                        <SelectItem value="avvaktar">Avvaktar</SelectItem>
                        <SelectItem value="avbokad">Avbokad</SelectItem>
                        <SelectItem value="no_show">No-show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Kommentar från kund</Label><Textarea value={pCustomerNotes} onChange={(e) => setPCustomerNotes(e.target.value)} rows={2} /></div>
                <div><Label>Intern anteckning</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {editMode ? (
                <>
                  <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">Spara ändringar</Button>
                  <Button variant="outline" onClick={() => setEditMode(false)}>Avbryt</Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setEditMode(true)} className="flex-1">Redigera</Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera tur (och dess bokning)?')) remove.mutate(); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <div><b>Avgång:</b> {format(parseISO(departure.departure_at), 'yyyy-MM-dd HH:mm')}</div>
              {departure.arrival_at && <div><b>Ankomst:</b> {format(parseISO(departure.arrival_at), 'yyyy-MM-dd HH:mm')}</div>}
              <div><b>Fartyg:</b> {departure.vessels?.name}</div>
              {departure.booking_routes?.name && <div><b>Rutt:</b> {departure.booking_routes.name}</div>}
              {departure.pickup_location && <div><b>Från/till:</b> {departure.pickup_location} → {departure.dropoff_location}</div>}
            </div>

            {!isPrivate && (
              <div><Label>Namn på tur</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Max passagerare</Label><Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
              <div><Label>Status</Label>
                <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planerad">Planerad</SelectItem>
                    <SelectItem value="fullbokad">Fullbokad</SelectItem>
                    <SelectItem value="installd">Inställd</SelectItem>
                    <SelectItem value="genomford">Genomförd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Intern anteckning</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

            {!isPrivate && departure.bookings?.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <div className="text-sm font-medium mb-1">Bokningar</div>
                <div className="text-xs text-muted-foreground">
                  {departure.bookings.filter((b: any) => b.status !== 'avbokad').reduce((s: number, b: any) => s + (b.total_passengers || 0), 0)} av {departure.max_passengers} platser bokade
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">Spara</Button>
              {!isPrivate && <Button variant="outline" onClick={() => setShowTickets(true)}><Ticket className="h-4 w-4 mr-2" />Biljetter</Button>}
              <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera tur?')) remove.mutate(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TicketTypesPanel({ departure, orgId, onBack }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [maxCount, setMaxCount] = useState('');

  const { data: types } = useQuery({
    queryKey: ['ticket-types', departure.id],
    queryFn: async () => (await supabase.from('booking_ticket_types').select('*').eq('departure_id', departure.id).order('sort_order')).data || [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name || !price) throw new Error('Namn och pris krävs');
      const { error } = await supabase.from('booking_ticket_types').insert({
        organization_id: orgId, departure_id: departure.id, name,
        price_sek: Number(price), max_count: maxCount ? Number(maxCount) : null,
        sort_order: (types?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ticket-types'] }); setName(''); setPrice(''); setMaxCount(''); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_ticket_types').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Tillbaka</Button>
      <div className="text-sm font-medium">Biljett-typer för denna tur</div>
      <div className="space-y-2">
        {types?.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between border rounded p-2">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-muted-foreground">{Number(t.price_sek).toFixed(0)} kr {t.max_count ? `• max ${t.max_count}` : ''}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {types?.length === 0 && <div className="text-sm text-muted-foreground">Inga biljett-typer än</div>}
      </div>
      <div className="border-t pt-3 space-y-2">
        <Label>Lägg till biljett-typ</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Vuxen" value={name} onChange={(e) => setName(e.target.value)} />
          <Input type="number" placeholder="Pris" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input type="number" placeholder="Max" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full" size="sm"><Plus className="h-4 w-4 mr-2" />Lägg till</Button>
      </div>
    </div>
  );
}

// ============================================================
// SERIES DIALOG (skapa återkommande regulärturer)
// ============================================================
function SeriesDialog({ open, onOpenChange, orgId }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [maxPax, setMaxPax] = useState('12');
  const [isActive, setIsActive] = useState(true);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', orgId], enabled: !!orgId && open,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', orgId!).eq('is_active', true)).data || [],
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId && open,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId!)).data || [],
  });

  const reset = () => {
    setName(''); setRouteId(''); setVesselId(''); setWeekdays([]); setTimes(['08:00']);
    setValidFrom(new Date().toISOString().slice(0, 10)); setValidUntil(''); setMaxPax('12'); setIsActive(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Ingen org');
      if (!name || !routeId || !vesselId || weekdays.length === 0 || times.length === 0) throw new Error('Fyll i alla fält');
      const { error } = await supabase.from('booking_schedules').insert({
        organization_id: orgId, name, route_id: routeId, vessel_id: vesselId,
        weekdays, departure_times: times,
        valid_from: validFrom, valid_until: validUntil || null,
        max_passengers: Number(maxPax), is_active: isActive,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-schedules'] });
      onOpenChange(false);
      reset();
      toast({ title: 'Serie skapad', description: 'Genererar delade körningar enligt schemat' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5" />Skapa serie (regulärturer)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Återkommande delade körningar enligt veckoschema</p>
          <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Sommarsäsong 2026" /></div>
          <div><Label>Rutt *</Label>
            <Select value={routeId} onValueChange={setRouteId}><SelectTrigger><SelectValue placeholder="Välj rutt" /></SelectTrigger>
              <SelectContent>{routes?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Fartyg *</Label>
            <Select value={vesselId} onValueChange={setVesselId}><SelectTrigger><SelectValue placeholder="Välj fartyg" /></SelectTrigger>
              <SelectContent>{vessels?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Veckodagar *</Label>
            <div className="flex flex-wrap gap-1 mt-1">{WEEKDAYS.map((d, i) => {
              const dayNum = i + 1;
              const active = weekdays.includes(dayNum);
              return <Button key={i} type="button" variant={active ? 'default' : 'outline'} size="sm" onClick={() => setWeekdays(active ? weekdays.filter(x => x !== dayNum) : [...weekdays, dayNum])}>{d}</Button>;
            })}</div>
          </div>
          <div><Label>Avgångstider *</Label>
            <div className="space-y-1">
              {times.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input type="time" value={t} onChange={(e) => { const c = [...times]; c[i] = e.target.value; setTimes(c); }} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, j) => j !== i))} disabled={times.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setTimes([...times, '12:00'])}><Plus className="h-4 w-4 mr-1" />Lägg till tid</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Giltig från *</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
            <div><Label>Giltig till</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max passagerare</Label><Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
            <div className="flex items-end gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Aktiv</Label></div>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Spara serie</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TAXI / FÖRFRÅGNINGAR
// ============================================================
function TaxiTab({ orgId }: { orgId: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);

  const { data: requests } = useQuery({
    queryKey: ['taxi-requests', orgId, statusFilter], enabled: !!orgId,
    queryFn: async () => {
      let q = supabase.from('booking_taxi_requests').select('*, vessels(name)').eq('organization_id', orgId!).order('requested_at', { ascending: true });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId!)).data || [],
  });

  const update = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('booking_taxi_requests').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxi-requests'] }); toast({ title: 'Uppdaterad' }); setSelected(null); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const colors: Record<string, string> = {
    ny: 'bg-blue-500/10 text-blue-700 border-blue-300',
    bekraftad: 'bg-green-500/10 text-green-700 border-green-300',
    avbojd: 'bg-red-500/10 text-red-700 border-red-300',
    genomford: 'bg-gray-500/10 text-gray-700 border-gray-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Förfrågningar från publika sidan utan fast tid</p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla</SelectItem>
            <SelectItem value="ny">Nya</SelectItem>
            <SelectItem value="bekraftad">Bekräftade</SelectItem>
            <SelectItem value="avbojd">Avböjda</SelectItem>
            <SelectItem value="genomford">Genomförda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3">
        {requests?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga förfrågningar</CardContent></Card>}
        {requests?.map((r: any) => (
          <Card key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.request_number}</span>
                    <Badge variant="outline" className={colors[r.status]}>{r.status}</Badge>
                  </div>
                  <div className="font-medium mt-1">{r.customer_name} • {r.passenger_count} pers</div>
                  <div className="text-sm">{r.pickup_location} → {r.dropoff_location}</div>
                  <div className="text-xs text-muted-foreground">Önskad: {format(new Date(r.requested_at), 'yyyy-MM-dd HH:mm')}</div>
                  {r.vessels?.name && <div className="text-xs text-muted-foreground">Fartyg: {r.vessels.name}</div>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Förfrågan {selected?.request_number}</DialogTitle></DialogHeader>
          {selected && <TaxiDetail r={selected} vessels={vessels || []} onSave={update.mutate} pending={update.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaxiDetail({ r, vessels, onSave, pending }: any) {
  const [status, setStatus] = useState(r.status);
  const [vesselId, setVesselId] = useState(r.assigned_vessel_id || '');
  const [price, setPrice] = useState(r.quoted_price_sek?.toString() || '');
  const [internalNotes, setInternalNotes] = useState(r.internal_notes || '');

  return (
    <div className="space-y-3">
      <div className="text-sm space-y-1">
        <div><b>Kund:</b> {r.customer_name}</div>
        <div><b>E-post:</b> {r.customer_email}</div>
        <div><b>Telefon:</b> {r.customer_phone}</div>
        <div><b>Personer:</b> {r.passenger_count}</div>
        <div><b>Från:</b> {r.pickup_location}</div>
        <div><b>Till:</b> {r.dropoff_location}</div>
        {r.notes && <div><b>Kundens noteringar:</b> {r.notes}</div>}
      </div>
      <div><Label>Status</Label>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ny">Ny</SelectItem>
            <SelectItem value="bekraftad">Bekräftad</SelectItem>
            <SelectItem value="avbojd">Avböjd</SelectItem>
            <SelectItem value="genomford">Genomförd</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Tilldela fartyg</Label>
        <Select value={vesselId || 'none'} onValueChange={(v) => setVesselId(v === 'none' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">– Inget –</SelectItem>
            {vessels.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Offererat pris (kr)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <div><Label>Interna noteringar</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
      <Button disabled={pending} onClick={() => onSave({ id: r.id, status, assigned_vessel_id: vesselId || null, quoted_price_sek: price ? Number(price) : null, internal_notes: internalNotes || null })} className="w-full">Spara</Button>
    </div>
  );
}
