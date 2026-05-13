import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, ArrowLeft, Save, Pencil } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Pier = { id: string; name: string; short_name: string | null };
type StopRow = {
  id?: string;
  _localId: string;
  pier_id: string;
  stop_order: number;
  boarding_allowed: boolean;
  alighting_allowed: boolean;
  arrival_offset_min: number;
  departure_offset_min: number;
  dwell_min: number;
};

const newStop = (pier_id = '', order = 0): StopRow => ({
  _localId: crypto.randomUUID(),
  pier_id, stop_order: order,
  boarding_allowed: true, alighting_allowed: true,
  arrival_offset_min: 0, departure_offset_min: 0, dwell_min: 0,
});

function SortableStop({ stop, piers, onChange, onRemove }: {
  stop: StopRow; piers: Pier[];
  onChange: (s: StopRow) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop._localId });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const stopType = !stop.boarding_allowed && !stop.alighting_allowed
    ? 'technical'
    : stop.boarding_allowed && !stop.alighting_allowed
      ? 'boarding_only'
      : !stop.boarding_allowed && stop.alighting_allowed
        ? 'alighting_only'
        : 'both';

  const setType = (t: string) => {
    if (t === 'technical') onChange({ ...stop, boarding_allowed: false, alighting_allowed: false });
    else if (t === 'boarding_only') onChange({ ...stop, boarding_allowed: true, alighting_allowed: false });
    else if (t === 'alighting_only') onChange({ ...stop, boarding_allowed: false, alighting_allowed: true });
    else onChange({ ...stop, boarding_allowed: true, alighting_allowed: true });
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-3 border rounded-md bg-card">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-2 text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
        <div className="md:col-span-4">
          <Select value={stop.pier_id} onValueChange={v => onChange({ ...stop, pier_id: v })}>
            <SelectTrigger><SelectValue placeholder="Välj brygga" /></SelectTrigger>
            <SelectContent>
              {piers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3">
          <Select value={stopType} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">På- och avstigning</SelectItem>
              <SelectItem value="boarding_only">Endast påstigning</SelectItem>
              <SelectItem value="alighting_only">Endast avstigning</SelectItem>
              <SelectItem value="technical">Tekniskt stopp</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Input type="number" placeholder="Ank +min" value={stop.arrival_offset_min}
            onChange={e => onChange({ ...stop, arrival_offset_min: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-2">
          <Input type="number" placeholder="Avg +min" value={stop.departure_offset_min}
            onChange={e => onChange({ ...stop, departure_offset_min: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-1 flex justify-end">
          <Button size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export default function BookingsRoutes() {
  const { lineId } = useParams<{ lineId: string }>();
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ routeId: string | null; name: string; direction: string; is_active: boolean; stops: StopRow[] } | null>(null);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: line } = useQuery({
    queryKey: ['bk_line', lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data, error } = await supabase.from('bk_lines').select('*').eq('id', lineId!).maybeSingle();
      if (error) throw error; return data;
    },
  });

  const { data: piers = [] } = useQuery({
    queryKey: ['bk_piers_select', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase.from('bk_piers').select('id,name,short_name').eq('organization_id', selectedOrgId!).eq('is_active', true).order('name');
      if (error) throw error; return data as Pier[];
    },
  });

  const { data: routes = [] } = useQuery({
    queryKey: ['bk_routes', lineId],
    enabled: !!lineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bk_routes')
        .select('*, bk_route_stops(*)')
        .eq('line_id', lineId!)
        .order('name');
      if (error) throw error; return data as any[];
    },
  });

  const startNewRoute = () => {
    setEditing({ routeId: null, name: '', direction: '', is_active: true, stops: [] });
    setRouteDialogOpen(true);
  };
  const startEdit = (r: any) => {
    const stops = (r.bk_route_stops || [])
      .slice()
      .sort((a: any, b: any) => a.stop_order - b.stop_order)
      .map((s: any) => ({ ...s, _localId: s.id }));
    setEditing({ routeId: r.id, name: r.name, direction: r.direction || '', is_active: r.is_active, stops });
    setRouteDialogOpen(true);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!editing || !e.over || e.active.id === e.over.id) return;
    const oldIdx = editing.stops.findIndex(s => s._localId === e.active.id);
    const newIdx = editing.stops.findIndex(s => s._localId === e.over!.id);
    setEditing({ ...editing, stops: arrayMove(editing.stops, oldIdx, newIdx) });
  };

  const validation = useMemo(() => {
    if (!editing) return null;
    if (editing.stops.length < 2) return 'Rutten måste ha minst 2 stopp.';
    if (editing.stops.some(s => !s.pier_id)) return 'Alla stopp måste ha en brygga.';
    const pierIds = editing.stops.map(s => s.pier_id);
    if (new Set(pierIds).size !== pierIds.length) return 'Samma brygga kan inte förekomma flera gånger.';
    if (!editing.stops.some(s => s.boarding_allowed)) return 'Minst ett stopp måste tillåta påstigning.';
    if (!editing.stops.some(s => s.alighting_allowed)) return 'Minst ett stopp måste tillåta avstigning.';
    return null;
  }, [editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing || !lineId || !selectedOrgId) throw new Error('Saknar data');
      let routeId = editing.routeId;
      if (routeId) {
        const { error } = await supabase.from('bk_routes').update({
          name: editing.name, direction: editing.direction || null, is_active: editing.is_active,
        }).eq('id', routeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('bk_routes').insert({
          organization_id: selectedOrgId, line_id: lineId,
          name: editing.name, direction: editing.direction || null, is_active: editing.is_active,
        }).select('id').single();
        if (error) throw error;
        routeId = data.id;
      }
      // Replace stops: delete then insert (simple + safe at this scale)
      const { error: delErr } = await supabase.from('bk_route_stops').delete().eq('route_id', routeId);
      if (delErr) throw delErr;
      const rows = editing.stops.map((s, i) => ({
        route_id: routeId!,
        pier_id: s.pier_id,
        stop_order: i,
        boarding_allowed: s.boarding_allowed,
        alighting_allowed: s.alighting_allowed,
        arrival_offset_min: s.arrival_offset_min,
        departure_offset_min: s.departure_offset_min,
        dwell_min: s.dwell_min,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from('bk_route_stops').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bk_routes', lineId] });
      setRouteDialogOpen(false);
      setEditing(null);
      toast.success('Rutten sparad');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bk_routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bk_routes', lineId] }); toast.success('Rutten borttagen'); },
    onError: (e: any) => toast.error(e.message),
  });

  const pierName = (id: string) => piers.find(p => p.id === id)?.name || '–';

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/portal/bookings/admin/lines"><ArrowLeft className="h-4 w-4 mr-1" /> Linjer</Link>
          </Button>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Rutter</h1>
            <p className="text-sm text-muted-foreground">Linje: <span className="font-medium">{line?.name || '...'}</span></p>
          </div>
          <Button onClick={startNewRoute}><Plus className="h-4 w-4 mr-1" /> Ny rutt</Button>
        </div>

        {routes.length === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Inga rutter på den här linjen ännu.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {routes.map((r: any) => (
              <Card key={r.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{r.name} {r.direction && <Badge variant="outline" className="ml-2">{r.direction}</Badge>}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(r.bk_route_stops || []).slice().sort((a: any, b: any) => a.stop_order - b.stop_order).map((s: any) => pierName(s.pier_id)).join('  →  ') || 'Inga stopp'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Ta bort rutten "${r.name}"?`)) del.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={routeDialogOpen} onOpenChange={(o) => { setRouteDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.routeId ? 'Redigera rutt' : 'Ny rutt'}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1 md:col-span-2">
                    <Label>Namn *</Label>
                    <Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Stavsnäs → Sandhamn" />
                  </div>
                  <div className="space-y-1">
                    <Label>Riktning</Label>
                    <Input value={editing.direction} onChange={e => setEditing({ ...editing, direction: e.target.value })} placeholder="Utgående" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Aktiv</Label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Stopp i ordning</Label>
                    <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, stops: [...editing.stops, newStop('', editing.stops.length)] })}>
                      <Plus className="h-4 w-4 mr-1" /> Lägg till stopp
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Dra för att ändra ordning. "Ank +min" och "Avg +min" är minuter från avgångstid.</p>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={editing.stops.map(s => s._localId)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {editing.stops.map((s) => (
                          <SortableStop key={s._localId} stop={s} piers={piers}
                            onChange={(ns) => setEditing({ ...editing, stops: editing.stops.map(x => x._localId === ns._localId ? ns : x) })}
                            onRemove={() => setEditing({ ...editing, stops: editing.stops.filter(x => x._localId !== s._localId) })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>

                {validation && <p className="text-sm text-destructive">{validation}</p>}
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRouteDialogOpen(false)}>Avbryt</Button>
              <Button onClick={() => save.mutate()} disabled={!editing?.name || !!validation || save.isPending}>
                <Save className="h-4 w-4 mr-1" /> Spara rutt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}