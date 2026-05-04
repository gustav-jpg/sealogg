import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CalendarClock, Edit, Ticket } from 'lucide-react';
import { format } from 'date-fns';

export default function DeparturesAdmin() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [routeId, setRouteId] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [departureAt, setDepartureAt] = useState('');
  const [arrivalAt, setArrivalAt] = useState('');
  const [maxPax, setMaxPax] = useState('12');
  const [status, setStatus] = useState('planerad');
  const [notes, setNotes] = useState('');

  const [ticketDialogFor, setTicketDialogFor] = useState<any>(null);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', selectedOrgId!).eq('is_active', true)).data || [],
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', selectedOrgId!)).data || [],
  });
  const { data: departures } = useQuery({
    queryKey: ['booking-departures', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_departures').select('*, booking_routes(name), vessels(name)').eq('organization_id', selectedOrgId!).order('departure_at', { ascending: true })).data || [],
  });

  const reset = () => {
    setEditing(null); setRouteId(''); setVesselId(''); setDepartureAt(''); setArrivalAt(''); setMaxPax('12'); setStatus('planerad'); setNotes('');
  };

  const openEdit = (d: any) => {
    setEditing(d); setRouteId(d.route_id); setVesselId(d.vessel_id);
    setDepartureAt(d.departure_at?.slice(0, 16) || ''); setArrivalAt(d.arrival_at?.slice(0, 16) || '');
    setMaxPax(d.max_passengers.toString()); setStatus(d.status); setNotes(d.notes || '');
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen org');
      if (!routeId || !vesselId || !departureAt) throw new Error('Rutt, fartyg och avgångstid krävs');
      const payload: any = {
        organization_id: selectedOrgId, route_id: routeId, vessel_id: vesselId,
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-departures'] }); setOpen(false); reset(); toast({ title: 'Sparat' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_departures').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-departures'] }); toast({ title: 'Raderad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" />Avgångar</h1>
            <p className="text-muted-foreground">Enstaka eller manuella avgångar (återkommande genereras från Tidtabeller)</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="h-4 w-4 mr-2" />Ny avgång</Button></DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Redigera' : 'Ny'} avgång</DialogTitle></DialogHeader>
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
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Spara</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {departures?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga avgångar än</CardContent></Card>}
          {departures?.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.booking_routes?.name} – {d.vessels?.name}</div>
                  <div className="text-sm text-muted-foreground">{format(new Date(d.departure_at), 'yyyy-MM-dd HH:mm')} • Max {d.max_passengers} pers</div>
                  <Badge variant="outline" className="mt-1">{d.status}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setTicketDialogFor(d)}><Ticket className="h-4 w-4 mr-1" />Biljetter</Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera avgång?')) remove.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <TicketTypesDialog departure={ticketDialogFor} onClose={() => setTicketDialogFor(null)} orgId={selectedOrgId} />
      </div>
    </MainLayout>
  );
}

function TicketTypesDialog({ departure, onClose, orgId }: { departure: any; onClose: () => void; orgId: string | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [maxCount, setMaxCount] = useState('');

  const { data: types } = useQuery({
    queryKey: ['ticket-types', departure?.id], enabled: !!departure?.id,
    queryFn: async () => (await supabase.from('booking_ticket_types').select('*').eq('departure_id', departure.id).order('sort_order')).data || [],
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!orgId || !departure || !name || !price) throw new Error('Namn och pris krävs');
      const { error } = await supabase.from('booking_ticket_types').insert({
        organization_id: orgId, departure_id: departure.id, name,
        price_sek: Number(price), max_count: maxCount ? Number(maxCount) : null,
        sort_order: (types?.length || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ticket-types'] }); setName(''); setPrice(''); setMaxCount(''); toast({ title: 'Tillagd' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_ticket_types').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket-types'] }),
  });

  return (
    <Dialog open={!!departure} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Biljett-typer för avgång</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            {types?.map(t => (
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
              <Input placeholder="Namn (Vuxen)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input type="number" placeholder="Pris kr" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input type="number" placeholder="Max antal" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="w-full"><Plus className="h-4 w-4 mr-2" />Lägg till</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}