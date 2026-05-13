import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { User, Users, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

type Mode = 'choose' | 'private' | 'shared';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string | null;
  defaultDate?: Date | null;
  onCreated?: () => void;
}

export function CreateTripDialog({ open, onOpenChange, orgId, defaultDate, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('choose');

  useEffect(() => {
    if (open) setMode('choose');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {mode === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle>Skapa körning</DialogTitle>
              <DialogDescription>Välj typ av körning du vill skapa</DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setMode('private')}
                className="border rounded-lg p-5 text-left hover:border-primary hover:bg-primary/5 transition group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="font-semibold">Enskild körning</div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Privat tur för en specifik kund. Visas inte publikt.
                </p>
              </button>

              <button
                onClick={() => setMode('shared')}
                className="border rounded-lg p-5 text-left hover:border-primary hover:bg-primary/5 transition group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="font-semibold">Reguljärtur</div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Publik tur som flera kunder kan boka platser på.
                </p>
              </button>
            </div>
          </>
        )}

        {mode === 'private' && (
          <PrivateForm
            orgId={orgId}
            defaultDate={defaultDate}
            onBack={() => setMode('choose')}
            onDone={() => { onOpenChange(false); onCreated?.(); }}
          />
        )}

        {mode === 'shared' && (
          <SharedForm
            orgId={orgId}
            defaultDate={defaultDate}
            onBack={() => setMode('choose')}
            onDone={() => { onOpenChange(false); onCreated?.(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Private trip form (1 trip + 1 booking)
// ============================================================
function PrivateForm({ orgId, defaultDate, onBack, onDone }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pax, setPax] = useState('1');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [departureAt, setDepartureAt] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd'T'09:00") : format(new Date(), "yyyy-MM-dd'T'09:00")
  );
  const [arrivalAt, setArrivalAt] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [price, setPrice] = useState('');

  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId)).data || [],
  });
  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', orgId).eq('is_active', true)).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Ingen organisation vald');
      if (!customerName || !customerEmail) throw new Error('Kundens namn och e-post krävs');
      if (!departureAt) throw new Error('Avgångstid krävs');
      if (!routeId && (!pickup || !dropoff)) throw new Error('Ange rutt eller från/till');

      const { data: dep, error: e1 } = await supabase
        .from('booking_departures')
        .insert({
          organization_id: orgId,
          trip_type: 'private',
          route_id: routeId || null,
          vessel_id: vesselId || null,
          pickup_location: routeId ? null : pickup,
          dropoff_location: routeId ? null : dropoff,
          departure_at: new Date(departureAt).toISOString(),
          arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
          max_passengers: Number(pax),
          status: 'planerad',
          notes: internalNotes || null,
        } as any)
        .select()
        .single();
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('bookings').insert({
        organization_id: orgId,
        departure_id: dep.id,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        total_passengers: Number(pax),
        total_price_sek: price ? Number(price) : 0,
        status: 'bekraftad',
        customer_notes: notes || null,
      } as any);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({ title: 'Enskild körning skapad' });
      onDone();
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <DialogTitle>Ny enskild körning</DialogTitle>
        </div>
        <DialogDescription>Privat tur för en kund (visas inte publikt)</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div className="border rounded-lg p-3 space-y-3">
          <div className="font-medium text-sm">Kund</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Namn *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
            <div><Label>Antal passagerare *</Label><Input type="number" min="1" value={pax} onChange={(e) => setPax(e.target.value)} /></div>
            <div><Label>E-post *</Label><Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
            <div><Label>Telefon</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          </div>
        </div>

        <div className="border rounded-lg p-3 space-y-3">
          <div className="font-medium text-sm">Tur</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Avgång *</Label><Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} /></div>
            <div><Label>Ankomst (uppskattat)</Label><Input type="datetime-local" value={arrivalAt} onChange={(e) => setArrivalAt(e.target.value)} /></div>
          </div>
          <div>
            <Label>Rutt (valfritt – välj eller ange från/till nedan)</Label>
            <Select value={routeId || 'none'} onValueChange={(v) => setRouteId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">– Fri rutt –</SelectItem>
                {routes?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!routeId && (
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Från</Label><Input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Brygga / plats" /></div>
              <div><Label>Till</Label><Input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Brygga / plats" /></div>
            </div>
          )}
          <div>
            <Label>Fartyg</Label>
            <Select value={vesselId || 'none'} onValueChange={(v) => setVesselId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Välj fartyg" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">– Ej tilldelad (resursplanering) –</SelectItem>
                {vessels?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Pris (kr)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </div>

        <div><Label>Kommentar från kund</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <div><Label>Intern anteckning</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} /></div>

        <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
          {create.isPending ? 'Sparar...' : 'Skapa körning'}
        </Button>
      </div>
    </>
  );
}

