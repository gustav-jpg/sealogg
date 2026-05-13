import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Coins } from 'lucide-react';

const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
function maskToBools(m: number) { return DAYS.map((_, i) => (m & (1 << i)) !== 0); }
function boolsToMask(b: boolean[]) { return b.reduce((m, v, i) => v ? m | (1 << i) : m, 0); }

const empty = { id: '', line_id: '', route_id: '', from_pier_id: '', to_pier_id: '', ticket_type_id: '', weekday_mask: 127, valid_from: '', valid_to: '', price_sek: 0, return_discount_pct: 0, priority: 100 };

export default function BookingsFares() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: lines = [] } = useQuery({ queryKey: ['bk_lines_min', selectedOrgId], enabled: !!selectedOrgId, queryFn: async () => {
    const { data } = await supabase.from('bk_lines').select('id,name,code').eq('organization_id', selectedOrgId!).order('name'); return data || [];
  }});
  const { data: piers = [] } = useQuery({ queryKey: ['bk_piers_min', selectedOrgId], enabled: !!selectedOrgId, queryFn: async () => {
    const { data } = await supabase.from('bk_piers').select('id,name').eq('organization_id', selectedOrgId!).eq('is_active', true).order('name'); return data || [];
  }});
  const { data: types = [] } = useQuery({ queryKey: ['bk_tt_min', selectedOrgId], enabled: !!selectedOrgId, queryFn: async () => {
    const { data } = await supabase.from('bk_ticket_types').select('id,name').eq('organization_id', selectedOrgId!).eq('is_active', true).order('sort_order'); return data || [];
  }});
  const { data: rules = [] } = useQuery({
    queryKey: ['bk_fare_rules', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_fare_rules')
        .select('*, bk_lines(name,code), bk_routes(name), from_pier:from_pier_id(name), to_pier:to_pier_id(name), bk_ticket_types(name)')
        .eq('organization_id', selectedOrgId!)
        .order('priority');
      if (error) throw error; return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('No org');
      const row = {
        organization_id: selectedOrgId,
        line_id: p.line_id || null, route_id: p.route_id || null,
        from_pier_id: p.from_pier_id || null, to_pier_id: p.to_pier_id || null,
        ticket_type_id: p.ticket_type_id, weekday_mask: Number(p.weekday_mask),
        valid_from: p.valid_from || null, valid_to: p.valid_to || null,
        price_sek: Number(p.price_sek), return_discount_pct: Number(p.return_discount_pct), priority: Number(p.priority) || 100,
      };
      if (p.id) { const { error } = await supabase.from('bk_fare_rules').update(row).eq('id', p.id); if (error) throw error; }
      else { const { error } = await supabase.from('bk_fare_rules').insert(row); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_fare_rules'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('bk_fare_rules').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_fare_rules'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Coins className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Priser</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny prisregel</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{form.id ? 'Redigera prisregel' : 'Ny prisregel'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Biljettyp *</Label>
                    <Select value={form.ticket_type_id} onValueChange={v => setForm({ ...form, ticket_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj" /></SelectTrigger>
                      <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Pris (SEK) *</Label>
                    <Input type="number" step="0.01" value={form.price_sek} onChange={e => setForm({ ...form, price_sek: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Linje (valfri)</Label>
                    <Select value={form.line_id || 'all'} onValueChange={v => setForm({ ...form, line_id: v === 'all' ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla linjer</SelectItem>
                        {lines.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.code} · {l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Prioritet</Label>
                    <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Från brygga</Label>
                    <Select value={form.from_pier_id || 'all'} onValueChange={v => setForm({ ...form, from_pier_id: v === 'all' ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla</SelectItem>
                        {piers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Till brygga</Label>
                    <Select value={form.to_pier_id || 'all'} onValueChange={v => setForm({ ...form, to_pier_id: v === 'all' ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla</SelectItem>
                        {piers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="block mb-2">Veckodagar</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d, i) => {
                      const bools = maskToBools(form.weekday_mask);
                      return <label key={d} className="flex items-center gap-1 text-sm">
                        <Checkbox checked={bools[i]} onCheckedChange={(v) => { const nb = [...bools]; nb[i] = !!v; setForm({ ...form, weekday_mask: boolsToMask(nb) }); }} /> {d}
                      </label>;
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Giltig från</Label>
                    <Input type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Giltig till</Label>
                    <Input type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>TR-rabatt %</Label>
                    <Input type="number" step="0.01" value={form.return_discount_pct} onChange={e => setForm({ ...form, return_discount_pct: e.target.value })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button onClick={() => save.mutate(form)} disabled={!form.ticket_type_id || !form.price_sek || save.isPending}>Spara</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Prisregler</CardTitle></CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga prisregler. Lägsta prio (lägst nummer) väljs när flera matchar.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prio</TableHead>
                    <TableHead>Biljettyp</TableHead>
                    <TableHead>Linje</TableHead>
                    <TableHead>Sträcka</TableHead>
                    <TableHead>Pris</TableHead>
                    <TableHead>TR%</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell>{r.bk_ticket_types?.name}</TableCell>
                      <TableCell className="text-xs">{r.bk_lines?.code || 'Alla'}</TableCell>
                      <TableCell className="text-xs">{(r.from_pier?.name || 'Alla')} → {(r.to_pier?.name || 'Alla')}</TableCell>
                      <TableCell className="font-mono">{Number(r.price_sek).toFixed(2)} kr</TableCell>
                      <TableCell>{Number(r.return_discount_pct)}%</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...r, line_id: r.line_id ?? '', route_id: r.route_id ?? '', from_pier_id: r.from_pier_id ?? '', to_pier_id: r.to_pier_id ?? '', valid_from: r.valid_from ?? '', valid_to: r.valid_to ?? '' }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm('Ta bort?')) del.mutate(r.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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