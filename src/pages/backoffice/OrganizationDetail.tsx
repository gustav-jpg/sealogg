import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import { toast } from 'sonner';
import { ArrowLeft, Trash2, Mail } from 'lucide-react';

type OrgRole = 'org_admin' | 'org_user';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('org_admin');
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


  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: OrgRole }) => {
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
        ? 'Nytt konto skapat! Användaren får ett e-postmeddelande för att sätta lösenord.' 
        : 'Befintlig användare tillagd i organisationen.');
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteFullName('');
      setInviteRole('org_admin');
    },
    onError: (error) => {
      toast.error('Kunde inte bjuda in användare: ' + error.message);
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


  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) {
      toast.error('Fyll i både namn och e-post');
      return;
    }
    inviteUserMutation.mutate({ email: inviteEmail, fullName: inviteFullName, role: inviteRole });
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Medlemmar ({members?.length || 0})</h2>
          <div className="flex justify-end">
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Bjud in användare
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Bjud in användare</DialogTitle>
                    <DialogDescription>
                      Skapa ett konto eller lägg till en befintlig användare i organisationen.
                      De får automatiskt admin-rättigheter i portalen.
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
                    <div className="space-y-2">
                      <Label htmlFor="role">Roll i organisationen</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org_admin">Admin (full åtkomst i portalen)</SelectItem>
                          <SelectItem value="org_user">Användare (kan skapa loggböcker)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteUserMutation.isPending}>
                      {inviteUserMutation.isPending ? 'Bjuder in...' : 'Bjud in'}
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
                        <SelectTrigger className="w-40">
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
                      Inga medlemmar än. Bjud in den första!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}