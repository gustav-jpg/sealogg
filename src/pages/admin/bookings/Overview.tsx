import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Trash2, Calendar as CalendarIcon, Edit, Ticket, ChevronLeft, ChevronRight, Repeat, Zap } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function BookingsOverview() {
  const { selectedOrgId } = useOrganization();
  const [tab, setTab] = useState('calendar');

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarIcon className="h-6 w-6" />Översikt</h1>
          <p className="text-muted-foreground">Alla turer – regulära och bokade</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" />Kalender</TabsTrigger>
            <TabsTrigger value="schedules"><Repeat className="h-4 w-4 mr-2" />Regulärturer</TabsTrigger>
            <TabsTrigger value="taxi"><Zap className="h-4 w-4 mr-2" />Bokade turer</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar" className="mt-4"><CalendarTab orgId={selectedOrgId} /></TabsContent>
          <TabsContent value="schedules" className="mt-4"><SchedulesTab orgId={selectedOrgId} /></TabsContent>
          <TabsContent value="taxi" className="mt-4"><TaxiTab orgId={selectedOrgId} /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

// ============================================================
// CALENDAR – månadskalender med alla avgångar
// ============================================================
function CalendarTab({ orgId }: { orgId: string | null }) {
  const [month, setMonth] = useState(new Date());
  const [departureOpen, setDepartureOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

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
        .select('*, booking_routes(name), vessels(name)')
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

  const openNew = (date?: Date) => {
    setEditing(null);
    setDefaultDate(date || null);
    setDepartureOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="text-lg font-semibold capitalize w-40 text-center">{format(month, 'MMMM yyyy', { locale: sv })}</div>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Idag</Button>
        </div>
        <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-2" />Ny tur</Button>
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
                  onClick={() => openNew(day)}
                  className={`min-h-[90px] p-1 border rounded text-left hover:bg-muted/50 transition ${
                    !isCurMonth ? 'opacity-40' : ''
                  } ${isToday ? 'border-primary border-2' : 'border-border'}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                  <div className="space-y-0.5">
                    {dayDeps.slice(0, 3).map((d: any) => (
                      <div
                        key={d.id}
                        onClick={(e) => { e.stopPropagation(); setEditing(d); setDepartureOpen(true); }}
                        className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20"
                        title={`${format(parseISO(d.departure_at), 'HH:mm')} ${d.booking_routes?.name}`}
                      >
                        {format(parseISO(d.departure_at), 'HH:mm')} {d.booking_routes?.name}
                      </div>
                    ))}
                    {dayDeps.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayDeps.length - 3} till</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <DepartureDialog
        open={departureOpen}
        onOpenChange={setDepartureOpen}
        editing={editing}
        defaultDate={defaultDate}
        orgId={orgId}
      />
    </div>
  );
}

// ============================================================
// DEPARTURE DIALOG (skapa/redigera enskild avgång + biljetter)
// ============================================================
function DepartureDialog({ open, onOpenChange, editing, defaultDate, orgId }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [routeId, setRouteId] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [arrivalAt, setArrivalAt] = useState('');
  const [maxPax, setMaxPax] = useState('12');
  const [status, setStatus] = useState('planerad');
  const [notes, setNotes] = useState('');
  const [showTickets, setShowTickets] = useState(false);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', orgId], enabled: !!orgId && open,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', orgId!).eq('is_active', true)).data || [],
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId && open,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId!)).data || [],
  });

  // Reset on open
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setRouteId(editing.route_id);
      setVesselId(editing.vessel_id);
      setDepartureAt(editing.departure_at?.slice(0, 16) || '');
      setArrivalAt(editing.arrival_at?.slice(0, 16) || '');
      setMaxPax(editing.max_passengers.toString());
      setStatus(editing.status);
      setNotes(editing.notes || '');
    } else {
      setRouteId(''); setVesselId('');
      const def = defaultDate ? format(defaultDate, "yyyy-MM-dd'T'09:00") : '';
      setDepartureAt(def); setArrivalAt('');
      setMaxPax('12'); setStatus('planerad'); setNotes('');
    }
    setShowTickets(false);
  }, [open, editing, defaultDate]);

  const save = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Ingen org');
      if (!routeId || !vesselId || !departureAt) throw new Error('Rutt, fartyg och avgångstid krävs');
      const payload: any = {
        organization_id: orgId, route_id: routeId, vessel_id: vesselId,
        departure_at: new Date(departureAt).toISOString(),
        arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
        max_passengers: Number(maxPax), status: status as any, notes: notes || null,
      };
      if (editing) {
        const { error } = await supabase.from('booking_departures').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('booking_departures').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      onOpenChange(false);
      toast({ title: 'Sparat' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('booking_departures').delete().eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      onOpenChange(false);
      toast({ title: 'Raderad' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? 'Redigera tur' : 'Ny tur'}</DialogTitle></DialogHeader>
        {showTickets && editing ? (
          <TicketTypesPanel departure={editing} orgId={orgId} onBack={() => setShowTickets(false)} />
        ) : (
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Avgång *</Label><Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} /></div>
              <div><Label>Ankomst</Label><Input type="datetime-local" value={arrivalAt} onChange={(e) => setArrivalAt(e.target.value)} /></div>
            </div>
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
            <div><Label>Noteringar</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">Spara</Button>
              {editing && <Button variant="outline" onClick={() => setShowTickets(true)}><Ticket className="h-4 w-4 mr-2" />Biljetter</Button>}
              {editing && <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera?')) remove.mutate(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
// SCHEDULES TAB – regulärturer (tidtabeller)
// ============================================================
function SchedulesTab({ orgId }: { orgId: string | null }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
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
    queryKey: ['booking-routes-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', orgId!).eq('is_active', true)).data || [],
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId!)).data || [],
  });
  const { data: schedules } = useQuery({
    queryKey: ['booking-schedules', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('booking_schedules').select('*, booking_routes(name), vessels(name)').eq('organization_id', orgId!).order('name')).data || [],
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-schedules'] }); setOpen(false); reset(); toast({ title: 'Regulärtur skapad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_schedules').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-schedules'] }); toast({ title: 'Raderad' }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Återkommande turer som körs enligt tidtabell</p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild><Button onClick={reset}><Plus className="h-4 w-4 mr-2" />Ny regulärtur</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Ny regulärtur</DialogTitle></DialogHeader>
            <div className="space-y-3">
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
                <div className="flex gap-1 mt-1">{WEEKDAYS.map((d, i) => {
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
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Spara</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {schedules?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga regulärturer än</CardContent></Card>}
        {schedules?.map((s: any) => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">{s.name} {!s.is_active && <Badge variant="secondary">Inaktiv</Badge>}</div>
                <div className="text-sm text-muted-foreground">{s.booking_routes?.name} • {s.vessels?.name}</div>
                <div className="text-sm text-muted-foreground">Dagar: {s.weekdays?.map((w: number) => WEEKDAYS[w - 1]).join(', ')} • Tider: {s.departure_times?.join(', ')}</div>
                <div className="text-xs text-muted-foreground">Giltig {s.valid_from} {s.valid_until ? `– ${s.valid_until}` : '(inget slutdatum)'}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera regulärtur?')) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TAXI TAB – bokade turer (on-demand-förfrågningar)
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
        <p className="text-sm text-muted-foreground">Engångsturer som kunder bokar för specifik tid och plats</p>
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
        {requests?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga bokade turer</CardContent></Card>}
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
          <DialogHeader><DialogTitle>Bokad tur {selected?.request_number}</DialogTitle></DialogHeader>
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
