import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { Plus, Ship, Trash2, Users, Settings, Gauge } from 'lucide-react';

export default function AdminVessels() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [engineDialogOpen, setEngineDialogOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<{ id: string; name: string; main_engine_count: number; auxiliary_engine_count: number } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mainEngineCount, setMainEngineCount] = useState(1);
  const [auxiliaryEngineCount, setAuxiliaryEngineCount] = useState(0);
  const [requirements, setRequirements] = useState<{ role: CrewRole; count: number; group: string }[]>([]);
  const [engineHoursInputs, setEngineHoursInputs] = useState<{ engine_type: string; engine_number: number; current_hours: number; name: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; vessel: { id: string; name: string } | null }>({ open: false, vessel: null });

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: crewRequirements } = useQuery({
    queryKey: ['vessel-crew-requirements'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessel_crew_requirements').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: vesselEngineHours } = useQuery({
    queryKey: ['vessel-engine-hours'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessel_engine_hours').select('*');
      if (error) throw error;
      return data;
    },
  });

  const createVessel = useMutation({
    mutationFn: async () => {
      const { data: vessel, error: vesselError } = await supabase
        .from('vessels')
        .insert({ 
          name, 
          description: description || null,
          main_engine_count: mainEngineCount,
          auxiliary_engine_count: auxiliaryEngineCount
        })
        .select()
        .single();
      if (vesselError) throw vesselError;

      if (requirements.length > 0) {
        const { error: reqError } = await supabase.from('vessel_crew_requirements').insert(
          requirements.map(r => ({ 
            vessel_id: vessel.id, 
            role: r.role, 
            minimum_count: r.count,
            requirement_group: r.group || null
          }))
        );
        if (reqError) throw reqError;
      }

      // Skapa engine hours records för alla maskiner
      const engineRecords = [];
      for (let i = 1; i <= mainEngineCount; i++) {
        engineRecords.push({ vessel_id: vessel.id, engine_type: 'main', engine_number: i, current_hours: 0, name: `Huvudmaskin ${i}` });
      }
      for (let i = 1; i <= auxiliaryEngineCount; i++) {
        engineRecords.push({ vessel_id: vessel.id, engine_type: 'auxiliary', engine_number: i, current_hours: 0, name: `Hjälpmaskin ${i}` });
      }
      if (engineRecords.length > 0) {
        const { error: engineError } = await supabase.from('vessel_engine_hours').insert(engineRecords);
        if (engineError) throw engineError;
      }

      return vessel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-crew-requirements'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      toast({ title: 'Skapat', description: 'Fartyget har skapats.' });
      setDialogOpen(false);
      setName('');
      setDescription('');
      setMainEngineCount(1);
      setAuxiliaryEngineCount(0);
      setRequirements([]);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateEngineHours = useMutation({
    mutationFn: async () => {
      if (!selectedVessel) throw new Error('Inget fartyg valt');
      
      for (const input of engineHoursInputs) {
        const { error } = await supabase
          .from('vessel_engine_hours')
          .upsert({
            vessel_id: selectedVessel.id,
            engine_type: input.engine_type,
            engine_number: input.engine_number,
            current_hours: input.current_hours,
            name: input.name || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vessel_id,engine_type,engine_number' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      toast({ title: 'Sparat', description: 'Maskintimmar uppdaterade.' });
      setEngineDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openEngineDialog = (vessel: { id: string; name: string; main_engine_count: number; auxiliary_engine_count: number }) => {
    setSelectedVessel(vessel);
    const existingHours = vesselEngineHours?.filter(h => h.vessel_id === vessel.id) || [];
    const inputs: { engine_type: string; engine_number: number; current_hours: number; name: string }[] = [];
    
    for (let i = 1; i <= vessel.main_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      inputs.push({ 
        engine_type: 'main', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Huvudmaskin ${i}`
      });
    }
    for (let i = 1; i <= vessel.auxiliary_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      inputs.push({ 
        engine_type: 'auxiliary', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Hjälpmaskin ${i}`
      });
    }
    
    setEngineHoursInputs(inputs);
    setEngineDialogOpen(true);
  };

  const deleteVessel = useMutation({
    mutationFn: async (vesselId: string) => {
      const { error } = await supabase.from('vessels').delete().eq('id', vesselId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      toast({ title: 'Borttaget', description: 'Fartyget har tagits bort.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const addRequirement = (group: string = '') => {
    setRequirements([...requirements, { role: 'matros', count: 1, group }]);
  };

  const updateRequirement = (index: number, field: 'role' | 'count' | 'group', value: string | number) => {
    const updated = [...requirements];
    if (field === 'role') updated[index].role = value as CrewRole;
    else if (field === 'count') updated[index].count = value as number;
    else if (field === 'group') updated[index].group = value as string;
    setRequirements(updated);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Fartyg</h1>
            <p className="text-muted-foreground mt-1">Hantera fartyg och bemanningskrav</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nytt fartyg
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Skapa fartyg</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. MS Charm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Beskrivning</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mainEngines">Antal huvudmaskiner</Label>
                    <Input id="mainEngines" type="number" min={0} value={mainEngineCount} onChange={e => setMainEngineCount(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auxEngines">Antal hjälpmaskiner</Label>
                    <Input id="auxEngines" type="number" min={0} value={auxiliaryEngineCount} onChange={e => setAuxiliaryEngineCount(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Bemanningskrav</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lämna "Grupp" tomt för krav som alltid gäller. Använd samma gruppnamn (t.ex. "A", "B") för alternativ – om minst ett alternativ uppfylls godkänns bemanningen.
                  </p>
                  
                  <div className="space-y-2">
                    {requirements.map((req, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <Input
                          placeholder="Grupp"
                          className="w-16"
                          value={req.group}
                          onChange={e => updateRequirement(i, 'group', e.target.value)}
                        />
                        <Select value={req.role} onValueChange={v => updateRequirement(i, 'role', v)}>
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          className="w-16"
                          min={1}
                          value={req.count}
                          onChange={e => updateRequirement(i, 'count', parseInt(e.target.value) || 1)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeRequirement(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <Button variant="outline" size="sm" onClick={() => addRequirement('')} className="w-full">
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till krav
                  </Button>
                </div>
                <Button onClick={() => createVessel.mutate()} disabled={!name || createVessel.isPending} className="w-full">
                  {createVessel.isPending ? 'Skapar...' : 'Skapa fartyg'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vessels?.map(vessel => {
            const vesselReqs = crewRequirements?.filter(r => r.vessel_id === vessel.id) || [];
            return (
              <Card key={vessel.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Ship className="h-5 w-5" />
                      {vessel.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm({ open: true, vessel: { id: vessel.id, name: vessel.name } })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardTitle>
                </CardHeader>
              <CardContent className="space-y-3">
                  {vessel.description && <p className="text-sm text-muted-foreground">{vessel.description}</p>}
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <span>{vessel.main_engine_count} huvudmaskin(er)</span>
                    {vessel.auxiliary_engine_count > 0 && (
                      <span className="text-muted-foreground">+ {vessel.auxiliary_engine_count} hjälp</span>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => openEngineDialog(vessel)}>
                      <Settings className="h-3 w-3 mr-1" />
                      Timmar
                    </Button>
                  </div>
                  
                  {vesselReqs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Bemanningskrav
                      </p>
                      {(() => {
                        // Group requirements
                        const grouped: Record<string, typeof vesselReqs> = {};
                        const ungrouped: typeof vesselReqs = [];
                        for (const req of vesselReqs) {
                          if ((req as any).requirement_group) {
                            const g = (req as any).requirement_group;
                            if (!grouped[g]) grouped[g] = [];
                            grouped[g].push(req);
                          } else {
                            ungrouped.push(req);
                          }
                        }
                        return (
                          <>
                            {ungrouped.map(req => (
                              <p key={req.id} className="text-sm text-muted-foreground">
                                {CREW_ROLE_LABELS[req.role as CrewRole]}: {req.minimum_count}
                              </p>
                            ))}
                            {Object.entries(grouped).map(([group, reqs]) => (
                              <p key={group} className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Alt {group}:</span>{' '}
                                {reqs.map(r => `${r.minimum_count} ${CREW_ROLE_LABELS[r.role as CrewRole]}`).join(' + ')}
                              </p>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={engineDialogOpen} onOpenChange={setEngineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Maskintimmar - {selectedVessel?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {engineHoursInputs.map((input, index) => (
                <div key={`${input.engine_type}-${input.engine_number}`} className="space-y-2 p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground min-w-20">Namn</Label>
                    <Input
                      value={input.name}
                      onChange={e => {
                        const updated = [...engineHoursInputs];
                        updated[index].name = e.target.value;
                        setEngineHoursInputs(updated);
                      }}
                      placeholder={input.engine_type === 'main' ? `Huvudmaskin ${input.engine_number}` : `Hjälpmaskin ${input.engine_number}`}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs text-muted-foreground min-w-20">Timmar</Label>
                    <Input
                      type="number"
                      min={0}
                      value={input.current_hours}
                      onChange={e => {
                        const updated = [...engineHoursInputs];
                        updated[index].current_hours = parseInt(e.target.value) || 0;
                        setEngineHoursInputs(updated);
                      }}
                      className="w-32"
                    />
                  </div>
                </div>
              ))}
              {engineHoursInputs.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Inga maskiner konfigurerade för detta fartyg.</p>
              )}
              <Button onClick={() => updateEngineHours.mutate()} disabled={updateEngineHours.isPending} className="w-full">
                {updateEngineHours.isPending ? 'Sparar...' : 'Spara maskintimmar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ open, vessel: open ? deleteConfirm.vessel : null })}
          title="Ta bort fartyg"
          description={`Är du säker på att du vill ta bort "${deleteConfirm.vessel?.name}"? Detta går inte att ångra och all relaterad data (loggböcker, bemanningskrav, maskintimmar) kan påverkas.`}
          confirmLabel="Ta bort"
          onConfirm={() => {
            if (deleteConfirm.vessel) {
              deleteVessel.mutate(deleteConfirm.vessel.id);
              setDeleteConfirm({ open: false, vessel: null });
            }
          }}
        />
      </div>
    </MainLayout>
  );
}
