import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Plus, UserPlus, Ship, Trash2 } from 'lucide-react';

type OrgRole = 'org_admin' | 'org_user';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddVesselOpen, setIsAddVesselOpen] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<OrgRole>('org_user');
  const [vesselName, setVesselName] = useState('');
  const [vesselDescription, setVesselDescription] = useState('');
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

  const { data: members } = useQuery({
    queryKey: ['organization-members', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .eq('organization_id', id);
      if (error) throw error;
      return data;
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

  const { data: allProfiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_external', false)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: OrgRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .insert([{ organization_id: id, user_id: userId, role }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', id] });
      toast.success('Medlem tillagd');
      setIsAddMemberOpen(false);
      setMemberEmail('');
      setMemberRole('org_user');
    },
    onError: (error) => {
      toast.error('Kunde inte lägga till medlem: ' + error.message);
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
      toast.success('Medlem borttagen');
    },
    onError: (error) => {
      toast.error('Kunde inte ta bort medlem: ' + error.message);
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrgRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', id] });
      toast.success('Roll uppdaterad');
    },
    onError: (error) => {
      toast.error('Kunde inte uppdatera roll: ' + error.message);
    },
  });

  const addVesselMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('vessels')
        .insert([{ 
          name: vesselName, 
          description: vesselDescription || null,
          organization_id: id 
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-vessels', id] });
      toast.success('Fartyg tillagt');
      setIsAddVesselOpen(false);
      setVesselName('');
      setVesselDescription('');
    },
    onError: (error) => {
      toast.error('Kunde inte lägga till fartyg: ' + error.message);
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const profile = allProfiles?.find(p => p.email === memberEmail);
    if (!profile?.user_id) {
      toast.error('Ingen användare hittades med den e-postadressen');
      return;
    }
    addMemberMutation.mutate({ userId: profile.user_id, role: memberRole });
  };

  const existingMemberUserIds = members?.map(m => m.user_id) || [];
  const availableProfiles = allProfiles?.filter(p => p.user_id && !existingMemberUserIds.includes(p.user_id)) || [];

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

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Medlemmar ({members?.length || 0})</TabsTrigger>
          <TabsTrigger value="vessels">Fartyg ({vessels?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Lägg till medlem
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddMember}>
                  <DialogHeader>
                    <DialogTitle>Lägg till medlem</DialogTitle>
                    <DialogDescription>
                      Välj en befintlig användare att lägga till i organisationen
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Användare</Label>
                      <Select value={memberEmail} onValueChange={setMemberEmail}>
                        <SelectTrigger>
                          <SelectValue placeholder="Välj användare..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.email || ''}>
                              {profile.full_name} ({profile.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Roll</Label>
                      <Select value={memberRole} onValueChange={(v) => setMemberRole(v as OrgRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org_admin">Admin</SelectItem>
                          <SelectItem value="org_user">Användare</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={!memberEmail || addMemberMutation.isPending}>
                      {addMemberMutation.isPending ? 'Lägger till...' : 'Lägg till'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {(member.profiles as any)?.full_name || 'Okänd'}
                    </TableCell>
                    <TableCell>{(member.profiles as any)?.email || '-'}</TableCell>
                    <TableCell>
                      <Select 
                        value={member.role} 
                        onValueChange={(v) => updateMemberRoleMutation.mutate({ memberId: member.id, role: v as OrgRole })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org_admin">Admin</SelectItem>
                          <SelectItem value="org_user">Användare</SelectItem>
                        </SelectContent>
                      </Select>
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
                ))}
                {members?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Inga medlemmar än
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="vessels" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isAddVesselOpen} onOpenChange={setIsAddVesselOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Ship className="h-4 w-4 mr-2" />
                  Lägg till fartyg
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={(e) => { e.preventDefault(); addVesselMutation.mutate(); }}>
                  <DialogHeader>
                    <DialogTitle>Lägg till fartyg</DialogTitle>
                    <DialogDescription>
                      Skapa ett nytt fartyg för denna organisation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="vessel-name">Namn *</Label>
                      <Input
                        id="vessel-name"
                        value={vesselName}
                        onChange={(e) => setVesselName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vessel-description">Beskrivning</Label>
                      <Input
                        id="vessel-description"
                        value={vesselDescription}
                        onChange={(e) => setVesselDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={!vesselName || addVesselMutation.isPending}>
                      {addVesselMutation.isPending ? 'Skapar...' : 'Skapa'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Motorer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vessels?.map((vessel) => (
                  <TableRow key={vessel.id}>
                    <TableCell className="font-medium">{vessel.name}</TableCell>
                    <TableCell className="text-muted-foreground">{vessel.description || '-'}</TableCell>
                    <TableCell>
                      {vessel.main_engine_count} huvud, {vessel.auxiliary_engine_count} hjälp
                    </TableCell>
                  </TableRow>
                ))}
                {vessels?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Inga fartyg än
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
