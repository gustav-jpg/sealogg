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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';

const empty: any = {
  id: '', sku: '', name: '', description: '',
  category_id: null, primary_supplier_id: null, brand: '',
  weight_g: '', price_excl_vat: 0, purchase_price: '', vat_rate: 25,
  lead_time_days: '', is_active: true, dropship: false,
};

export default function EshopProducts() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_products', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_products')
        .select('*, es_categories(name), es_suppliers(name)')
        .eq('organization_id', selectedOrgId!)
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['es_categories_select', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('es_categories').select('id,name').eq('organization_id', selectedOrgId!).eq('is_active', true).order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['es_suppliers_psel', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('es_suppliers').select('id,name').eq('organization_id', selectedOrgId!).eq('is_active', true).order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('Ingen organisation');
      const row = {
        organization_id: selectedOrgId,
        sku: p.sku.trim(),
        name: p.name.trim(),
        description: p.description || null,
        category_id: p.category_id || null,
        primary_supplier_id: p.primary_supplier_id || null,
        brand: p.brand || null,
        weight_g: p.weight_g === '' ? null : Number(p.weight_g),
        price_excl_vat: Number(p.price_excl_vat) || 0,
        purchase_price: p.purchase_price === '' ? null : Number(p.purchase_price),
        vat_rate: Number(p.vat_rate) || 25,
        lead_time_days: p.lead_time_days === '' ? null : Number(p.lead_time_days),
        is_active: !!p.is_active,
        dropship: !!p.dropship,
      };
      if (p.id) { const { error } = await supabase.from('es_products').update(row).eq('id', p.id); if (error) throw error; }
      else { const { error } = await supabase.from('es_products').insert(row); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_products'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('es_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_products'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = rows.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name?.toLowerCase().includes(q) || r.sku?.toLowerCase().includes(q) || r.brand?.toLowerCase().includes(q);
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Produkter</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny produkt</Button></DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? 'Redigera produkt' : 'Ny produkt'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>SKU *</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Varumärke</Label><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Namn *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Beskrivning</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Kategori</Label>
                    <Select value={form.category_id || ''} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj kategori" /></SelectTrigger>
                      <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Leverantör</Label>
                    <Select value={form.primary_supplier_id || ''} onValueChange={(v) => setForm({ ...form, primary_supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj leverantör" /></SelectTrigger>
                      <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1"><Label>Pris ex. moms</Label><Input type="number" value={form.price_excl_vat} onChange={e => setForm({ ...form, price_excl_vat: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Inköpspris</Label><Input type="number" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Moms %</Label><Input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Vikt (g)</Label><Input type="number" value={form.weight_g} onChange={e => setForm({ ...form, weight_g: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Leveranstid (d)</Label><Input type="number" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days: e.target.value })} /></div>
                  <div className="flex items-end gap-6">
                    <div className="flex items-center gap-2"><Switch checked={form.dropship} onCheckedChange={(v) => setForm({ ...form, dropship: v })} /><Label>Dropship</Label></div>
                    <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Aktiv</Label></div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button onClick={() => save.mutate(form)} disabled={!form.name || !form.sku || save.isPending}>Spara</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Alla produkter ({filtered.length})</CardTitle>
              <div className="relative w-64">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input placeholder="Sök..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga produkter ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>SKU</TableHead><TableHead>Namn</TableHead><TableHead>Kategori</TableHead><TableHead>Leverantör</TableHead><TableHead className="text-right">Pris</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                      <TableCell className="font-medium">{r.name}{r.brand ? <span className="text-muted-foreground text-xs"> · {r.brand}</span> : null}</TableCell>
                      <TableCell className="text-muted-foreground">{r.es_categories?.name || '–'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.es_suppliers?.name || '–'}</TableCell>
                      <TableCell className="text-right">{Number(r.price_excl_vat).toFixed(2)} kr</TableCell>
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