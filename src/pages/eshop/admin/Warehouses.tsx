import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Warehouse } from 'lucide-react';

const empty: any = { id: '', name: '', is_external: false, supplier_id: null, is_active: true };

export default function EshopWarehouses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_warehouses').select('*, es_suppliers(name)').order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['es_suppliers_select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_suppliers').select('id,name').eq('is_active', true).order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      const row = {
        name: p.name,
        is_external: !!p.is_external,
        supplier_id: p.supplier_id || null,
        is_active: !!p.is_active,
      };
      if (p.id) { const { error } = await supabase.from('es_warehouses').update(row).eq('id', p.id); if (error) throw error; }
      else { const { error } = await supabase.from('es_warehouses').insert(row); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_warehouses'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('es_warehouses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_warehouses'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Warehouse className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Lager</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Nytt lager</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? 'Redigera' : 'Nytt lager'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1"><Label>Namn *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_external} onCheckedChange={(v) => setForm({ ...form, is_external: v })} /><Label>Externt (leverantörslager / dropship)</Label></div>
                {form.is_external && (
                  <div className="space-y-1"><Label>Leverantör</Label>
                    <Select value={form.supplier_id || ''} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj leverantör" /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Aktiv</Label></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button onClick={() => save.mutate(form)} disabled={!form.name || save.isPending}>Spara</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Alla lager</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga lager ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Namn</TableHead><TableHead>Typ</TableHead><TableHead>Leverantör</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.is_external ? 'Externt' : 'Internt'}</TableCell>
                      <TableCell className="text-muted-foreground">{r.es_suppliers?.name || '–'}</TableCell>
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
    </BackofficeLayout>
  );
}