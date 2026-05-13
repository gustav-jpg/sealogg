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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarClock, Wand2 } from 'lucide-react';

const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

const empty = {
  id: '', name: '', route_id: '', vessel_id: '',
  weekday_mask: 127, start_date: new Date().toISOString().slice(0, 10), end_date: '',
  depart_time: '08:00', is_active: true,
};

function maskToBools(mask: number) { return DAYS.map((_, i) => (mask & (1 << i)) !== 0); }
function boolsToMask(bs: boolean[]) { return bs.reduce((m, v, i) => v ? m | (1 << i) : m, 0); }

export default function BookingsSchedules() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [genDays, setGenDays] = useState(30);
  const [genId, setGenId] = useState<string | null>(null);

  const { data: routes = [] } = useQuery({
    queryKey: ['bk_routes_all', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_routes')
        .select('id,name,line_id, bk_lines(name,code), bk_route_stops(id,stop_order,arrival_offset_min,departure_offset_min)')
        .eq('organization_id', selectedOrgId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vessels = [] } = useQuery({
    queryKey: ['vessels_for_bookings', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessels')
        .select('id,name,capacity')
        .eq('organization_id', selectedOrgId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['bk_schedules', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_schedules')
        .select('*, bk_routes(name, bk_lines(name,code)), vessels(name)')
        .eq('organization_id', selectedOrgId!)
        .order('depart_time');
      if (error) throw error;
      return data as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: any) => {
      if (!selectedOrgId) throw new Error('No org');
      const row = {
        organization_id: selectedOrgId,
        route_id: p.route_id, vessel_id: p.vessel_id || null, name: p.name,
        weekday_mask: Number(p.weekday_mask),
        start_date: p.start_date, end_date: p.end_date || null,
        depart_time: p.depart_time, is_active: p.is_active,
      };
      if (p.id) {
        const { error } = await supabase.from('bk_schedules').update(row).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bk_schedules').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_schedules'] }); setOpen(false); setForm(empty); toast.success('Sparat'); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('bk_schedules').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_schedules'] }); toast.success('Borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async (scheduleId: string) => {
      const sch = schedules.find((s: any) => s.id === scheduleId);
      if (!sch) throw new Error('Schema saknas');
      const route = routes.find(r => r.id === sch.route_id);
      if (!route) throw new Error('Rutt saknas');
      const stops = (route.bk_route_stops || []).slice().sort((a: any, b: any) => a.stop_order - b.stop_order);
      if (!stops.length) throw new Error('Rutten saknar stopp');

      const start = new Date(sch.start_date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const baseDate = start > today ? start : today;
      const endDate = sch.end_date ? new Date(sch.end_date) : null;
      const days: Date[] = [];
      for (let i = 0; i < genDays; i++) {
        const d = new Date(baseDate); d.setDate(baseDate.getDate() + i);
        if (endDate && d > endDate) break;
        // JS getDay: 0=Sun..6=Sat. We use mask Mon=bit0..Sun=bit6
        const dow = (d.getDay() + 6) % 7;
        if ((sch.weekday_mask & (1 << dow)) === 0) continue;
        days.push(d);
      }
      // For each day, create a departure at start_time + insert stop times
      const [hh, mm] = sch.depart_time.split(':').map(Number);
      let created = 0, skipped = 0;
      for (const d of days) {
        const depAt = new Date(d); depAt.setHours(hh, mm, 0, 0);
        // Skip if already exists (route_id + departure_at)
        const { data: existing } = await supabase.from('bk_departures')
          .select('id').eq('route_id', sch.route_id).eq('departure_at', depAt.toISOString()).maybeSingle();
        if (existing) { skipped++; continue; }
        const { data: dep, error: depErr } = await supabase.from('bk_departures').insert({
          organization_id: selectedOrgId!, route_id: sch.route_id, schedule_id: sch.id,
          vessel_id: sch.vessel_id, departure_at: depAt.toISOString(), status: 'open',
        }).select('id').single();
        if (depErr) throw depErr;
        const stRows = stops.map((s: any) => {
          const arr = new Date(depAt); arr.setMinutes(arr.getMinutes() + (s.arrival_offset_min || 0));
          const dpt = new Date(depAt); dpt.setMinutes(dpt.getMinutes() + (s.departure_offset_min || s.arrival_offset_min || 0));
          return {
            departure_id: dep.id, route_stop_id: s.id, stop_order: s.stop_order,
            arrive_at: arr.toISOString(), depart_at: dpt.toISOString(),
          };
        });
        const { error: stErr } = await supabase.from('bk_departure_stop_times').insert(stRows);
        if (stErr) throw stErr;
        created++;
      }
      return { created, skipped };
    },
    onSuccess: ({ created, skipped }) => {
      qc.invalidateQueries({ queryKey: ['bk_departures'] });
      toast.success(`${created} avgångar skapade. ${skipped} hoppades över (fanns redan).`);
      setGenId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Tidtabeller</h1>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setForm(empty)}><Plus className="h-4 w-4 mr-1" /> Nytt schema</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{form.id ? 'Redigera schema' : 'Nytt schema'}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Namn *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sommar 2026 – Stavsnäs 08:00" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Rutt *</Label>
                    <Select value={form.route_id} onValueChange={v => setForm({ ...form, route_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Välj rutt" /></SelectTrigger>
                      <SelectContent>
                        {routes.map(r => (
                          <SelectItem key={r.id} value={r.id}>
                            {(r.bk_lines?.code ? r.bk_lines.code + ' · ' : '')}{r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fartyg</Label>
                    <Select value={form.vessel_id || 'none'} onValueChange={v => setForm({ ...form, vessel_id: v === 'none' ? '' : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Inget valt</SelectItem>
                        {vessels.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name} ({v.capacity || 0} pl)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>Avgångstid *</Label>
                    <Input type="time" value={form.depart_time} onChange={e => setForm({ ...form, depart_time: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Från *</Label>
                    <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Till</Label>
                    <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="block mb-2">Veckodagar</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((d, i) => {
                      const bools = maskToBools(form.weekday_mask);
                      return (
                        <label key={d} className="flex items-center gap-1 text-sm">
                          <Checkbox checked={bools[i]} onCheckedChange={(v) => {
                            const nb = [...bools]; nb[i] = !!v;
                            setForm({ ...form, weekday_mask: boolsToMask(nb) });
                          }} /> {d}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Aktiv</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Avbryt</Button>
                <Button onClick={() => save.mutate(form)} disabled={!form.name || !form.route_id || save.isPending}>Spara</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Alla scheman</CardTitle></CardHeader>
          <CardContent>
            {schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga scheman ännu.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>Rutt</TableHead>
                    <TableHead>Tid</TableHead>
                    <TableHead>Dagar</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Fartyg</TableHead>
                    <TableHead className="text-right">Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s: any) => {
                    const bools = maskToBools(s.weekday_mask);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.bk_routes?.bk_lines?.code} · {s.bk_routes?.name}</TableCell>
                        <TableCell>{s.depart_time?.slice(0, 5)}</TableCell>
                        <TableCell className="text-xs">{DAYS.filter((_, i) => bools[i]).join(' ')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.start_date} {s.end_date ? `→ ${s.end_date}` : ''}</TableCell>
                        <TableCell>{s.vessels?.name || '–'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setGenId(s.id)} className="mr-1">
                            <Wand2 className="h-3 w-3 mr-1" /> Generera
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { setForm({ ...s, vessel_id: s.vessel_id ?? '', end_date: s.end_date ?? '' }); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm('Ta bort schemat?')) del.mutate(s.id); }}>
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

        <Dialog open={!!genId} onOpenChange={(o) => { if (!o) setGenId(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Generera avgångar</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Skapar avgångar enligt schemat. Befintliga avgångar för samma rutt och tid hoppas över.</p>
              <div className="space-y-1">
                <Label>Antal dagar framåt</Label>
                <Input type="number" min={1} max={365} value={genDays} onChange={e => setGenDays(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setGenId(null)}>Avbryt</Button>
              <Button onClick={() => genId && generate.mutate(genId)} disabled={generate.isPending}>
                {generate.isPending ? 'Genererar...' : 'Generera'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}