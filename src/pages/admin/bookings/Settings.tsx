import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Copy, ExternalLink, Plus, Trash2, Edit, MapPin } from 'lucide-react';

export default function BookingSettingsAdmin() {
  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><SettingsIcon className="h-6 w-6" />Inställningar</h1>
          <p className="text-muted-foreground">Publik bokningssida och rutter</p>
        </div>

        <Tabs defaultValue="public">
          <TabsList>
            <TabsTrigger value="public">Publik sida</TabsTrigger>
            <TabsTrigger value="routes">Rutter</TabsTrigger>
          </TabsList>
          <TabsContent value="public" className="mt-4"><PublicSettings /></TabsContent>
          <TabsContent value="routes" className="mt-4"><RoutesSettings /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function PublicSettings() {
  const { selectedOrgId, selectedOrg } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data: settings } = useQuery({
    queryKey: ['booking-settings', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_settings').select('*').eq('organization_id', selectedOrgId!).maybeSingle()).data,
  });

  useEffect(() => {
    if (settings) setForm(settings);
    else if (selectedOrgId && selectedOrg) {
      const slug = selectedOrg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';
      setForm({
        organization_id: selectedOrgId,
        public_slug: slug,
        company_name: selectedOrg.name,
        brand_color: '#0A1628',
        auto_confirm_bookings: false,
        taxi_requires_manual_confirmation: true,
        default_payment_method: 'manuell',
      });
    }
  }, [settings, selectedOrgId, selectedOrg]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from('booking_settings').upsert(form, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-settings'] }); toast({ title: 'Sparat' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  if (!form) return <div className="p-8">Laddar...</div>;

  const publicUrl = `${window.location.origin}/boka/${form.public_slug}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Publik bokningssida</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Slug (URL-namn)</Label>
            <Input value={form.public_slug} onChange={(e) => setForm({ ...form, public_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
            <p className="text-xs text-muted-foreground mt-1">Endast a–z, 0–9 och bindestreck</p>
          </div>
          <div className="flex items-center gap-2 p-2 bg-muted rounded">
            <code className="flex-1 text-sm">{publicUrl}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: 'Kopierad' }); }}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" asChild><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Företag</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Företagsnamn</Label><Input value={form.company_name || ''} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
          <div><Label>Logo-URL</Label><Input value={form.logo_url || ''} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} /></div>
          <div><Label>Profilfärg</Label>
            <div className="flex gap-2">
              <Input type="color" value={form.brand_color || '#0A1628'} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="w-16 p-1" />
              <Input value={form.brand_color || ''} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Kontakt-e-post</Label><Input type="email" value={form.contact_email || ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Kontakttelefon</Label><Input value={form.contact_phone || ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Texter</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Bokningsvillkor</Label><Textarea rows={4} value={form.booking_terms || ''} onChange={(e) => setForm({ ...form, booking_terms: e.target.value })} /></div>
          <div><Label>Bekräftelsemejl-text</Label><Textarea rows={4} value={form.email_confirmation_text || ''} onChange={(e) => setForm({ ...form, email_confirmation_text: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Beteende</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Auto-bekräfta bokningar</Label><p className="text-xs text-muted-foreground">Nya bokningar markeras direkt som bekräftade</p></div>
            <Switch checked={form.auto_confirm_bookings} onCheckedChange={(v) => setForm({ ...form, auto_confirm_bookings: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Bokade turer kräver manuell bekräftelse</Label><p className="text-xs text-muted-foreground">Engångsförfrågningar måste alltid godkännas manuellt</p></div>
            <Switch checked={form.taxi_requires_manual_confirmation} onCheckedChange={(v) => setForm({ ...form, taxi_requires_manual_confirmation: v })} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Spara inställningar</Button>
    </div>
  );
}

// ============ ROUTES ============
type Stop = { name: string; arrival_offset_minutes?: number };

function RoutesSettings() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [stops, setStops] = useState<Stop[]>([{ name: '' }, { name: '' }]);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_routes').select('*').eq('organization_id', selectedOrgId!).order('name')).data || [],
  });

  const reset = () => {
    setEditing(null); setName(''); setDescription(''); setDuration(''); setIsPublic(true); setIsActive(true);
    setStops([{ name: '' }, { name: '' }]);
  };
  const openEdit = (r: any) => {
    setEditing(r); setName(r.name); setDescription(r.description || '');
    setDuration(r.duration_minutes?.toString() || ''); setIsPublic(r.is_public); setIsActive(r.is_active);
    setStops(Array.isArray(r.stops) && r.stops.length ? r.stops : [{ name: '' }, { name: '' }]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen org');
      const cleanStops = stops.filter(s => s.name.trim());
      if (cleanStops.length < 2) throw new Error('Minst 2 stopp krävs');
      const payload = {
        organization_id: selectedOrgId, name, description: description || null,
        duration_minutes: duration ? Number(duration) : null,
        is_public: isPublic, is_active: isActive, stops: cleanStops as any,
      };
      if (editing) {
        const { error } = await supabase.from('booking_routes').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('booking_routes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-routes'] }); setOpen(false); reset(); toast({ title: 'Sparat' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_routes').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-routes'] }); toast({ title: 'Raderad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Vägen turen åker, t.ex. Stockholm → Vaxholm → Grinda</p>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild><Button onClick={reset}><Plus className="h-4 w-4 mr-2" />Ny rutt</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Redigera' : 'Ny'} rutt</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Stockholm – Vaxholm" /></div>
              <div><Label>Beskrivning</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div><Label>Total restid (minuter)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
              <div>
                <Label>Stopp (i ordning) *</Label>
                <div className="space-y-2 mt-1">
                  {stops.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input className="flex-1" placeholder={`Stopp ${i + 1}`} value={s.name} onChange={(e) => { const c = [...stops]; c[i].name = e.target.value; setStops(c); }} />
                      <Input type="number" className="w-32" placeholder="Min från start" value={s.arrival_offset_minutes ?? ''} onChange={(e) => { const c = [...stops]; c[i].arrival_offset_minutes = e.target.value ? Number(e.target.value) : undefined; setStops(c); }} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setStops(stops.filter((_, j) => j !== i))} disabled={stops.length <= 2}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setStops([...stops, { name: '' }])}><Plus className="h-4 w-4 mr-2" />Lägg till stopp</Button>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2"><Switch checked={isPublic} onCheckedChange={setIsPublic} /><Label>Publik</Label></div>
                <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Aktiv</Label></div>
              </div>
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Spara</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {routes?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga rutter än</CardContent></Card>}
        {routes?.map((r: any) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" />{r.name}
                    {!r.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                    {!r.is_public && <Badge variant="outline">Intern</Badge>}
                  </CardTitle>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Radera "${r.name}"?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">Stopp: {(r.stops as any[])?.map(s => s.name).join(' → ')}</div>
              {r.duration_minutes && <div className="text-sm text-muted-foreground">Restid: {r.duration_minutes} min</div>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
