import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useOrgCertificateTypes } from '@/hooks/useOrgCertificateTypes';
import { CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { Plus, Trash2, Ship, Shield, Award, Users } from 'lucide-react';


export default function RoleRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);

  // Certificate requirements state
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [certRole, setCertRole] = useState<CrewRole>('befalhavare');
  const [certTypeId, setCertTypeId] = useState('');
  const [groupName, setGroupName] = useState('');

  // Crew requirements state
  const [crewDialogOpen, setCrewDialogOpen] = useState(false);
  const [crewRole, setCrewRole] = useState<CrewRole>('befalhavare');
  const [minCount, setMinCount] = useState('1');
  const [reqGroup, setReqGroup] = useState('');

  // Certificate types state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  const { data: vessels } = useOrgVessels(selectedOrgId);
  const { data: certificateTypes } = useOrgCertificateTypes(selectedOrgId);


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

  const { data: crewRequirements } = useQuery({
    queryKey: ['crew-requirements', selectedVesselId],
    queryFn: async () => {
      if (!selectedVesselId) return [];
      const { data, error } = await supabase
        .from('vessel_crew_requirements')
        .select('*')
        .eq('vessel_id', selectedVesselId)
        .order('role');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVesselId,
  });


  // Certificate requirements mutations
  const createCertRule = useMutation({
    mutationFn: async () => {
      if (!selectedVesselId) throw new Error('Välj ett fartyg');
      const { error } = await supabase.from('vessel_role_certificates').insert({
        vessel_id: selectedVesselId,
        role: certRole,
        certificate_type_id: certTypeId,
        group_name: groupName || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-role-certificates'] });
      toast({ title: 'Krav tillagt' });
      setCertDialogOpen(false);
      setCertTypeId('');
      setGroupName('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vessel_role_certificates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-role-certificates'] });
      toast({ title: 'Krav borttaget' });
    },
  });

  // Crew requirements mutations
  const createCrewReq = useMutation({
    mutationFn: async () => {
      if (!selectedVesselId) throw new Error('Välj ett fartyg');
      const { error } = await supabase.from('vessel_crew_requirements').insert({
        vessel_id: selectedVesselId,
        role: crewRole,
        minimum_count: parseInt(minCount),
        requirement_group: reqGroup || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-requirements'] });
      toast({ title: 'Bemanningskrav tillagt' });
      setCrewDialogOpen(false);
      setMinCount('1');
      setReqGroup('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCrewReq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vessel_crew_requirements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crew-requirements'] });
      toast({ title: 'Bemanningskrav borttaget' });
    },
  });

  // Certificate types mutations
  const createCertType = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No organization found');
      const { error } = await supabase.from('certificate_types').insert({
        name: typeName,
        description: typeDescription || null,
        organization_id: selectedOrgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp skapad' });
      setTypeDialogOpen(false);
      setTypeName('');
      setTypeDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certificate_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp borttagen' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const selectedVessel = vessels?.find((v) => v.id === selectedVesselId);

  const groupedCertRules = vesselRoleCerts?.reduce(
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
          <h1 className="text-3xl font-display font-bold">Rollregler</h1>
          <p className="text-muted-foreground mt-1">
            Hantera bemanningskrav, certifikatkrav per roll och certifikattyper
          </p>
        </div>

        <Tabs defaultValue="crew" className="space-y-6">
          <TabsList>
            <TabsTrigger value="crew" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Bemanningskrav
            </TabsTrigger>
            <TabsTrigger value="certificates" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Certifikatkrav
            </TabsTrigger>
            <TabsTrigger value="types" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Certifikattyper
            </TabsTrigger>
          </TabsList>

          {/* Bemanningskrav Tab */}
          <TabsContent value="crew" className="space-y-6">
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
                    {vessels?.map((vessel) => (
                      <button
                        key={vessel.id}
                        onClick={() => setSelectedVesselId(vessel.id)}
                        className={`w-full text-left p-2 rounded transition-colors ${
                          selectedVesselId === vessel.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
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
                        <CardTitle>Bemanningskrav för {selectedVessel.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Definiera minsta antal besättningsmedlemmar per roll
                        </p>
                      </div>
                      <Dialog open={crewDialogOpen} onOpenChange={setCrewDialogOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Lägg till krav
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Lägg till bemanningskrav</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Roll *</Label>
                              <Select value={crewRole} onValueChange={(v) => setCrewRole(v as CrewRole)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Minsta antal *</Label>
                              <Input
                                type="number"
                                min="1"
                                value={minCount}
                                onChange={(e) => setMinCount(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Gruppnamn (för OR-logik)</Label>
                              <Input
                                value={reqGroup}
                                onChange={(e) => setReqGroup(e.target.value)}
                                placeholder="T.ex. 'däckspersonal'"
                              />
                              <p className="text-xs text-muted-foreground">
                                Krav med samma gruppnamn: minst ett måste uppfyllas.
                              </p>
                            </div>
                            <Button
                              onClick={() => createCrewReq.mutate()}
                              disabled={createCrewReq.isPending}
                              className="w-full"
                            >
                              {createCrewReq.isPending ? 'Lägger till...' : 'Lägg till krav'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      {crewRequirements && crewRequirements.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {crewRequirements.map((req) => (
                            <Card key={req.id} className="bg-muted/30">
                              <CardContent className="pt-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{CREW_ROLE_LABELS[req.role as CrewRole]}</p>
                                    <p className="text-sm text-muted-foreground">
                                      Minst {req.minimum_count} st
                                    </p>
                                    {req.requirement_group && (
                                      <Badge variant="secondary" className="mt-1">
                                        OR: {req.requirement_group}
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteCrewReq.mutate(req.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          Inga bemanningskrav definierade för detta fartyg
                        </p>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      Välj ett fartyg för att hantera bemanningskrav
                    </p>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Certifikatkrav Tab */}
          <TabsContent value="certificates" className="space-y-6">
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
                    {vessels?.map((vessel) => (
                      <button
                        key={vessel.id}
                        onClick={() => setSelectedVesselId(vessel.id)}
                        className={`w-full text-left p-2 rounded transition-colors ${
                          selectedVesselId === vessel.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
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
                      <Dialog open={certDialogOpen} onOpenChange={setCertDialogOpen}>
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
                              <Select value={certRole} onValueChange={(v) => setCertRole(v as CrewRole)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
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
                                  {certificateTypes?.map((ct) => (
                                    <SelectItem key={ct.id} value={ct.id}>
                                      {ct.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Gruppnamn (för OR-logik)</Label>
                              <Input
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="T.ex. 'befälsbehörighet'"
                              />
                              <p className="text-xs text-muted-foreground">
                                Certifikat med samma gruppnamn: minst ett måste uppfyllas.
                              </p>
                            </div>
                            <Button
                              onClick={() => createCertRule.mutate()}
                              disabled={!certTypeId || createCertRule.isPending}
                              className="w-full"
                            >
                              {createCertRule.isPending ? 'Lägger till...' : 'Lägg till krav'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        {Object.entries(CREW_ROLE_LABELS).map(([roleKey, roleLabel]) => {
                          const roleRules = groupedCertRules?.[roleKey as CrewRole] || [];
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
                                  <p className="text-sm text-muted-foreground">Endast inskolning krävs</p>
                                ) : (
                                  <div className="space-y-2">
                                    {roleRules.map((rule) => (
                                      <div
                                        key={rule.id}
                                        className="flex items-center justify-between p-2 rounded bg-background"
                                      >
                                        <div>
                                          <p className="font-medium text-sm">
                                            {(rule as any).certificate_type?.name}
                                          </p>
                                          {rule.group_name && (
                                            <Badge variant="secondary" className="text-xs mt-1">
                                              OR: {rule.group_name}
                                            </Badge>
                                          )}
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => deleteCertRule.mutate(rule.id)}
                                        >
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
          </TabsContent>

          {/* Certifikattyper Tab */}
          <TabsContent value="types" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Certifikattyper</h2>
                <p className="text-muted-foreground">Hantera certifikattyper som kan tilldelas användare</p>
              </div>
              <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Ny certifikattyp
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Skapa certifikattyp</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Namn *</Label>
                      <Input
                        id="name"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        placeholder="T.ex. Befäls Behörighet klass 6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="desc">Beskrivning</Label>
                      <Textarea
                        id="desc"
                        value={typeDescription}
                        onChange={(e) => setTypeDescription(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => createCertType.mutate()}
                      disabled={!typeName || createCertType.isPending}
                      className="w-full"
                    >
                      {createCertType.isPending ? 'Skapar...' : 'Skapa'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {certificateTypes?.map((ct) => (
                <Card key={ct.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        {ct.name}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => deleteCertType.mutate(ct.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  {ct.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{ct.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
