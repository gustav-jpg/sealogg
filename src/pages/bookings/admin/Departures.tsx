import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Pencil, Trash2 } from 'lucide-react';

const STATUSES = ['scheduled', 'open', 'closed', 'cancelled'] as const;

export default function BookingsDepartures() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const [edit, setEdit] = useState<any | null>(null);

  const { data: vessels = [] } = useQuery({
    queryKey: ['vessels_for_dep', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('id,name,capacity').eq('organization_id', selectedOrgId!).order('name');
      if (error) throw error; return data;
    },
  });

  const { data: deps = [], isLoading } = useQuery({
    queryKey: ['bk_departures', selectedOrgId, from, to],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_departures')
        .select('*, bk_routes(name, bk_lines(name,code)), vessels(name,capacity)')
        .eq('organization_id', selectedOrgId!)
        .gte('departure_at', new Date(from).toISOString())
        .lte('departure_at', new Date(to + 'T23:59:59').toISOString())
        .order('departure_at');
      if (error) throw error; return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      const row = {
        vessel_id: p.vessel_id || null,
        capacity_override: p.capacity_override === '' ? null : Number(p.capacity_override),
        status: p.status, notes: p.notes || null,
      };
      const { error } = await supabase.from('bk_departures').update(row).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_departures'] }); setEdit(null); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('bk_departures').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_departures'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Avgångar</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label>Från</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Till</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{deps.length} avgångar</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p>Laddar...</p> : deps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga avgångar i perioden. Generera från Tidtabeller.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tid</TableHead>
                    <TableHead>Linje</TableHead>
                    <TableHead>Rutt</TableHead>
                    <TableHead>Fartyg</TableHead>
                    <TableHead>Kapacitet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deps.map((d: any) => {
                    const cap = d.capacity_override ?? d.vessels?.capacity ?? 0;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-sm">
                          {new Date(d.departure_at).toLocaleString('sv-SE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>{d.bk_routes?.bk_lines?.code}</TableCell>
                        <TableCell>{d.bk_routes?.name}</TableCell>
                        <TableCell>{d.vessels?.name || '–'}</TableCell>
                        <TableCell>{cap}</TableCell>
                        <TableCell><Badge variant={d.status === 'open' ? 'secondary' : d.status === 'cancelled' ? 'destructive' : 'outline'}>{d.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEdit({ ...d, capacity_override: d.capacity_override ?? '', notes: d.notes ?? '', vessel_id: d.vessel_id ?? '' })}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm('Ta bort avgången?')) del.mutate(d.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!edit} onOpenChange={(o) => { if (!o) setEdit(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Redigera avgång</DialogTitle></DialogHeader>
            {edit && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{new Date(edit.departure_at).toLocaleString('sv-SE')} · {edit.bk_routes?.name}</p>
                <div className="space-y-1">
                  <Label>Fartyg</Label>
                  <Select value={edit.vessel_id || 'none'} onValueChange={v => setEdit({ ...edit, vessel_id: v === 'none' ? '' : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Inget valt</SelectItem>
                      {vessels.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name} ({v.capacity || 0} pl)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Kapacitet (override)</Label>
                  <Input type="number" value={edit.capacity_override} onChange={e => setEdit({ ...edit, capacity_override: e.target.value })} placeholder="lämna tomt för fartygets kapacitet" />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={edit.status} onValueChange={v => setEdit({ ...edit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Anteckning</Label>
                  <Input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEdit(null)}>Avbryt</Button>
              <Button onClick={() => save.mutate(edit)} disabled={save.isPending}>Spara</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}