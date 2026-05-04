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
import { Plus, Trash2, Calendar as CalendarIcon, Ticket, ChevronLeft, ChevronRight, Repeat, Zap, User, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, parseISO } from 'date-fns';
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" />Kalender</TabsTrigger>
            <TabsTrigger value="taxi"><Zap className="h-4 w-4 mr-2" />Förfrågningar</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4"><CalendarTab orgId={selectedOrgId} /></TabsContent>
          <TabsContent value="taxi" className="mt-4"><TaxiTab orgId={selectedOrgId} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
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
                      return (
                        <div
                          key={d.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPrivate) setEditing(d);
                            else navigate(`/portal/bookings/trip/${d.id}`);
                          }}
                          className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer flex items-center gap-1 ${
                            isPrivate
                              ? 'bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300'
                              : 'bg-primary/10 text-primary hover:bg-primary/20'
                          }`}
                          title={`${format(parseISO(d.departure_at), 'HH:mm')} ${isPrivate ? '(Enskild)' : (d.title || d.booking_routes?.name)}`}
                        >
                          {isPrivate ? <User className="h-2.5 w-2.5 shrink-0" /> : <Users className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">
                            {format(parseISO(d.departure_at), 'HH:mm')} {isPrivate ? 'Enskild' : (d.title || d.booking_routes?.name)}
                            {!isPrivate && ` (${booked}/${d.max_passengers})`}
                          </span>
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

  useMemo(() => {
    if (departure) {
      setMaxPax(departure.max_passengers?.toString() || '12');
      setStatus(departure.status || 'planerad');
      setNotes(departure.notes || '');
      setTitle(departure.title || '');
      setShowTickets(false);
    }
  }, [departure?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { max_passengers: Number(maxPax), status, notes: notes || null };
      if (departure.trip_type === 'shared') payload.title = title || null;
      const { error } = await supabase.from('booking_departures').update(payload).eq('id', departure.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
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

  return (
    <Dialog open={!!departure} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPrivate ? <User className="h-5 w-5 text-amber-600" /> : <Users className="h-5 w-5 text-primary" />}
            {isPrivate ? 'Enskild körning' : (departure.title || 'Delad körning')}
          </DialogTitle>
        </DialogHeader>

        {showTickets ? (
          <TicketTypesPanel departure={departure} orgId={orgId} onBack={() => setShowTickets(false)} />
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
