import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { Plus, Trash2, Ship, Shield } from 'lucide-react';

export default function VesselCertificates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [role, setRole] = useState<CrewRole>('befalhavare');
  const [certTypeId, setCertTypeId] = useState('');
  const [groupName, setGroupName] = useState('');

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: vesselRoleCerts } = useQuery({
    queryKey: ['vessel-role-certificates', selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const { data, error } = await supabase
        .from('vessel_role_certificates')
        .select('*, certificate_type:certificate_types(*)')
        .eq('vessel_id', selectedVesselId)
        .order('role');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVesselId,
  });

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certificate_types').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createRule = useMutation({
    mutationFn: async () => {
      if (!selectedVesselId) throw new Error('Välj ett fartyg');
      const { error } = await supabase.from('vessel_role_certificates').insert({
        vessel_id: selectedVesselId,
        role,
        certificate_type_id: certTypeId,
        group_name: groupName || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-role-certificates'] });
      toast({ title: 'Krav tillagt' });
      setDialogOpen(false);
      setCertTypeId('');
      setGroupName('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vessel_role_certificates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-role-certificates'] });
      toast({ title: 'Krav borttaget' });
    },
  });

  const selectedVessel = vessels?.find(v => v.id === selectedVesselId);
  
  const groupedRules = vesselRoleCerts?.reduce(
    (acc, rule) => {
      const key = rule.role as CrewRole;
      if (!acc[key]) acc[key] = [];
      acc[key].push(rule);
      return acc;
    },
    {} as Record<CrewRole, typeof vesselRoleCerts>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Fartygscertifikatkrav</h1>
          <p className="text-muted-foreground mt-1">
            Definiera vilka certifikat som krävs för varje roll per fartyg. 
            Roller utan krav behöver endast inskolning.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Fartyg
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vessels?.map(vessel => (
                  <button
                    key={vessel.id}
                    onClick={() => setSelectedVesselId(vessel.id)}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      selectedVesselId === vessel.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium">{vessel.name}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            {selectedVessel ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Certifikatkrav för {selectedVessel.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Alla besättningsmedlemmar kräver inskolning på fartyget
                    </p>
                  </div>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Lägg till krav
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Lägg till certifikatkrav</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Roll *</Label>
                          <Select value={role} onValueChange={v => setRole(v as CrewRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Certifikattyp *</Label>
                          <Select value={certTypeId} onValueChange={setCertTypeId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Välj certifikattyp" />
                            </SelectTrigger>
                            <SelectContent>
                              {certificateTypes?.map(ct => (
                                <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Gruppnamn (för OR-logik)</Label>
                          <Input
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            placeholder="T.ex. 'befälsbehörighet'"
                          />
                          <p className="text-xs text-muted-foreground">
                            Certifikat med samma gruppnamn: minst ett måste uppfyllas.
                          </p>
                        </div>
                        <Button
                          onClick={() => createRule.mutate()}
                          disabled={!certTypeId || createRule.isPending}
                          className="w-full"
                        >
                          {createRule.isPending ? 'Lägger till...' : 'Lägg till krav'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(CREW_ROLE_LABELS).map(([roleKey, roleLabel]) => {
                      const roleRules = groupedRules?.[roleKey as CrewRole] || [];
                      return (
                        <Card key={roleKey} className="bg-muted/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              {roleLabel}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {roleRules.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Endast inskolning krävs
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {roleRules.map(rule => (
                                  <div key={rule.id} className="flex items-center justify-between p-2 rounded bg-background">
                                    <div>
                                      <p className="font-medium text-sm">{(rule as any).certificate_type?.name}</p>
                                      {rule.group_name && (
                                        <Badge variant="secondary" className="text-xs mt-1">
                                          OR: {rule.group_name}
                                        </Badge>
                                      )}
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteRule.mutate(rule.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  Välj ett fartyg för att hantera certifikatkrav
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
