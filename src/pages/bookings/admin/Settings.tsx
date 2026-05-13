import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Settings as SettingsIcon, ExternalLink } from 'lucide-react';

const empty = {
  public_slug: '', is_public_active: false, brand_color: '#0A1628',
  logo_url: '', contact_email: '', contact_phone: '', currency: 'SEK',
  terms_url: '', reservation_ttl_minutes: 15,
};

export default function BookingsSettings() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(empty);

  const { data, isLoading } = useQuery({
    queryKey: ['bk_settings', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('bk_settings').select('*').eq('organization_id', selectedOrgId!).maybeSingle();
      if (error) throw error; return data;
    },
  });

  useEffect(() => { if (data) setForm({ ...empty, ...data, public_slug: data.public_slug ?? '', logo_url: data.logo_url ?? '', contact_email: data.contact_email ?? '', contact_phone: data.contact_phone ?? '', terms_url: data.terms_url ?? '' }); }, [data]);

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('No org');
      const row = {
        organization_id: selectedOrgId,
        public_slug: p.public_slug || null,
        is_public_active: p.is_public_active,
        brand_color: p.brand_color, logo_url: p.logo_url || null,
        contact_email: p.contact_email || null, contact_phone: p.contact_phone || null,
        currency: p.currency || 'SEK', terms_url: p.terms_url || null,
        reservation_ttl_minutes: Number(p.reservation_ttl_minutes) || 15,
      };
      const { error } = await supabase.from('bk_settings').upsert(row, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_settings'] }); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const publicUrl = form.public_slug ? `${window.location.origin}/boka/${form.public_slug}` : null;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Bokningsinställningar</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Publik bokningssida</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Publik slug *</Label>
              <Input value={form.public_slug} onChange={e => setForm({ ...form, public_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="rederi-stockholm" />
              <p className="text-xs text-muted-foreground">URL: <code>/boka/{form.public_slug || '...'}</code></p>
              {publicUrl && form.is_public_active && (
                <a href={publicUrl} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                  Öppna publik sida <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_public_active} onCheckedChange={v => setForm({ ...form, is_public_active: v })} />
              <Label>Publik bokningssida aktiv</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Brand-färg</Label>
                <Input type="color" value={form.brand_color} onChange={e => setForm({ ...form, brand_color: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Logotyp-URL</Label>
                <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kontakt och villkor</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Kontakt-e-post</Label>
                <Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefon</Label>
                <Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Länk till villkor</Label>
              <Input value={form.terms_url} onChange={e => setForm({ ...form, terms_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Valuta</Label>
                <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Reservation TTL (min)</Label>
                <Input type="number" value={form.reservation_ttl_minutes} onChange={e => setForm({ ...form, reservation_ttl_minutes: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate(form)} disabled={save.isPending || isLoading}>Spara</Button>
      </div>
    </MainLayout>
  );
}