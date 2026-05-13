import { useState } from 'react';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { ArrowLeft, Users, MapPin, Ship, Calendar, Plus, Trash2, Ticket, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Mail, Phone, Tag, FileText, CreditCard, Languages, UtensilsCrossed, Accessibility, UserCheck, Download, Ban, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id], enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_departures')
        .select('*, booking_routes(name, stops), vessels(name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ['trip-bookings', id], enabled: !!id,
    queryFn: async () => (await supabase.from('bookings').select('*').eq('departure_id', id!).order('created_at')).data || [],
  });

  const { data: ticketTypes } = useQuery({
    queryKey: ['trip-ticket-types', id], enabled: !!id,
    queryFn: async () => (await supabase.from('booking_ticket_types').select('*').eq('departure_id', id!).order('sort_order')).data || [],
  });

  const updateTrip = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from('booking_departures').update(payload).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip', id] }); toast({ title: 'Sparat' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const deleteTrip = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('booking_departures').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Tur raderad' }); navigate('/portal/bookings'); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  if (isLoading || !trip) {
    return <MainLayout><div className="p-8 text-center text-muted-foreground">Laddar...</div></MainLayout>;
  }

  const isPrivate = (trip as any).trip_type === 'private';
  const totalBooked = (bookings || []).filter(b => b.status !== 'avbokad').reduce((s, b) => s + (b.total_passengers || 0), 0);
  const seatsLeft = trip.max_passengers - totalBooked;
  const fillPct = Math.round((totalBooked / trip.max_passengers) * 100);

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4 max-w-5xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link to="/portal/bookings"><ArrowLeft className="h-4 w-4 mr-1" />Tillbaka</Link></Button>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isPrivate ? 'secondary' : 'default'}>
                {isPrivate ? 'Enskild körning' : 'Delad körning'}
              </Badge>
              <Badge variant="outline">{trip.status}</Badge>
            </div>
            <h1 className="text-2xl font-bold">{(trip as any).title || (trip as any).booking_routes?.name || 'Tur'}</h1>
            <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(parseISO(trip.departure_at), 'EEEE d MMM yyyy, HH:mm', { locale: sv })}</span>
              <span className="flex items-center gap-1"><Ship className="h-3.5 w-3.5" />{(trip as any).vessels?.name}</span>
              {(trip as any).booking_routes?.name && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{(trip as any).booking_routes.name}</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { if (confirm('Radera hela turen och dess bokningar?')) deleteTrip.mutate(); }}><Trash2 className="h-4 w-4 mr-2 text-destructive" />Radera tur</Button>
        </div>

        {/* Capacity card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" />Beläggning</div>
              <div className="text-sm">
                <span className="font-semibold">{totalBooked}</span> / {trip.max_passengers} platser
                {seatsLeft > 0 ? <span className="text-muted-foreground ml-2">({seatsLeft} kvar)</span> : <Badge variant="destructive" className="ml-2">Fullbokad</Badge>}
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(fillPct, 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Bookings list */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Bokningar ({bookings?.length || 0})</CardTitle>
              {bookings && bookings.length > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {bookings.filter((b: any) => b.checked_in_at).length} incheckade · {bookings.reduce((s: number, b: any) => s + Number(b.total_price_sek || 0), 0).toLocaleString('sv-SE')} kr
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {bookings && bookings.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => exportBookingsCsv(bookings, trip)}>
                  <Download className="h-4 w-4 mr-1" />CSV
                </Button>
              )}
              <AddBookingDialog trip={trip} ticketTypes={ticketTypes || []} seatsLeft={seatsLeft} onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ['trip-bookings', id] });
              }} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!bookings?.length ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Inga bokningar än. Klicka "Lägg till bokning" för att registrera en kund manuellt, eller dela publika länken så kan kunder boka själva.</div>
            ) : (
              <div className="divide-y">
                {bookings.map((b: any) => (
                  <BookingRow key={b.id} booking={b} tripId={id!} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket types */}
        {!isPrivate && <TicketTypesCard tripId={id!} orgId={trip.organization_id} ticketTypes={ticketTypes || []} />}

        {/* Trip details / settings */}
        <TripSettingsCard trip={trip} onSave={(p) => updateTrip.mutate(p)} isPrivate={isPrivate} />
      </div>
    </MainLayout>
  );
}

function exportBookingsCsv(bookings: any[], trip: any) {
  const headers = ['Bokningsnr','Namn','E-post','Telefon','Antal','Pris','Status','Betalning','Källa','Etiketter','Specialkost','Tillgänglighet','Skapad'];
  const rows = bookings.map((b: any) => [
    b.booking_number, b.customer_name, b.customer_email, b.customer_phone || '',
    b.total_passengers, b.total_price_sek, b.status, b.payment_status,
    b.source || '', (b.tags || []).join('|'),
    b.dietary_requirements || '', b.accessibility_needs || '',
    new Date(b.created_at).toISOString(),
  ]);
  const csv = [headers, ...rows].map(r => r.map((v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  }).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bokningar_${(trip?.title || 'tur').replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AddBookingDialog({ trip, ticketTypes, seatsLeft, onCreated }: any) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pax, setPax] = useState('1');
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [dietary, setDietary] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [language, setLanguage] = useState('sv');
  const [country, setCountry] = useState('SE');
  const [source, setSource] = useState('phone');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('obetald');
  const [bookingStatus, setBookingStatus] = useState('bekraftad');
  const [priority, setPriority] = useState('normal');
  const [invoice, setInvoice] = useState('');

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setPax('1'); setPrice(''); setDeposit('');
    setNotes(''); setInternalNotes(''); setDietary(''); setAccessibility('');
    setLanguage('sv'); setCountry('SE'); setSource('phone'); setTags([]); setTagInput('');
    setPaymentStatus('obetald'); setBookingStatus('bekraftad'); setPriority('normal'); setInvoice('');
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const submit = async () => {
    if (!name || !email) { toast({ title: 'Namn och e-post krävs', variant: 'destructive' }); return; }
    if (Number(pax) > seatsLeft) { toast({ title: `Bara ${seatsLeft} platser kvar`, variant: 'destructive' }); return; }
    const { error } = await supabase.from('bookings').insert({
      organization_id: trip.organization_id,
      departure_id: trip.id,
      customer_name: name, customer_email: email, customer_phone: phone || null,
      total_passengers: Number(pax),
      total_price_sek: price ? Number(price) : 0,
      deposit_paid_sek: deposit ? Number(deposit) : 0,
      status: bookingStatus as any,
      payment_status: paymentStatus as any,
      customer_notes: notes || null,
      internal_notes: internalNotes || null,
      dietary_requirements: dietary || null,
      accessibility_needs: accessibility || null,
      language: language || null,
      country: country || null,
      source: source || null,
      tags,
      priority,
      invoice_number: invoice || null,
    } as any);
    if (error) { toast({ title: 'Fel', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Bokning tillagd' });
    setOpen(false); reset();
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button size="sm" disabled={seatsLeft <= 0}><Plus className="h-4 w-4 mr-2" />Lägg till bokning</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Manuell bokning</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* KUND */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kund</div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Antal passagerare *</Label><Input type="number" min="1" max={seatsLeft} value={pax} onChange={(e) => setPax(e.target.value)} /></div>
              <div><Label>E-post *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div>
                <Label>Språk</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">Svenska</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="no">Norsk</SelectItem>
                    <SelectItem value="da">Dansk</SelectItem>
                    <SelectItem value="fi">Suomi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Land</Label><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="SE" /></div>
            </div>
          </div>

          {/* BOKNING */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bokning</div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Bokningsstatus</Label>
                <Select value={bookingStatus} onValueChange={setBookingStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avvaktar">Avvaktar</SelectItem>
                    <SelectItem value="bekraftad">Bekräftad</SelectItem>
                    <SelectItem value="avbokad">Avbokad</SelectItem>
                    <SelectItem value="no_show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Källa</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Webb</SelectItem>
                    <SelectItem value="phone">Telefon</SelectItem>
                    <SelectItem value="email">E-post</SelectItem>
                    <SelectItem value="walk_in">Drop-in</SelectItem>
                    <SelectItem value="partner">Partner / Återförsäljare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioritet</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Låg</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hög (VIP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fakturanummer</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="t.ex. F-2026-0123" /></div>
            </div>
          </div>

          {/* BETALNING */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Betalning</div>
            <div className="p-3 grid grid-cols-3 gap-3">
              <div><Label>Pris totalt (kr)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div><Label>Erlagd handpenning (kr)</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
              <div>
                <Label>Betalningsstatus</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obetald">Obetald</SelectItem>
                    <SelectItem value="delbetald">Delbetald</SelectItem>
                    <SelectItem value="betald">Betald</SelectItem>
                    <SelectItem value="aterbetald">Återbetald</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SPECIALBEHOV */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialbehov & övrigt</div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="flex items-center gap-1"><UtensilsCrossed className="h-3.5 w-3.5" />Specialkost</Label><Input value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="t.ex. Glutenfri, vegan" /></div>
                <div><Label className="flex items-center gap-1"><Accessibility className="h-3.5 w-3.5" />Tillgänglighet</Label><Input value={accessibility} onChange={(e) => setAccessibility(e.target.value)} placeholder="t.ex. Rullstol, hörselslinga" /></div>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />Etiketter</Label>
                <div className="flex flex-wrap gap-1 mb-1 mt-1">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Skriv etikett och tryck Enter" />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Lägg till</Button>
                </div>
              </div>
              <div><Label>Kommentar från kund</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              <div><Label>Intern anteckning</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} placeholder="Syns ej för kund" /></div>
            </div>
          </div>

          <Button className="w-full" onClick={submit}>Spara bokning</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// BOOKING ROW – expanderbar rad med detaljer + check-in
// ============================================================
function BookingRow({ booking, tripId }: { booking: any; tripId: string }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const checkIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bookings').update({
        checked_in_at: new Date().toISOString(),
        checked_in_count: booking.total_passengers,
      } as any).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }); toast({ title: 'Incheckad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });
  const undoCheckIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bookings').update({ checked_in_at: null, checked_in_count: 0 } as any).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }); toast({ title: 'Incheckning ångrad' }); },
  });
  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('bookings').update({ status: status as any }).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }),
  });
  const setPayment = useMutation({
    mutationFn: async (s: string) => {
      const { error } = await supabase.from('bookings').update({ payment_status: s as any }).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }),
  });
  const removeBooking = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }); toast({ title: 'Bokning raderad' }); },
  });
  const cancelBooking = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bookings').update({ status: 'avbokad' as any }).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] }); toast({ title: 'Bokning avbokad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const isCheckedIn = !!booking.checked_in_at;
  const statusColor = booking.status === 'bekraftad' ? 'default' : booking.status === 'avbokad' ? 'destructive' : 'secondary';
  const payColor = booking.payment_status === 'betald' ? 'default' : booking.payment_status === 'obetald' ? 'secondary' : 'outline';

  return (
    <div className="hover:bg-muted/30 transition">
      <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <button className="text-muted-foreground shrink-0">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
          <div className="col-span-3 min-w-0">
            <div className="font-medium text-sm flex items-center gap-1.5">
              {booking.priority === 'high' && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">VIP</Badge>}
              <span className="truncate">{booking.customer_name}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">{booking.booking_number}</div>
          </div>
          <div className="col-span-3 text-xs text-muted-foreground truncate hidden md:block">
            <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{booking.customer_email}</div>
            {booking.customer_phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{booking.customer_phone}</div>}
          </div>
          <div className="col-span-1 text-sm font-semibold tabular-nums text-center">{booking.total_passengers}</div>
          <div className="col-span-2 text-sm tabular-nums text-right">{Number(booking.total_price_sek).toFixed(0)} kr</div>
          <div className="col-span-3 flex items-center justify-end gap-1 flex-wrap">
            <Badge variant={statusColor as any} className="text-[10px]">{booking.status}</Badge>
            <Badge variant={payColor as any} className="text-[10px]">{booking.payment_status}</Badge>
            {isCheckedIn && <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700"><UserCheck className="h-3 w-3 mr-0.5" />Inne</Badge>}
          </div>
        </div>
      </div>

      {open && (
        <div className="px-10 pb-3 space-y-3 bg-muted/10 border-t">
          {/* Tags */}
          {booking.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-3">
              {booking.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3 pt-2 text-sm">
            {booking.dietary_requirements && (
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" />Specialkost</div><div>{booking.dietary_requirements}</div></div>
            )}
            {booking.accessibility_needs && (
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><Accessibility className="h-3 w-3" />Tillgänglighet</div><div>{booking.accessibility_needs}</div></div>
            )}
            {booking.language && (
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><Languages className="h-3 w-3" />Språk</div><div className="uppercase">{booking.language}{booking.country ? ` · ${booking.country}` : ''}</div></div>
            )}
            {booking.source && (
              <div><div className="text-xs text-muted-foreground">Källa</div><div className="capitalize">{booking.source.replace('_', ' ')}</div></div>
            )}
            {Number(booking.deposit_paid_sek) > 0 && (
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" />Erlagd handpenning</div><div>{Number(booking.deposit_paid_sek).toFixed(0)} kr</div></div>
            )}
            {booking.invoice_number && (
              <div><div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" />Faktura</div><div className="font-mono text-xs">{booking.invoice_number}</div></div>
            )}
            {isCheckedIn && (
              <div><div className="text-xs text-muted-foreground">Incheckad</div><div>{format(parseISO(booking.checked_in_at), 'yyyy-MM-dd HH:mm')} ({booking.checked_in_count} pers)</div></div>
            )}
          </div>

          {(booking.customer_notes || booking.internal_notes) && (
            <div className="space-y-2">
              {booking.customer_notes && (
                <div className="rounded border-l-2 border-primary bg-primary/5 p-2 text-xs">
                  <div className="font-semibold text-muted-foreground mb-0.5">Kommentar från kund</div>
                  {booking.customer_notes}
                </div>
              )}
              {booking.internal_notes && (
                <div className="rounded border-l-2 border-amber-500 bg-amber-500/5 p-2 text-xs">
                  <div className="font-semibold text-muted-foreground mb-0.5">Intern anteckning</div>
                  {booking.internal_notes}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            {!isCheckedIn ? (
              <Button size="sm" onClick={() => checkIn.mutate()} disabled={checkIn.isPending || booking.status === 'avbokad'}>
                <UserCheck className="h-4 w-4 mr-1" />Checka in
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => undoCheckIn.mutate()}>Ångra incheckning</Button>
            )}
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}>
              <Pencil className="h-4 w-4 mr-1" />Redigera
            </Button>
            {booking.status !== 'avbokad' && (
              <Button size="sm" variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => { if (confirm('Avboka denna bokning? Status sätts till avbokad och platserna frigörs.')) cancelBooking.mutate(); }}>
                <Ban className="h-4 w-4 mr-1" />Avboka
              </Button>
            )}
            <Select value={booking.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avvaktar">Avvaktar</SelectItem>
                <SelectItem value="bekraftad">Bekräftad</SelectItem>
                <SelectItem value="avbokad">Avbokad</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
            <Select value={booking.payment_status} onValueChange={(v) => setPayment.mutate(v)}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="obetald">Obetald</SelectItem>
                <SelectItem value="delbetald">Delbetald</SelectItem>
                <SelectItem value="betald">Betald</SelectItem>
                <SelectItem value="aterbetald">Återbetald</SelectItem>
              </SelectContent>
            </Select>
            <a
              href={`mailto:${booking.customer_email}?subject=Din bokning ${booking.booking_number}`}
              className="inline-flex items-center text-xs text-primary hover:underline"
            ><Mail className="h-3.5 w-3.5 mr-1" />E-posta</a>
            {booking.customer_phone && (
              <a href={`tel:${booking.customer_phone}`} className="inline-flex items-center text-xs text-primary hover:underline">
                <Phone className="h-3.5 w-3.5 mr-1" />Ring
              </a>
            )}
            <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => { if (confirm('Radera bokning?')) removeBooking.mutate(); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <EditBookingDialog booking={booking} tripId={tripId} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function TicketTypesCard({ tripId, orgId, ticketTypes }: any) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [maxCount, setMaxCount] = useState('');

  const add = useMutation({
    mutationFn: async () => {
      if (!name || !price) throw new Error('Namn och pris krävs');
      const { error } = await supabase.from('booking_ticket_types').insert({
        organization_id: orgId, departure_id: tripId, name,
        price_sek: Number(price), max_count: maxCount ? Number(maxCount) : null,
        sort_order: ticketTypes.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['trip-ticket-types', tripId] }); setName(''); setPrice(''); setMaxCount(''); toast({ title: 'Biljett-typ tillagd' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_ticket_types').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-ticket-types', tripId] }),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ticket className="h-4 w-4" />Biljett-typer</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!ticketTypes.length ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>Inga biljett-typer. Kunder kan inte boka publikt utan minst en biljett-typ (t.ex. "Vuxen 250 kr").</div>
          </div>
        ) : (
          <div className="space-y-2">
            {ticketTypes.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{Number(t.price_sek).toFixed(0)} kr {t.max_count ? `• max ${t.max_count}` : ''}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t pt-3">
          <Label className="text-xs">Lägg till biljett-typ</Label>
          <div className="grid grid-cols-[1fr_120px_100px_auto] gap-2 mt-1">
            <Input placeholder="Namn (Vuxen)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input type="number" placeholder="Pris" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Input type="number" placeholder="Max" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
            <Button onClick={() => add.mutate()} size="icon"><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TripSettingsCard({ trip, onSave, isPrivate }: any) {
  const [title, setTitle] = useState(trip.title || '');
  const [description, setDescription] = useState(trip.description || '');
  const [maxPax, setMaxPax] = useState(trip.max_passengers.toString());
  const [status, setStatus] = useState(trip.status);
  const [notes, setNotes] = useState(trip.notes || '');
  const [vesselId, setVesselId] = useState<string>(trip.vessel_id || 'none');
  const { data: vessels } = useOrgVessels(trip.organization_id);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Turinställningar</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {!isPrivate && (
          <>
            <div><Label>Namn på tur</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>Beskrivning (publik)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          </>
        )}
        <div>
          <Label>Fartyg</Label>
          <Select value={vesselId} onValueChange={setVesselId}>
            <SelectTrigger><SelectValue placeholder="Välj fartyg" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">– Ej tilldelad (resursplanering) –</SelectItem>
              {vessels?.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Max passagerare</Label><Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
          <div><Label>Status</Label>
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
        </div>
        <div><Label>Intern anteckning</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        <Button onClick={() => onSave({ title: title || null, description: description || null, max_passengers: Number(maxPax), status, notes: notes || null, vessel_id: vesselId === 'none' ? null : vesselId })} className="w-full"><CheckCircle2 className="h-4 w-4 mr-2" />Spara ändringar</Button>
      </CardContent>
    </Card>
  );
}

// ============================================================
// EDIT BOOKING DIALOG
// ============================================================
function EditBookingDialog({ booking, tripId, open, onOpenChange }: { booking: any; tripId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(booking.customer_name || '');
  const [email, setEmail] = useState(booking.customer_email || '');
  const [phone, setPhone] = useState(booking.customer_phone || '');
  const [pax, setPax] = useState(String(booking.total_passengers || 1));
  const [price, setPrice] = useState(booking.total_price_sek?.toString() || '');
  const [deposit, setDeposit] = useState(booking.deposit_paid_sek?.toString() || '');
  const [notes, setNotes] = useState(booking.customer_notes || '');
  const [internalNotes, setInternalNotes] = useState(booking.internal_notes || '');
  const [dietary, setDietary] = useState(booking.dietary_requirements || '');
  const [accessibility, setAccessibility] = useState(booking.accessibility_needs || '');
  const [language, setLanguage] = useState(booking.language || 'sv');
  const [country, setCountry] = useState(booking.country || 'SE');
  const [source, setSource] = useState(booking.source || 'phone');
  const [paymentStatus, setPaymentStatus] = useState(booking.payment_status || 'obetald');
  const [bookingStatus, setBookingStatus] = useState(booking.status || 'bekraftad');
  const [priority, setPriority] = useState(booking.priority || 'normal');
  const [invoice, setInvoice] = useState(booking.invoice_number || '');
  const [tags, setTags] = useState<string[]>(booking.tags || []);
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name || !email) throw new Error('Namn och e-post krävs');
      const { error } = await supabase.from('bookings').update({
        customer_name: name,
        customer_email: email,
        customer_phone: phone || null,
        total_passengers: Number(pax),
        total_price_sek: price ? Number(price) : 0,
        deposit_paid_sek: deposit ? Number(deposit) : 0,
        status: bookingStatus as any,
        payment_status: paymentStatus as any,
        customer_notes: notes || null,
        internal_notes: internalNotes || null,
        dietary_requirements: dietary || null,
        accessibility_needs: accessibility || null,
        language: language || null,
        country: country || null,
        source: source || null,
        tags,
        priority,
        invoice_number: invoice || null,
      } as any).eq('id', booking.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-bookings', tripId] });
      toast({ title: 'Bokning uppdaterad' });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redigera bokning · <span className="font-mono text-sm text-muted-foreground">{booking.booking_number}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kund</div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Antal passagerare *</Label><Input type="number" min="1" value={pax} onChange={(e) => setPax(e.target.value)} /></div>
              <div><Label>E-post *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div>
                <Label>Språk</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sv">Svenska</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="no">Norsk</SelectItem>
                    <SelectItem value="da">Dansk</SelectItem>
                    <SelectItem value="fi">Suomi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Land</Label><Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} /></div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bokning</div>
            <div className="p-3 grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={bookingStatus} onValueChange={setBookingStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avvaktar">Avvaktar</SelectItem>
                    <SelectItem value="bekraftad">Bekräftad</SelectItem>
                    <SelectItem value="avbokad">Avbokad</SelectItem>
                    <SelectItem value="no_show">No-show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Källa</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="web">Webb</SelectItem>
                    <SelectItem value="phone">Telefon</SelectItem>
                    <SelectItem value="email">E-post</SelectItem>
                    <SelectItem value="walk_in">Drop-in</SelectItem>
                    <SelectItem value="partner">Partner / Återförsäljare</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioritet</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Låg</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hög (VIP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fakturanummer</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Betalning</div>
            <div className="p-3 grid grid-cols-3 gap-3">
              <div><Label>Pris totalt (kr)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
              <div><Label>Erlagd handpenning (kr)</Label><Input type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></div>
              <div>
                <Label>Betalningsstatus</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obetald">Obetald</SelectItem>
                    <SelectItem value="delbetald">Delbetald</SelectItem>
                    <SelectItem value="betald">Betald</SelectItem>
                    <SelectItem value="aterbetald">Återbetald</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Specialbehov & övrigt</div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="flex items-center gap-1"><UtensilsCrossed className="h-3.5 w-3.5" />Specialkost</Label><Input value={dietary} onChange={(e) => setDietary(e.target.value)} /></div>
                <div><Label className="flex items-center gap-1"><Accessibility className="h-3.5 w-3.5" />Tillgänglighet</Label><Input value={accessibility} onChange={(e) => setAccessibility(e.target.value)} /></div>
              </div>
              <div>
                <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" />Etiketter</Label>
                <div className="flex flex-wrap gap-1 mb-1 mt-1">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => setTags(tags.filter(x => x !== t))}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Skriv etikett och tryck Enter" />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}>Lägg till</Button>
                </div>
              </div>
              <div><Label>Kommentar från kund</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
              <div><Label>Intern anteckning</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} /></div>
            </div>
          </div>

          <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Sparar...' : 'Spara ändringar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
