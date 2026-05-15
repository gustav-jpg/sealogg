import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';

const empty: any = {
  id: '', name: '', contact_name: '', email: '', phone: '',
  lead_time_days: 5, min_order_value: 0, handling_fee: 0, freight_markup_pct: 0,
  dropship_default: false, is_active: true, notes: '',
};

export default function EshopSuppliers() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_suppliers', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('es_suppliers').select('*').eq('organization_id', selectedOrgId!).order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('Ingen organisation');
      const row = {
        organization_id: selectedOrgId,
        name: p.name,
        contact_name: p.contact_name || null,
        email: p.email || null,
        phone: p.phone || null,
        lead_time_days: Number(p.lead_time_days) || 0,
        min_order_value: Number(p.min_order_value) || 0,
        handling_fee: Number(p.handling_fee) || 0,
        freight_markup_pct: Number(p.freight_markup_pct) || 0,
        dropship_default: !!p.dropship_default,
        is_active: !!p.is_active,
        notes: p.notes || null,
      };
      if (p.id) {
        const { error } = await supabase.from('es_suppliers').update(row).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('es_suppliers').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_suppliers'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('es_suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_suppliers'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Leverantörer</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny leverantör</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? 'Redigera' : 'Ny leverantör'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Namn *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Kontaktperson</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} /></div>
                  <div className="space-y-1"><Label>E-post</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Leveranstid (dagar)</Label><Input type="number" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Min ordervärde (SEK)</Label><Input type="number" value={form.min_order_value} onChange={e => setForm({ ...form, min_order_value: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Hanteringsavgift (SEK)</Label><Input type="number" value={form.handling_fee} onChange={e => setForm({ ...form, handling_fee: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Frakt-påslag %</Label><Input type="number" value={form.freight_markup_pct} onChange={e => setForm({ ...form, freight_markup_pct: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Anteckningar</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2"><Switch checked={form.dropship_default} onCheckedChange={(v) => setForm({ ...form, dropship_default: v })} /><Label>Dropship som standard</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Aktiv</Label></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button onClick={() => save.mutate(form)} disabled={!form.name || save.isPending}>Spara</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Alla leverantörer</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga leverantörer ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Namn</TableHead><TableHead>Kontakt</TableHead><TableHead>E-post</TableHead><TableHead>Lead</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.contact_name || '–'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.email || '–'}</TableCell>
                      <TableCell>{r.lead_time_days} d</TableCell>
                      <TableCell>{r.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...empty, ...r }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Ta bort "${r.name}"?`)) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}