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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const empty = { id: '', code: '', name: '', description: '', color: '#0A84FF', is_active: true, sort_order: 0 };

export default function BookingsLines() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['bk_lines', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_lines')
        .select('*')
        .eq('organization_id', selectedOrgId!)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('No org');
      const row = {
        organization_id: selectedOrgId,
        code: p.code || null,
        name: p.name,
        description: p.description || null,
        color: p.color || '#0A84FF',
        is_active: p.is_active,
        sort_order: Number(p.sort_order) || 0,
      };
      if (p.id) {
        const { error } = await supabase.from('bk_lines').update(row).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bk_lines').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_lines'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('bk_lines').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_lines'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <RouteIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Linjer</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny linje</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? 'Redigera linje' : 'Ny linje'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-1">
                    <Label>Kod</Label>
                    <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="L4" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label>Namn *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Linje 4 – Möja" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Beskrivning</Label>
                  <Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Färg</Label>
                    <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Sortering</Label>
                    <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Aktiv</Label>
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
          <CardHeader><CardTitle>Alla linjer</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga linjer ännu.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Kod</TableHead>
                    <TableHead>Namn</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-48 text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell><div className="h-6 w-6 rounded" style={{ backgroundColor: l.color }} /></TableCell>
                      <TableCell className="font-mono">{l.code || '–'}</TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.is_active ? <Badge variant="secondary">Aktiv</Badge> : <Badge variant="outline">Inaktiv</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/portal/bookings/admin/lines/${l.id}/routes`}>Rutter</Link>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...l, code: l.code ?? '', description: l.description ?? '' }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Ta bort linjen "${l.name}"?`)) del.mutate(l.id); }}>
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