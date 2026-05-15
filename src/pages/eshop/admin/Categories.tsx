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
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

const empty = { id: '', name: '', slug: '', sort_order: 0, is_active: true };

function slugify(s: string) {
  return s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export default function EshopCategories() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_categories', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('es_categories').select('*').eq('organization_id', selectedOrgId!).order('sort_order').order('name');
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
        slug: p.slug || slugify(p.name),
        sort_order: Number(p.sort_order) || 0,
        is_active: p.is_active,
      };
      if (p.id) {
        const { error } = await supabase.from('es_categories').update(row).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('es_categories').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_categories'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('es_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_categories'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Tag className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Kategorier</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny kategori</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? 'Redigera' : 'Ny kategori'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1"><Label>Namn *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: slugify(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Sortering</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: e.target.value })} /></div>
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
          <CardHeader><CardTitle>Alla kategorier</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga kategorier ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Namn</TableHead><TableHead>Slug</TableHead><TableHead>Sort</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.slug}</TableCell>
                      <TableCell>{r.sort_order}</TableCell>
                      <TableCell>{r.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setForm(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
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