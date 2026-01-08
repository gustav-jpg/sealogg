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
import { useToast } from '@/hooks/use-toast';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { Plus, Ship, Trash2, Users } from 'lucide-react';

export default function AdminVessels() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<{ role: CrewRole; count: number }[]>([]);

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

  const createVessel = useMutation({
    mutationFn: async () => {
      const { data: vessel, error: vesselError } = await supabase
        .from('vessels')
        .insert({ name, description: description || null })
        .select()
        .single();
      if (vesselError) throw vesselError;

      if (requirements.length > 0) {
        const { error: reqError } = await supabase.from('vessel_crew_requirements').insert(
          requirements.map(r => ({ vessel_id: vessel.id, role: r.role, minimum_count: r.count }))
        );
        if (reqError) throw reqError;
      }

      return vessel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-crew-requirements'] });
      toast({ title: 'Skapat', description: 'Fartyget har skapats.' });
      setDialogOpen(false);
      setName('');
      setDescription('');
      setRequirements([]);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

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

  const addRequirement = () => {
    setRequirements([...requirements, { role: 'matros', count: 1 }]);
  };

  const updateRequirement = (index: number, field: 'role' | 'count', value: string | number) => {
    const updated = [...requirements];
    if (field === 'role') updated[index].role = value as CrewRole;
    else updated[index].count = value as number;
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimikrav bemanning</Label>
                    <Button variant="outline" size="sm" onClick={addRequirement}>
                      <Plus className="h-4 w-4 mr-1" />
                      Lägg till
                    </Button>
                  </div>
                  {requirements.map((req, i) => (
                    <div key={i} className="flex gap-2 items-center">
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
                        className="w-20"
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
                      onClick={() => deleteVessel.mutate(vessel.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vessel.description && <p className="text-sm text-muted-foreground mb-3">{vessel.description}</p>}
                  {vesselReqs.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Minimibemanning
                      </p>
                      {vesselReqs.map(req => (
                        <p key={req.id} className="text-sm text-muted-foreground">
                          {CREW_ROLE_LABELS[req.role as CrewRole]}: {req.minimum_count}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}
