import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Calendar } from 'lucide-react';

const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

export default function SchedulesAdmin() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [routeId, setRouteId] = useState('');
  const [vesselId, setVesselId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [maxPax, setMaxPax] = useState('12');
  const [isActive, setIsActive] = useState(true);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes-list', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_routes').select('id, name').eq('organization_id', selectedOrgId!).eq('is_active', true)).data || [],
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', selectedOrgId!)).data || [],
  });
  const { data: schedules } = useQuery({
    queryKey: ['booking-schedules', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('booking_schedules').select('*, booking_routes(name), vessels(name)').eq('organization_id', selectedOrgId!).order('name')).data || [],
  });

  const reset = () => {
    setName(''); setRouteId(''); setVesselId(''); setWeekdays([]); setTimes(['08:00']);
    setValidFrom(new Date().toISOString().slice(0, 10)); setValidUntil(''); setMaxPax('12'); setIsActive(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen org');
      if (!name || !routeId || !vesselId || weekdays.length === 0 || times.length === 0) throw new Error('Fyll i alla fält');
      const { error } = await supabase.from('booking_schedules').insert({
        organization_id: selectedOrgId, name, route_id: routeId, vessel_id: vesselId,
        weekdays, departure_times: times,
        valid_from: validFrom, valid_until: validUntil || null,
        max_passengers: Number(maxPax), is_active: isActive,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-schedules'] }); setOpen(false); reset(); toast({ title: 'Tidtabell skapad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('booking_schedules').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-schedules'] }); toast({ title: 'Raderad' }); },
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" />Tidtabeller</h1>
            <p className="text-muted-foreground">Återkommande avgångar (genereras manuellt till Avgångar)</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="h-4 w-4 mr-2" />Ny tidtabell</Button></DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Ny tidtabell</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Sommarsäsong 2026" /></div>
                <div><Label>Rutt *</Label>
                  <Select value={routeId} onValueChange={setRouteId}><SelectTrigger><SelectValue placeholder="Välj rutt" /></SelectTrigger>
                    <SelectContent>{routes?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Fartyg *</Label>
                  <Select value={vesselId} onValueChange={setVesselId}><SelectTrigger><SelectValue placeholder="Välj fartyg" /></SelectTrigger>
                    <SelectContent>{vessels?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Veckodagar *</Label>
                  <div className="flex gap-1 mt-1">{WEEKDAYS.map((d, i) => {
                    const dayNum = i + 1;
                    const active = weekdays.includes(dayNum);
                    return <Button key={i} type="button" variant={active ? 'default' : 'outline'} size="sm" onClick={() => setWeekdays(active ? weekdays.filter(x => x !== dayNum) : [...weekdays, dayNum])}>{d}</Button>;
                  })}</div>
                </div>
                <div><Label>Avgångstider *</Label>
                  <div className="space-y-1">
                    {times.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <Input type="time" value={t} onChange={(e) => { const c = [...times]; c[i] = e.target.value; setTimes(c); }} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, j) => j !== i))} disabled={times.length === 1}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setTimes([...times, '12:00'])}><Plus className="h-4 w-4 mr-1" />Lägg till tid</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Giltig från *</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
                  <div><Label>Giltig till</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Max passagerare</Label><Input type="number" value={maxPax} onChange={(e) => setMaxPax(e.target.value)} /></div>
                  <div className="flex items-end gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Aktiv</Label></div>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">Spara</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {schedules?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga tidtabeller än</CardContent></Card>}
          {schedules?.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{s.name} {!s.is_active && <Badge variant="secondary">Inaktiv</Badge>}</div>
                  <div className="text-sm text-muted-foreground">{s.booking_routes?.name} • {s.vessels?.name}</div>
                  <div className="text-sm text-muted-foreground">Dagar: {s.weekdays?.map((w: number) => WEEKDAYS[w - 1]).join(', ')} • Tider: {s.departure_times?.join(', ')}</div>
                  <div className="text-xs text-muted-foreground">Giltig {s.valid_from} {s.valid_until ? `– ${s.valid_until}` : '(ingen slutdatum)'}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm('Radera tidtabell?')) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}