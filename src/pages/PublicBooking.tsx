import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Calendar, MapPin, Users, Ship, Car, CheckCircle2, ArrowLeft, Minus, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type Step = 'route' | 'departure' | 'tickets' | 'details' | 'confirm' | 'done';

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  // Resolve organization from slug
  const { data: orgData, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ['booking-org', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: orgId, error } = await supabase.rpc('get_org_id_by_booking_slug', { _slug: slug! });
      if (error) throw error;
      if (!orgId) throw new Error('Hittades inte');
      const { data: settings } = await supabase.from('booking_settings').select('*').eq('organization_id', orgId).maybeSingle();
      return { orgId: orgId as string, settings };
    },
  });

  const orgId = orgData?.orgId;
  const settings = orgData?.settings;
  const brandColor = settings?.brand_color || '#0A1628';

  // Apply brand color
  useEffect(() => {
    if (brandColor) document.documentElement.style.setProperty('--booking-brand', brandColor);
  }, [brandColor]);

  if (orgLoading) {
    return <PublicShell><div className="text-center py-20">Laddar...</div></PublicShell>;
  }
  if (orgError || !orgData) {
    return <PublicShell><div className="text-center py-20">
      <h1 className="text-2xl font-bold">Bokningssidan hittades inte</h1>
      <p className="text-muted-foreground mt-2">Kontrollera länken.</p>
    </div></PublicShell>;
  }

  return <BookingFlow orgId={orgId!} settings={settings} brandColor={brandColor} />;
}