// ============================================================
// Shared trip form (1 trip, bookings come later)
// ============================================================
function SharedForm({ orgId, defaultDate, onBack, onDone }: any) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [departureAt, setDepartureAt] = useState(
    defaultDate ? format(defaultDate, "yyyy-MM-dd'T'10:00") : format(new Date(), "yyyy-MM-dd'T'10:00")
  );
  const [arrivalAt, setArrivalAt] = useState('');
  const [maxPax, setMaxPax] = useState('12');
  const [bookingDeadline, setBookingDeadline] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [internalNotes, setInternalNotes] = useState('');

  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', orgId)).data || [],
  });
  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', orgId).eq('is_active', true)).data || [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Ingen organisation vald');
      if (!title) throw new Error('Namn på tur krävs');
      if (!routeId) throw new Error('Välj rutt');
      if (!departureAt) throw new Error('Avgångstid krävs');

      const { error } = await supabase.from('booking_departures').insert({
        organization_id: orgId,
        trip_type: 'shared',
        title,
        description: description || null,
        route_id: routeId,
        vessel_id: vesselId || null,
        departure_at: new Date(departureAt).toISOString(),
        arrival_at: arrivalAt ? new Date(arrivalAt).toISOString() : null,
        max_passengers: Number(maxPax),
        booking_deadline: bookingDeadline ? new Date(bookingDeadline).toISOString() : null,
        status: isActive ? 'planerad' : 'installd',
        notes: internalNotes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-departures-month'] });
      toast({ title: 'Reguljärtur skapad', description: 'Turen är nu bokningsbar publikt' });
      onDone();
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <DialogTitle>Ny reguljärtur</DialogTitle>
        </div>
        <DialogDescription>Publik tur som kunder kan boka platser på</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 pt-2">
        <div><Label>Namn på tur *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="t.ex. Skärgårdstur kl 10:00" /></div>
        <div><Label>Beskrivning (visas publikt)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Rutt *</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger><SelectValue placeholder="Välj rutt" /></SelectTrigger>
              <SelectContent>{routes?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fartyg</Label>
            <Select value={vesselId || 'none'} onValueChange={(v) => setVesselId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Välj fartyg" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">– Ej tilldelad (resursplanering) –</SelectItem>
                {vessels?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Avgångstid *</Label><Input type="datetime-local" value={departureAt} onChange={(e) => setDepartureAt(e.target.value)} /></div>
          <div><Label>Sluttid</Label><Input type="datetime-local" value={arrivalAt} onChange={(e) => setArrivalAt(e.target.value)} /></div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Max antal passagerare *</Label><Input type="number" min="1" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
          <div><Label>Sista bokningstid</Label><Input type="datetime-local" value={bookingDeadline} onChange={(e) => setBookingDeadline(e.target.value)} /></div>
        </div>

        <div className="flex items-center justify-between border rounded-lg p-3">
          <div>
            <div className="font-medium text-sm">Publicera direkt</div>
            <div className="text-xs text-muted-foreground">Synlig och bokningsbar på publika sidan</div>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div><Label>Intern anteckning</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} /></div>

        <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
          {create.isPending ? 'Sparar...' : 'Skapa reguljärtur'}
        </Button>
      </div>
    </>
  );
}
