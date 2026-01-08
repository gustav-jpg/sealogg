import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { Plus, Trash2, Shield, Ship } from 'lucide-react';

export default function AdminRoleRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [role, setRole] = useState<CrewRole>('befalhavare');
  const [certTypeId, setCertTypeId] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [requiresInduction, setRequiresInduction] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupLogic, setGroupLogic] = useState('AND');

  const { data: rules } = useQuery({
    queryKey: ['role-certificate-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_certificate_rules')
        .select('*, certificate_type:certificate_types(*)')
        .order('role');
      if (error) throw error;
      return data;
    },
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
      const { error } = await supabase.from('role_certificate_rules').insert({
        role,
        certificate_type_id: certTypeId,
        is_required: isRequired,
        requires_induction: requiresInduction,
        group_name: groupName || null,
        group_logic: groupLogic,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-certificate-rules'] });
      toast({ title: 'Skapat', description: 'Regeln har skapats.' });
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
      const { error } = await supabase.from('role_certificate_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-certificate-rules'] });
      toast({ title: 'Borttaget' });
    },
  });

  const groupedRules = rules?.reduce(
    (acc, rule) => {
      const key = rule.role as CrewRole;
      if (!acc[key]) acc[key] = [];
      acc[key].push(rule);
      return acc;
    },
    {} as Record<CrewRole, typeof rules>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Rollregler</h1>
            <p className="text-muted-foreground mt-1">Definiera vilka certifikat som krävs för varje roll</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny regel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Skapa rollregel</DialogTitle>
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
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    placeholder="T.ex. 'befalsbehörighet'"
                  />
                  <p className="text-xs text-muted-foreground">
                    Regler med samma gruppnamn och OR-logik: minst en måste uppfyllas.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Grupplogik</Label>
                  <Select value={groupLogic} onValueChange={setGroupLogic}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND (alla krävs)</SelectItem>
                      <SelectItem value="OR">OR (minst en krävs)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="required">Obligatoriskt</Label>
                  <Switch id="required" checked={isRequired} onCheckedChange={setIsRequired} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="induction">Kräver inskolning på fartyg</Label>
                  <Switch id="induction" checked={requiresInduction} onCheckedChange={setRequiresInduction} />
                </div>
                <Button
                  onClick={() => createRule.mutate()}
                  disabled={!certTypeId || createRule.isPending}
                  className="w-full"
                >
                  {createRule.isPending ? 'Skapar...' : 'Skapa regel'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(CREW_ROLE_LABELS).map(([roleKey, roleLabel]) => {
            const roleRules = groupedRules?.[roleKey as CrewRole] || [];
            return (
              <Card key={roleKey}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {roleLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {roleRules.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Inga certifikatkrav definierade.</p>
                  ) : (
                    <div className="space-y-2">
                      {roleRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{(rule as any).certificate_type?.name}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {rule.is_required && <Badge variant="outline" className="text-xs">Obligatoriskt</Badge>}
                              {rule.requires_induction && (
                                <Badge variant="outline" className="text-xs">
                                  <Ship className="h-3 w-3 mr-1" />
                                  Inskolning
                                </Badge>
                              )}
                              {rule.group_name && (
                                <Badge variant="secondary" className="text-xs">
                                  {rule.group_logic}: {rule.group_name}
                                </Badge>
                              )}
                            </div>
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
      </div>
    </MainLayout>
  );
}
