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
import { toast } from 'sonner';
import { ArrowLeft, Mail, User, Building2 } from 'lucide-react';

export default function OrganizationDetail() {
  const { id } = useParams<{ id: string }>();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
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

  // Only fetch the owner (first org_admin)
  const { data: owner } = useQuery({
    queryKey: ['organization-owner', id],
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
        .eq('organization_id', id)
        .eq('role', 'org_admin')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('invite-user', {
        body: {
          email,
          fullName,
          organizationId: id,
          role: 'org_admin', // Always org_admin from backoffice
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization-owner', id] });
      toast.success(data.isNewUser 
        ? 'Ägare skapad! De får ett e-postmeddelande för att sätta lösenord.' 
        : 'Befintlig användare satt som ägare.');
      setIsInviteOpen(false);
      setInviteEmail('');
      setInviteFullName('');
    },
    onError: (error) => {
      toast.error('Kunde inte skapa ägare: ' + error.message);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteFullName) {
      toast.error('Fyll i både namn och e-post');
      return;
    }
    inviteUserMutation.mutate({ email: inviteEmail, fullName: inviteFullName });
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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organisationsinfo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Ägare
            </CardTitle>
            <CardDescription>
              Ägaren får admin-rättigheter och hanterar resten i portalen
            </CardDescription>
          </CardHeader>
          <CardContent>
            {owner ? (
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Namn:</span>
                  <p className="font-medium">{(owner.profiles as any)?.full_name || 'Okänd'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">E-post:</span>
                  <p className="font-medium">{(owner.profiles as any)?.email || '-'}</p>
                </div>
                <Badge variant="outline" className="mt-2">Admin i portalen</Badge>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">Ingen ägare ännu</p>
                <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Mail className="h-4 w-4 mr-2" />
                      Skapa ägare
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <form onSubmit={handleInvite}>
                      <DialogHeader>
                        <DialogTitle>Skapa organisationsägare</DialogTitle>
                        <DialogDescription>
                          Ägaren får admin-rättigheter i portalen och kan sedan själv hantera användare, fartyg och allt annat.
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
      </div>
    </div>
  );
}