function PublicShell({ children, settings }: { children: React.ReactNode; settings?: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white">
        <div className="container max-w-3xl mx-auto py-4 px-4 flex items-center gap-3">
          {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-10 w-auto" />}
          <div>
            <div className="font-semibold">{settings?.company_name || 'Bokning'}</div>
            {settings?.contact_email && <div className="text-xs text-muted-foreground">{settings.contact_email}</div>}
          </div>
        </div>
      </header>
      <main className="container max-w-3xl mx-auto px-4 py-6">{children}</main>
      <footer className="container max-w-3xl mx-auto px-4 py-8 text-center text-xs text-muted-foreground">
        Drivs av SeaLogg
      </footer>
    </div>
  );
}

function BookingFlow({ orgId, settings, brandColor }: { orgId: string; settings: any; brandColor: string }) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('route');
  const [mode, setMode] = useState<'schedule' | 'taxi' | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [departureId, setDepartureId] = useState<string | null>(null);
  const [ticketCounts, setTicketCounts] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', notes: '' });
  const [bookingNumber, setBookingNumber] = useState<string | null>(null);

  const { data: routes } = useQuery({
    queryKey: ['public-routes', orgId], enabled: !!orgId,
    queryFn: async () => (await supabase.from('booking_routes').select('*').eq('organization_id', orgId).eq('is_active', true).eq('is_public', true).order('name')).data || [],
  });

  const { data: departures } = useQuery({
    queryKey: ['public-departures', orgId, routeId], enabled: !!orgId && !!routeId,
    queryFn: async () => (await supabase.from('booking_departures').select('*, vessels(name)').eq('organization_id', orgId).eq('route_id', routeId!).in('status', ['planerad', 'fullbokad']).gt('departure_at', new Date().toISOString()).order('departure_at')).data || [],
  });

  const { data: ticketTypes } = useQuery({
    queryKey: ['public-tickets', departureId], enabled: !!departureId,
    queryFn: async () => (await supabase.from('booking_ticket_types').select('*').eq('departure_id', departureId!).order('sort_order')).data || [],
  });

  const { data: existingPassengers } = useQuery({
    queryKey: ['public-pax-count', departureId], enabled: !!departureId,
    queryFn: async () => {
      const { count } = await supabase.from('booking_passengers').select('id', { count: 'exact', head: true }).in('booking_id', [
        ...(await supabase.from('bookings').select('id').eq('departure_id', departureId!).neq('status', 'avbokad')).data?.map(b => b.id) || ['00000000-0000-0000-0000-000000000000']
      ]);
      return count || 0;
    },
  });

  const selectedDeparture = departures?.find(d => d.id === departureId);
  const totalTickets = useMemo(() => Object.values(ticketCounts).reduce((s, n) => s + n, 0), [ticketCounts]);
  const totalPrice = useMemo(() => (ticketTypes || []).reduce((s, t) => s + (ticketCounts[t.id] || 0) * Number(t.price_sek), 0), [ticketCounts, ticketTypes]);
  const seatsLeft = selectedDeparture ? selectedDeparture.max_passengers - (existingPassengers || 0) : 0;

  const submit = async () => {
    if (!departureId || totalTickets === 0) return;
    if (totalTickets > seatsLeft) {
      toast({ title: 'För få platser', description: `Endast ${seatsLeft} platser kvar`, variant: 'destructive' });
      return;
    }
    const { data: booking, error } = await supabase.from('bookings').insert({
      organization_id: orgId,
      departure_id: departureId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone || null,
      customer_notes: customer.notes || null,
      total_passengers: totalTickets,
      total_price_sek: totalPrice,
      status: settings?.auto_confirm_bookings ? 'bekraftad' : 'avvaktar',
    }).select().single();
    if (error || !booking) {
      toast({ title: 'Bokningen misslyckades', description: error?.message, variant: 'destructive' });
      return;
    }
    const passengerRows: any[] = [];
    for (const t of ticketTypes || []) {
      const n = ticketCounts[t.id] || 0;
      for (let i = 0; i < n; i++) {
        passengerRows.push({ booking_id: booking.id, ticket_type_id: t.id, price_sek: t.price_sek });
      }
    }
    if (passengerRows.length) {
      const { error: pErr } = await supabase.from('booking_passengers').insert(passengerRows);
      if (pErr) {
        toast({ title: 'Passagerare kunde inte sparas', description: pErr.message, variant: 'destructive' });
        return;
      }
    }
    setBookingNumber(booking.booking_number);
    setStep('done');
  };

  // ===== Render =====
  return (
    <PublicShell settings={settings}>
      {step === 'done' ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto" style={{ color: brandColor }} />
            <h1 className="text-2xl font-bold">Tack för din bokning!</h1>
            <p className="text-muted-foreground">Bokningsnummer: <span className="font-mono font-semibold">{bookingNumber}</span></p>
            <p className="text-sm">{settings?.email_confirmation_text || 'Du får en bekräftelse via e-post inom kort.'}</p>
          </CardContent>
        </Card>
      ) : mode === null ? (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Vad vill du boka?</h1>
          <div className="grid sm:grid-cols-2 gap-3">
            <Card className="cursor-pointer hover:border-primary transition" onClick={() => setMode('schedule')}>
              <CardContent className="p-6 text-center space-y-2">
                <Calendar className="h-10 w-10 mx-auto" style={{ color: brandColor }} />
                <div className="font-semibold">Reguljär avgång</div>
                <p className="text-sm text-muted-foreground">Boka biljett på en planerad tur</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:border-primary transition" onClick={() => setMode('taxi')}>
              <CardContent className="p-6 text-center space-y-2">
                <Car className="h-10 w-10 mx-auto" style={{ color: brandColor }} />
                <div className="font-semibold">Taxibåt</div>
                <p className="text-sm text-muted-foreground">Beställ skräddarsydd transport</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : mode === 'taxi' ? (
        <TaxiForm orgId={orgId} brandColor={brandColor} onBack={() => setMode(null)} />
      ) : (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => { if (step === 'route') setMode(null); else setStep(step === 'departure' ? 'route' : step === 'tickets' ? 'departure' : step === 'details' ? 'tickets' : 'details'); }}>
            <ArrowLeft className="h-4 w-4 mr-1" />Tillbaka
          </Button>

          {step === 'route' && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Välj rutt</h1>
              {routes?.length === 0 && <p className="text-muted-foreground">Inga rutter tillgängliga</p>}
              {routes?.map((r: any) => (
                <Card key={r.id} className="cursor-pointer hover:border-primary transition" onClick={() => { setRouteId(r.id); setStep('departure'); }}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5" style={{ color: brandColor }} />
                      <div className="flex-1">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-sm text-muted-foreground">{(r.stops as any[]).map(s => s.name).join(' → ')}</div>
                        {r.duration_minutes && <div className="text-xs text-muted-foreground">≈ {r.duration_minutes} min</div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'departure' && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Välj avgång</h1>
              {departures?.length === 0 && <p className="text-muted-foreground">Inga kommande avgångar</p>}
              {departures?.map((d: any) => (
                <Card key={d.id} className={`cursor-pointer hover:border-primary transition ${d.status === 'fullbokad' ? 'opacity-50' : ''}`} onClick={() => { if (d.status !== 'fullbokad') { setDepartureId(d.id); setTicketCounts({}); setStep('tickets'); } }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{format(new Date(d.departure_at), 'EEE d MMM, HH:mm', { locale: sv })}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1"><Ship className="h-3 w-3" />{d.vessels?.name}</div>
                    </div>
                    {d.status === 'fullbokad' ? <Badge variant="destructive">Fullbokad</Badge> : <Badge variant="secondary">{d.max_passengers} platser</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {step === 'tickets' && selectedDeparture && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Välj biljetter</h1>
              <div className="text-sm text-muted-foreground">{format(new Date(selectedDeparture.departure_at), 'EEEE d MMMM, HH:mm', { locale: sv })} • {seatsLeft} platser kvar</div>
              {ticketTypes?.length === 0 && <p className="text-muted-foreground">Inga biljett-typer publicerade för denna avgång.</p>}
              {ticketTypes?.map((t: any) => {
                const count = ticketCounts[t.id] || 0;
                return (
                  <Card key={t.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-sm text-muted-foreground">{Number(t.price_sek).toFixed(0)} kr</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => setTicketCounts({ ...ticketCounts, [t.id]: Math.max(0, count - 1) })} disabled={count === 0}><Minus className="h-4 w-4" /></Button>
                        <span className="w-8 text-center font-semibold">{count}</span>
                        <Button variant="outline" size="icon" onClick={() => setTicketCounts({ ...ticketCounts, [t.id]: count + 1 })} disabled={totalTickets >= seatsLeft || (t.max_count && count >= t.max_count)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {totalTickets > 0 && (
                <Card style={{ borderColor: brandColor }}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" />{totalTickets} pers</div>
                    <div className="font-bold text-lg">{totalPrice.toFixed(0)} kr</div>
                  </CardContent>
                </Card>
              )}
              <Button className="w-full" disabled={totalTickets === 0} onClick={() => setStep('details')} style={{ backgroundColor: brandColor }}>Fortsätt</Button>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Dina uppgifter</h1>
              <div><Label>Namn *</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
              <div><Label>E-post *</Label><Input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></div>
              <div><Label>Telefon</Label><Input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
              <div><Label>Meddelande (valfritt)</Label><Textarea value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} /></div>
              <Button className="w-full" disabled={!customer.name || !customer.email} onClick={() => setStep('confirm')} style={{ backgroundColor: brandColor }}>Granska</Button>
            </div>
          )}

          {step === 'confirm' && selectedDeparture && (
            <div className="space-y-3">
              <h1 className="text-2xl font-bold">Bekräfta bokning</h1>
              <Card><CardContent className="p-4 space-y-2 text-sm">
                <div><b>Avgång:</b> {format(new Date(selectedDeparture.departure_at), 'EEEE d MMMM yyyy, HH:mm', { locale: sv })}</div>
                <div><b>Fartyg:</b> {selectedDeparture.vessels?.name}</div>
                <Separator />
                {(ticketTypes || []).filter(t => ticketCounts[t.id]).map((t: any) => (
                  <div key={t.id} className="flex justify-between"><span>{ticketCounts[t.id]} × {t.name}</span><span>{(ticketCounts[t.id] * Number(t.price_sek)).toFixed(0)} kr</span></div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold text-base"><span>Totalt</span><span>{totalPrice.toFixed(0)} kr</span></div>
                <Separator />
                <div><b>Namn:</b> {customer.name}</div>
                <div><b>E-post:</b> {customer.email}</div>
                {customer.phone && <div><b>Telefon:</b> {customer.phone}</div>}
              </CardContent></Card>
              {settings?.booking_terms && (
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bokningsvillkor</CardTitle></CardHeader>
                  <CardContent className="text-xs whitespace-pre-wrap text-muted-foreground">{settings.booking_terms}</CardContent>
                </Card>
              )}
              <Button className="w-full" onClick={submit} style={{ backgroundColor: brandColor }}>Bekräfta bokning</Button>
              <p className="text-xs text-center text-muted-foreground">Betalning sker manuellt enligt instruktioner från {settings?.company_name || 'rederiet'}.</p>
            </div>
          )}
        </div>
      )}
    </PublicShell>
  );
}

function TaxiForm({ orgId, brandColor, onBack }: { orgId: string; brandColor: string; onBack: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    customer_name: '', customer_email: '', customer_phone: '',
    pickup_location: '', dropoff_location: '',
    requested_at: '', passenger_count: 1, notes: '',
  });
  const [submitted, setSubmitted] = useState<string | null>(null);

  const submit = async () => {
    if (!form.customer_name || !form.customer_email || !form.customer_phone || !form.pickup_location || !form.dropoff_location || !form.requested_at) {
      toast({ title: 'Fyll i alla obligatoriska fält', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.from('booking_taxi_requests').insert({
      organization_id: orgId,
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      customer_phone: form.customer_phone,
      pickup_location: form.pickup_location,
      dropoff_location: form.dropoff_location,
      requested_at: new Date(form.requested_at).toISOString(),
      passenger_count: Number(form.passenger_count),
      notes: form.notes || null,
    }).select().single();
    if (error) { toast({ title: 'Förfrågan misslyckades', description: error.message, variant: 'destructive' }); return; }
    setSubmitted(data.request_number);
  };

  if (submitted) {
    return (
      <Card><CardContent className="p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 mx-auto" style={{ color: brandColor }} />
        <h1 className="text-2xl font-bold">Tack för din förfrågan!</h1>
        <p className="text-muted-foreground">Förfrågansnummer: <span className="font-mono font-semibold">{submitted}</span></p>
        <p className="text-sm">Vi återkommer med bekräftelse så snart vi kan.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Tillbaka</Button>
      <h1 className="text-2xl font-bold">Beställ taxibåt</h1>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Namn *</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></div>
        <div><Label>Antal personer *</Label><Input type="number" min={1} value={form.passenger_count} onChange={(e) => setForm({ ...form, passenger_count: Number(e.target.value) })} /></div>
        <div><Label>E-post *</Label><Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} /></div>
        <div><Label>Telefon *</Label><Input type="tel" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
      </div>
      <div><Label>Hämtplats *</Label><Input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} placeholder="t.ex. Strömkajen" /></div>
      <div><Label>Avlämningsplats *</Label><Input value={form.dropoff_location} onChange={(e) => setForm({ ...form, dropoff_location: e.target.value })} placeholder="t.ex. Vaxholm" /></div>
      <div><Label>Önskad tid *</Label><Input type="datetime-local" value={form.requested_at} onChange={(e) => setForm({ ...form, requested_at: e.target.value })} /></div>
      <div><Label>Övrig info</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      <Button className="w-full" onClick={submit} style={{ backgroundColor: brandColor }}>Skicka förfrågan</Button>
    </div>
  );
}