import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  CONTROL_TYPE_LABELS,
  ControlType,
} from '@/lib/types';
import { Plus, Edit, Trash2, Calendar, Gauge, ClipboardCheck } from 'lucide-react';

export default function ControlPoints() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingControlPoint, setEditingControlPoint] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ControlType>('calendar');
  const [intervalMonths, setIntervalMonths] = useState('12');
  const [intervalEngineHours, setIntervalEngineHours] = useState('250');
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [machineName, setMachineName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: controlPoints, isLoading } = useQuery({
    queryKey: ['control-points-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_points')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: controlPointVessels } = useQuery({
    queryKey: ['control-point-vessels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_point_vessels')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const createControlPoint = useMutation({
    mutationFn: async () => {
      const { data: cp, error } = await supabase
        .from('control_points')
        .insert({
          name,
          description: description || null,
          type,
          interval_months: type === 'calendar' ? parseInt(intervalMonths) : null,
          interval_engine_hours: type === 'engine_hours' ? parseInt(intervalEngineHours) : null,
          applies_to_all_vessels: appliesToAll,
          is_active: isActive,
          machine_name: machineName || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Add vessel associations if not applying to all
      if (!appliesToAll && selectedVessels.length > 0) {
        const associations = selectedVessels.map((vesselId) => ({
          control_point_id: cp.id,
          vessel_id: vesselId,
        }));
        await supabase.from('control_point_vessels').insert(associations);
      }

      return cp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['control-point-vessels'] });
      toast({ title: 'Skapad', description: 'Kontrollpunkten har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateControlPoint = useMutation({
    mutationFn: async () => {
      if (!editingControlPoint) return;

      const { error } = await supabase
        .from('control_points')
        .update({
          name,
          description: description || null,
          type,
          interval_months: type === 'calendar' ? parseInt(intervalMonths) : null,
          interval_engine_hours: type === 'engine_hours' ? parseInt(intervalEngineHours) : null,
          applies_to_all_vessels: appliesToAll,
          is_active: isActive,
          machine_name: machineName || null,
        })
        .eq('id', editingControlPoint.id);

      if (error) throw error;

      // Update vessel associations
      await supabase
        .from('control_point_vessels')
        .delete()
        .eq('control_point_id', editingControlPoint.id);

      if (!appliesToAll && selectedVessels.length > 0) {
        const associations = selectedVessels.map((vesselId) => ({
          control_point_id: editingControlPoint.id,
          vessel_id: vesselId,
        }));
        await supabase.from('control_point_vessels').insert(associations);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['control-point-vessels'] });
      toast({ title: 'Uppdaterad', description: 'Kontrollpunkten har uppdaterats.' });
      setEditingControlPoint(null);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteControlPoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('control_points').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      toast({ title: 'Raderad', description: 'Kontrollpunkten har raderats.' });
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('calendar');
    setIntervalMonths('12');
    setIntervalEngineHours('250');
    setAppliesToAll(true);
    setSelectedVessels([]);
    setMachineName('');
    setIsActive(true);
  };

  const openEditDialog = (cp: any) => {
    setEditingControlPoint(cp);
    setName(cp.name);
    setDescription(cp.description || '');
    setType(cp.type);
    setIntervalMonths(cp.interval_months?.toString() || '12');
    setIntervalEngineHours(cp.interval_engine_hours?.toString() || '250');
    setAppliesToAll(cp.applies_to_all_vessels);
    setMachineName(cp.machine_name || '');
    setIsActive(cp.is_active);
    
    const cpVessels = controlPointVessels?.filter((cpv) => cpv.control_point_id === cp.id) || [];
    setSelectedVessels(cpVessels.map((cpv) => cpv.vessel_id));
  };

  const handleVesselToggle = (vesselId: string) => {
    setSelectedVessels((prev) =>
      prev.includes(vesselId)
        ? prev.filter((id) => id !== vesselId)
        : [...prev, vesselId]
    );
  };

  const FormContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Namn *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="T.ex. Oljebyte huvudmaskin" />
      </div>

      <div className="space-y-2">
        <Label>Beskrivning / Instruktion</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detaljerad beskrivning av kontrollen..." />
      </div>

      <div className="space-y-2">
        <Label>Typ *</Label>
        <Select value={type} onValueChange={(v) => setType(v as ControlType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calendar">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Kalenderbaserad
              </span>
            </SelectItem>
            <SelectItem value="engine_hours">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Maskintimmar
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === 'calendar' ? (
        <div className="space-y-2">
          <Label>Intervall (månader) *</Label>
          <Input type="number" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} min="1" placeholder="12" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Intervall (maskintimmar) *</Label>
            <Input type="number" value={intervalEngineHours} onChange={(e) => setIntervalEngineHours(e.target.value)} min="1" placeholder="250" />
          </div>
          <div className="space-y-2">
            <Label>Maskinnamn (valfritt)</Label>
            <Input value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="T.ex. Huvudmaskin, Generator 1" />
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <Label>Gäller för alla fartyg</Label>
        <Switch checked={appliesToAll} onCheckedChange={setAppliesToAll} />
      </div>

      {!appliesToAll && (
        <div className="space-y-2">
          <Label>Välj fartyg</Label>
          <div className="grid gap-2 max-h-48 overflow-y-auto p-2 border rounded">
            {vessels?.map((vessel) => (
              <label key={vessel.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedVessels.includes(vessel.id)}
                  onChange={() => handleVesselToggle(vessel.id)}
                  className="h-4 w-4 rounded"
                />
                <span>{vessel.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label>Aktiv</Label>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Egenkontrollpunkter</h1>
            <p className="text-muted-foreground mt-1">Hantera kontrollpunkter och service</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny kontrollpunkt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Skapa kontrollpunkt</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createControlPoint.mutate();
                }}
              >
                <FormContent />
                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createControlPoint.isPending || !name}>
                    {createControlPoint.isPending ? 'Skapar...' : 'Skapa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : controlPoints?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Inga kontrollpunkter skapade</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {controlPoints?.map((cp) => {
              const cpVessels = controlPointVessels?.filter((cpv) => cpv.control_point_id === cp.id) || [];
              const vesselNames = vessels?.filter((v) => cpVessels.some((cpv) => cpv.vessel_id === v.id)).map((v) => v.name) || [];
              
              return (
                <Card key={cp.id} className={!cp.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{cp.name}</span>
                          <Badge variant="outline">
                            {cp.type === 'calendar' ? <Calendar className="h-3 w-3 mr-1" /> : <Gauge className="h-3 w-3 mr-1" />}
                            {CONTROL_TYPE_LABELS[cp.type as ControlType]}
                          </Badge>
                          {!cp.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Intervall: {cp.type === 'calendar' 
                              ? `${cp.interval_months} mån` 
                              : `${cp.interval_engine_hours}h`}
                          </span>
                          <span>
                            {cp.applies_to_all_vessels 
                              ? 'Alla fartyg' 
                              : `${vesselNames.length} fartyg`}
                          </span>
                          {cp.machine_name && <span>Maskin: {cp.machine_name}</span>}
                        </div>
                        {cp.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{cp.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(cp)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(cp.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editingControlPoint} onOpenChange={(open) => !open && setEditingControlPoint(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redigera kontrollpunkt</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateControlPoint.mutate();
              }}
            >
              <FormContent />
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingControlPoint(null)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={updateControlPoint.isPending || !name}>
                  {updateControlPoint.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="Radera kontrollpunkt"
          description="Är du säker på att du vill radera denna kontrollpunkt? All historik kopplad till punkten kommer också att raderas."
          confirmLabel="Radera"
          onConfirm={() => deleteConfirmId && deleteControlPoint.mutate(deleteConfirmId)}
        />
      </div>
    </MainLayout>
  );
}