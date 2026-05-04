import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, MapPin, Edit } from 'lucide-react';

type Stop = { name: string; arrival_offset_minutes?: number };

export default function BookingRoutesAdmin() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [stops, setStops] = useState<Stop[]>([{ name: '' }, { name: '' }]);

  const { data: routes } = useQuery({
    queryKey: ['booking-routes', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('booking_routes').select('*').eq('organization_id', selectedOrgId!).order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const reset = () => {
    setEditing(null);
    setName(''); setDescription(''); setDuration(''); setIsPublic(true); setIsActive(true);
    setStops([{ name: '' }, { name: '' }]);
  };

  const openEdit = (r: any) => {
    setEditing(r); setName(r.name); setDescription(r.description || '');
    setDuration(r.duration_minutes?.toString() || ''); setIsPublic(r.is_public); setIsActive(r.is_active);
    setStops(Array.isArray(r.stops) && r.stops.length ? r.stops : [{ name: '' }, { name: '' }]);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen org');
      const cleanStops = stops.filter(s => s.name.trim());
      if (cleanStops.length < 2) throw new Error('Minst 2 stopp krävs');
      const payload = {
        organization_id: selectedOrgId,
        name, description: description || null,
        duration_minutes: duration ? Number(duration) : null,
        is_public: isPublic, is_active: isActive,
        stops: cleanStops as any,
      };
      if (editing) {
        const { error } = await supabase.from('booking_routes').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('booking_routes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-routes'] }); setOpen(false); reset(); toast({ title: 'Sparat' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('booking_routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['booking-routes'] }); toast({ title: 'Raderad' }); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6" />Bokningsrutter</h1>
            <p className="text-muted-foreground">Definiera rutter med stopp</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button onClick={reset}><Plus className="h-4 w-4 mr-2" />Ny rutt</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? 'Redigera' : 'Ny'} rutt</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Namn *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Stockholm – Vaxholm" /></div>
                <div><Label>Beskrivning</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div><Label>Total restid (minuter)</Label><Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
                <div>
                  <Label>Stopp (i ordning) *</Label>
                  <div className="space-y-2 mt-1">
                    {stops.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <Input className="flex-1" placeholder={`Stopp ${i + 1}`} value={s.name} onChange={(e) => { const c = [...stops]; c[i].name = e.target.value; setStops(c); }} />
                        <Input type="number" className="w-32" placeholder="Min från start" value={s.arrival_offset_minutes ?? ''} onChange={(e) => { const c = [...stops]; c[i].arrival_offset_minutes = e.target.value ? Number(e.target.value) : undefined; setStops(c); }} />
                        <Button type="button" variant="ghost" size="icon" onClick={() => setStops(stops.filter((_, j) => j !== i))} disabled={stops.length <= 2}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setStops([...stops, { name: '' }])}><Plus className="h-4 w-4 mr-2" />Lägg till stopp</Button>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2"><Switch checked={isPublic} onCheckedChange={setIsPublic} /><Label>Publik</Label></div>
                  <div className="flex items-center gap-2"><Switch checked={isActive} onCheckedChange={setIsActive} /><Label>Aktiv</Label></div>
                </div>
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">Spara</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-3">
          {routes?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga rutter än</CardContent></Card>}
          {routes?.map((r: any) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">{r.name}
                      {!r.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                      {!r.is_public && <Badge variant="outline">Intern</Badge>}
                    </CardTitle>
                    {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Radera "${r.name}"?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">Stopp: {(r.stops as any[])?.map(s => s.name).join(' → ')}</div>
                {r.duration_minutes && <div className="text-sm text-muted-foreground">Restid: {r.duration_minutes} min</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}