import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';

const empty = { id: '', code: '', name: '', description: '', sort_order: 0, occupies_seat: true, is_active: true };
const PRESETS = [
  { code: 'adult', name: 'Vuxen', occupies_seat: true },
  { code: 'child', name: 'Barn', occupies_seat: true },
  { code: 'senior', name: 'Pensionär', occupies_seat: true },
  { code: 'bike', name: 'Cykel', occupies_seat: false },
  { code: 'dog', name: 'Hund', occupies_seat: false },
];

export default function BookingsTicketTypes() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['bk_ticket_types', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_ticket_types')
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
        code: p.code,
        name: p.name,
        description: p.description || null,
        sort_order: Number(p.sort_order) || 0,
        occupies_seat: p.occupies_seat,
        is_active: p.is_active,
      };
      if (p.id) {
        const { error } = await supabase.from('bk_ticket_types').update(row).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bk_ticket_types').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_ticket_types'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('bk_ticket_types').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_ticket_types'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  const seedPresets = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No org');
      const rows = PRESETS.map((p, i) => ({
        organization_id: selectedOrgId,
        code: p.code,
        name: p.name,
        sort_order: i,
        occupies_seat: p.occupies_seat,
        is_active: true,
      }));
      const { error } = await supabase.from('bk_ticket_types').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_ticket_types'] }); toast.success('Standard biljettyper skapade'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Ticket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Biljettyper</h1>
          </div>
          <div className="flex gap-2">
            {types.length === 0 && (
              <Button variant="outline" onClick={() => seedPresets.mutate()} disabled={seedPresets.isPending}>
                Skapa standardtyper
              </Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny biljettyp</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{form.id ? 'Redigera biljettyp' : 'Ny biljettyp'}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Kod *</Label>
                      <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="adult" />
                    </div>
                    <div className="space-y-1">
                      <Label>Namn *</Label>
                      <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Vuxen" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Beskrivning</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Sortering</Label>
                    <Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.occupies_seat} onCheckedChange={(v) => setForm({ ...form, occupies_seat: v })} />
                    <Label>Upptar plats (drar från kapacitet)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <Label>Aktiv</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                  <Button onClick={() => save.mutate(form)} disabled={!form.name || !form.code || save.isPending}>Spara</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Alla biljettyper</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : types.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga biljettyper ännu. Klicka "Skapa standardtyper" för att börja snabbt.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kod</TableHead>
                    <TableHead>Namn</TableHead>
                    <TableHead>Beskrivning</TableHead>
                    <TableHead>Plats</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono">{t.code}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{t.description || '–'}</TableCell>
                      <TableCell>{t.occupies_seat ? <Badge variant="secondary">Plats</Badge> : <Badge variant="outline">Ingen plats</Badge>}</TableCell>
                      <TableCell>{t.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...t, description: t.description ?? '' }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Ta bort "${t.name}"?`)) del.mutate(t.id); }}>
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