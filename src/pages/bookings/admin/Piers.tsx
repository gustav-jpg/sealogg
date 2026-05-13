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
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { PierMapPicker } from '@/components/bookings/PierMapPicker';

type Pier = {
  id: string;
  name: string;
  short_name: string | null;
  lat: number | null;
  lng: number | null;
  info: string | null;
  is_active: boolean;
};

const empty = { id: '', name: '', short_name: '', lat: '' as any, lng: '' as any, info: '', is_active: true };

export default function BookingsPiers() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const { data: piers = [], isLoading } = useQuery({
    queryKey: ['bk_piers', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_piers')
        .select('*')
        .eq('organization_id', selectedOrgId!)
        .order('name');
      if (error) throw error;
      return data as Pier[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: any) => {
      if (!selectedOrgId) throw new Error('No org');
      const row = {
        organization_id: selectedOrgId,
        name: payload.name,
        short_name: payload.short_name || null,
        lat: payload.lat === '' ? null : Number(payload.lat),
        lng: payload.lng === '' ? null : Number(payload.lng),
        info: payload.info || null,
        is_active: payload.is_active,
      };
      if (payload.id) {
        const { error } = await supabase.from('bk_piers').update(row).eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bk_piers').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bk_piers'] });
      setOpen(false);
      setForm(empty);
      toast.success('Sparat');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bk_piers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bk_piers'] });
      toast.success('Borttagen');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Bryggor</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Ny brygga</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{form.id ? 'Redigera brygga' : 'Ny brygga'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Namn *</Label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Kortnamn</Label>
                    <Input value={form.short_name} onChange={e => setForm({ ...form, short_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Latitud</Label>
                    <Input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} placeholder="59.3293" />
                  </div>
                  <div className="space-y-1">
                    <Label>Longitud</Label>
                    <Input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} placeholder="18.0686" />
                  </div>
                </div>
                <PierMapPicker
                  lat={form.lat ? Number(form.lat) : null}
                  lng={form.lng ? Number(form.lng) : null}
                  onChange={(lat, lng) => setForm({ ...form, lat: lat.toFixed(6), lng: lng.toFixed(6) })}
                />
                <div className="space-y-1">
                  <Label>Info</Label>
                  <Textarea value={form.info} onChange={e => setForm({ ...form, info: e.target.value })} rows={2} />
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
          <CardHeader><CardTitle>Alla bryggor</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : piers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga bryggor ännu. Klicka "Ny brygga" för att skapa.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Kortnamn</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {piers.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.short_name || '–'}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {p.lat && p.lng ? `${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}` : '–'}
                      </TableCell>
                      <TableCell>{p.is_active ? 'Aktiv' : 'Inaktiv'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setForm({ ...p, lat: p.lat ?? '', lng: p.lng ?? '', short_name: p.short_name ?? '', info: p.info ?? '' }); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Ta bort "${p.name}"?`)) del.mutate(p.id); }}>
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