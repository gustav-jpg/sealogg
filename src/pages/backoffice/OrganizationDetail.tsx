import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Mail, User, Building2, Package, Users, Ship, BookOpen, AlertTriangle, Wrench, ClipboardCheck, ClipboardList, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

type AppModule = 'logbook' | 'deviations' | 'fault_cases' | 'self_control' | 'checklists' | 'bookings';

const MODULE_INFO: Record<AppModule, { label: string; icon: any; description: string }> = {
  logbook: { label: 'Loggbok', icon: BookOpen, description: 'Digital skeppsloggbok' },
  deviations: { label: 'Avvikelser', icon: AlertTriangle, description: 'Hantera incidenter och avvikelser' },
  fault_cases: { label: 'Felärenden', icon: Wrench, description: 'Spårning av fel och reparationer' },
  self_control: { label: 'Egenkontroll', icon: ClipboardCheck, description: 'Kontrollpunkter och underhåll' },
  checklists: { label: 'Checklistor', icon: ClipboardList, description: 'Återkommande checklistor' },
  bookings: { label: 'Bokningar', icon: CalendarDays, description: 'Bokningssystem för charter' },
};

const ALL_MODULES: AppModule[] = ['logbook', 'deviations', 'fault_cases', 'self_control', 'checklists', 'bookings'];

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [addModuleOpen, setAddModuleOpen] = useState<AppModule | null>(null);
  const [moduleStartDate, setModuleStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [moduleEndDate, setModuleEndDate] = useState('');
  const queryClient = useQueryClient();

  const { data: organization } = useQuery({
    queryKey: ['organization', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: features } = useQuery({
    queryKey: ['organization-features', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_features')
        .select('*')
        .eq('organization_id', id)
        .order('module');
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ['organization-members', id],
    queryFn: async () => {
      // First get organization members
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', id)
        .order('created_at');
      if (membersError) throw membersError;
      
      if (!membersData || membersData.length === 0) return [];
      
      // Then get profiles for those user_ids
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, user_id')
        .in('user_id', userIds);
      if (profilesError) throw profilesError;
      
      // Map profiles to members
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      return membersData.map(member => ({
        ...member,
        profile: profilesMap.get(member.user_id) || null
      }));
    },
  });

  const { data: vessels } = useQuery({
    queryKey: ['organization-vessels', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessels')
        .select('*')
        .eq('organization_id', id)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const addFeatureMutation = useMutation({
    mutationFn: async ({ module, starts_at, expires_at }: { module: AppModule; starts_at: string; expires_at?: string }) => {
      const { error } = await supabase
        .from('organization_features')
        .insert({
          organization_id: id,
          module,
          starts_at,
          expires_at: expires_at || null,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-features', id] });
      toast.success('Modul aktiverad');
      setAddModuleOpen(null);
      setModuleStartDate(format(new Date(), 'yyyy-MM-dd'));
      setModuleEndDate('');
    },
    onError: (error) => {
      toast.error('Kunde inte aktivera modul: ' + error.message);
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async ({ featureId, data }: { featureId: string; data: { is_active?: boolean; expires_at?: string | null } }) => {
      const { error } = await supabase
        .from('organization_features')
        .update(data)
        .eq('id', featureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-features', id] });
      toast.success('Modul uppdaterad');
    },
    onError: (error) => {
      toast.error('Kunde inte uppdatera modul: ' + error.message);
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const { error } = await supabase
        .from('organization_features')
        .delete()
        .eq('id', featureId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-features', id] });
      toast.success('Modul borttagen');
    },
    onError: (error) => {
      toast.error('Kunde inte ta bort modul: ' + error.message);
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: 'org_admin' | 'org_user' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          fullName,
          organizationId: id,
          role,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', id] });
      toast.success(data.isNewUser 
        ? 'Användare skapad! De får ett e-postmeddelande för att sätta lösenord.' 
        : 'Befintlig användare tillagd i organisationen.');
      setIsInviteOpen(false);
      setIsAddUserOpen(false);
      setInviteEmail('');
      setInviteFullName('');
    },
    onError: (error) => {
      toast.error('Kunde inte lägga till användare: ' + error.message);
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', id] });
      toast.success('Användare borttagen från organisationen');
    },
    onError: (error) => {
      toast.error('Kunde inte ta bort användare: ' + error.message);
    },
  });

  const handleInvite = (e: React.FormEvent, role: 'org_admin' | 'org_user') => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) {
      toast.error('Fyll i både namn och e-post');
      return;
    }
    inviteUserMutation.mutate({ email: inviteEmail, fullName: inviteFullName, role });
  };

  const handleAddModule = (module: AppModule) => {
    addFeatureMutation.mutate({
      module,
      starts_at: moduleStartDate,
      expires_at: moduleEndDate || undefined,
    });
  };

  const activeModules = features?.map(f => f.module) || [];
  const availableModules = ALL_MODULES.filter(m => !activeModules.includes(m));

  const isModuleExpired = (feature: any) => {
    if (!feature.expires_at) return false;
    return new Date(feature.expires_at) < new Date();
  };

  const isModuleActive = (feature: any) => {
    if (!feature.is_active) return false;
    if (new Date(feature.starts_at) > new Date()) return false;
    if (feature.expires_at && new Date(feature.expires_at) < new Date()) return false;
    return true;
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/backoffice/organizations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{organization.name}</h1>
          <p className="text-muted-foreground">
            {organization.org_number || 'Inget org.nr'} • {organization.contact_email || 'Ingen e-post'}
          </p>
        </div>
        <Badge variant={organization.is_active ? 'default' : 'secondary'} className="ml-auto">
          {organization.is_active ? 'Aktiv' : 'Inaktiv'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Moduler</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features?.filter(f => isModuleActive(f)).length || 0}</div>
            <p className="text-xs text-muted-foreground">av {ALL_MODULES.length} tillgängliga</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fartyg</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vessels?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organization.is_active ? '✓' : '✗'}</div>
            <p className="text-xs text-muted-foreground">{organization.is_active ? 'Aktiv kund' : 'Inaktiv'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="modules" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Moduler
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Användare
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Information
          </TabsTrigger>
        </TabsList>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Aktiva moduler</CardTitle>
                <CardDescription>Hantera vilka funktioner organisationen har tillgång till</CardDescription>
              </div>
              {availableModules.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Lägg till modul
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Lägg till modul</DialogTitle>
                      <DialogDescription>Välj en modul att aktivera för denna organisation</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {availableModules.map((module) => {
                        const info = MODULE_INFO[module];
                        const Icon = info.icon;
                        return (
                          <div
                            key={module}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                            onClick={() => setAddModuleOpen(module)}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div>
                                <p className="font-medium">{info.label}</p>
                                <p className="text-sm text-muted-foreground">{info.description}</p>
                              </div>
                            </div>
                            <Plus className="h-4 w-4" />
                          </div>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {features && features.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modul</TableHead>
                      <TableHead>Startdatum</TableHead>
                      <TableHead>Slutdatum</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Aktiv</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {features.map((feature) => {
                      const info = MODULE_INFO[feature.module as AppModule];
                      const Icon = info?.icon || Package;
                      const expired = isModuleExpired(feature);
                      const active = isModuleActive(feature);
                      
                      return (
                        <TableRow key={feature.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="font-medium">{info?.label || feature.module}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(feature.starts_at), 'd MMM yyyy', { locale: sv })}
                          </TableCell>
                          <TableCell>
                            {feature.expires_at 
                              ? format(new Date(feature.expires_at), 'd MMM yyyy', { locale: sv })
                              : <span className="text-muted-foreground">Tillsvidare</span>
                            }
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={active ? 'default' : expired ? 'destructive' : 'secondary'}>
                              {active ? 'Aktiv' : expired ? 'Utgången' : 'Pausad'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={feature.is_active}
                              onCheckedChange={(checked) => 
                                updateFeatureMutation.mutate({ featureId: feature.id, data: { is_active: checked } })
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteFeatureMutation.mutate(feature.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Inga moduler aktiverade. Lägg till moduler för att ge organisationen tillgång till funktioner.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Användare</CardTitle>
                <CardDescription>Alla användare som tillhör denna organisation</CardDescription>
              </div>
              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Lägg till användare
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={(e) => handleInvite(e, 'org_user')}>
                    <DialogHeader>
                      <DialogTitle>Lägg till användare</DialogTitle>
                      <DialogDescription>
                        Lägg till en ny användare i organisationen
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Namn *</Label>
                        <Input
                          id="fullName"
                          value={inviteFullName}
                          onChange={(e) => setInviteFullName(e.target.value)}
                          placeholder="Anna Andersson"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-post *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="anna@example.com"
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button type="submit" variant="outline" disabled={inviteUserMutation.isPending}>
                        Lägg till som användare
                      </Button>
                      <Button 
                        type="button" 
                        disabled={inviteUserMutation.isPending}
                        onClick={(e) => handleInvite(e as any, 'org_admin')}
                      >
                        Lägg till som admin
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {members && members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Namn</TableHead>
                      <TableHead>E-post</TableHead>
                      <TableHead>Roll</TableHead>
                      <TableHead>Tillagd</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const profile = member.profile;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {profile?.full_name || 'Okänd'}
                          </TableCell>
                          <TableCell>{profile?.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={member.role === 'org_admin' ? 'default' : 'secondary'}>
                              {member.role === 'org_admin' ? 'Admin' : 'Användare'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(member.created_at), 'd MMM yyyy', { locale: sv })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMemberMutation.mutate(member.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Inga användare ännu</p>
                  <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Mail className="h-4 w-4 mr-2" />
                        Skapa ägare
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={(e) => handleInvite(e, 'org_admin')}>
                        <DialogHeader>
                          <DialogTitle>Skapa organisationsägare</DialogTitle>
                          <DialogDescription>
                            Ägaren får admin-rättigheter i portalen och kan sedan själv hantera användare.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="ownerFullName">Namn *</Label>
                            <Input
                              id="ownerFullName"
                              value={inviteFullName}
                              onChange={(e) => setInviteFullName(e.target.value)}
                              placeholder="Anna Andersson"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="ownerEmail">E-post *</Label>
                            <Input
                              id="ownerEmail"
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="anna@example.com"
                              required
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={inviteUserMutation.isPending}>
                            {inviteUserMutation.isPending ? 'Skapar...' : 'Skapa ägare'}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organisationsinfo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Namn:</span>
                  <p className="font-medium">{organization.name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Org.nummer:</span>
                  <p className="font-medium">{organization.org_number || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Kontakt e-post:</span>
                  <p className="font-medium">{organization.contact_email || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Kontakt telefon:</span>
                  <p className="font-medium">{organization.contact_phone || '-'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Skapad:</span>
                  <p className="font-medium">
                    {format(new Date(organization.created_at), 'd MMMM yyyy', { locale: sv })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Fartyg
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vessels && vessels.length > 0 ? (
                  <div className="space-y-2">
                    {vessels.map((vessel) => (
                      <div key={vessel.id} className="flex items-center justify-between p-2 rounded border">
                        <span className="font-medium">{vessel.name}</span>
                        <Badge variant="outline">{vessel.main_engine_count} motor(er)</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Inga fartyg registrerade
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Module Dialog */}
      <Dialog open={!!addModuleOpen} onOpenChange={() => setAddModuleOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Aktivera {addModuleOpen && MODULE_INFO[addModuleOpen]?.label}
            </DialogTitle>
            <DialogDescription>
              Ange prenumerationsperiod för modulen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum *</Label>
              <Input
                id="startDate"
                type="date"
                value={moduleStartDate}
                onChange={(e) => setModuleStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Slutdatum (lämna tomt för tillsvidare)</Label>
              <Input
                id="endDate"
                type="date"
                value={moduleEndDate}
                onChange={(e) => setModuleEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModuleOpen(null)}>
              Avbryt
            </Button>
            <Button 
              onClick={() => addModuleOpen && handleAddModule(addModuleOpen)}
              disabled={addFeatureMutation.isPending}
            >
              {addFeatureMutation.isPending ? 'Aktiverar...' : 'Aktivera modul'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
