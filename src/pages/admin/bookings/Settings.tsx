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
import { useToast } from '@/hooks/use-toast';
import { Ticket, Copy, ExternalLink } from 'lucide-react';

export default function BookingSettingsAdmin() {
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

  if (!form) return <MainLayout><div className="p-8">Laddar...</div></MainLayout>;

  const publicUrl = `${window.location.origin}/boka/${form.public_slug}`;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Ticket className="h-6 w-6" />Bokningsinställningar</h1>
          <p className="text-muted-foreground">Konfigurera ditt rederis bokningssida</p>
        </div>

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
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Profilfärg</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.brand_color || '#0A1628'} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} className="w-16 p-1" />
                  <Input value={form.brand_color || ''} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} />
                </div>
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
              <div><Label>Taxibåt kräver manuell bekräftelse</Label><p className="text-xs text-muted-foreground">Taxiförfrågningar måste alltid godkännas manuellt</p></div>
              <Switch checked={form.taxi_requires_manual_confirmation} onCheckedChange={(v) => setForm({ ...form, taxi_requires_manual_confirmation: v })} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Spara inställningar</Button>
      </div>
    </MainLayout>
  );
}