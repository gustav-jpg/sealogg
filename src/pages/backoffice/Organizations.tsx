import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Building2, Users, Ship, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Organizations() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    org_number: '',
    contact_email: '',
    contact_phone: '',
  });
  const queryClient = useQueryClient();

  const { data: organizations, isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: orgStats } = useQuery({
    queryKey: ['org-stats'],
    queryFn: async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id');
      
      const { data: vessels } = await supabase
        .from('vessels')
        .select('organization_id');
      
      const memberCounts: Record<string, number> = {};
      const vesselCounts: Record<string, number> = {};
      
      members?.forEach(m => {
        memberCounts[m.organization_id] = (memberCounts[m.organization_id] || 0) + 1;
      });
      
      vessels?.forEach(v => {
        if (v.organization_id) {
          vesselCounts[v.organization_id] = (vesselCounts[v.organization_id] || 0) + 1;
        }
      });
      
      return { memberCounts, vesselCounts };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('organizations')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organisation skapad');
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Kunde inte skapa organisation: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData & { is_active: boolean }> }) => {
      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organisation uppdaterad');
      setEditingOrg(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('Kunde inte uppdatera organisation: ' + error.message);
    },
  });

  const resetForm = () => {
    setFormData({ name: '', org_number: '', contact_email: '', contact_phone: '' });
  };

  const handleEdit = (org: any) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      org_number: org.org_number || '',
      contact_email: org.contact_email || '',
      contact_phone: org.contact_phone || '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrg) {
      updateMutation.mutate({ id: editingOrg.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleActive = (org: any) => {
    updateMutation.mutate({ id: org.id, data: { is_active: !org.is_active } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organisationer</h1>
          <p className="text-muted-foreground">Hantera rederier och deras data</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingOrg(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Ny organisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Skapa organisation</DialogTitle>
                <DialogDescription>
                  Lägg till ett nytt rederi i systemet
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org_number">Organisationsnummer</Label>
                  <Input
                    id="org_number"
                    value={formData.org_number}
                    onChange={(e) => setFormData({ ...formData, org_number: e.target.value })}
                    placeholder="XXXXXX-XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_email">Kontakt e-post</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">Kontakt telefon</Label>
                  <Input
                    id="contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Skapar...' : 'Skapa'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organisationer</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {organizations?.filter(o => o.is_active).length || 0} aktiva
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(orgStats?.memberCounts || {}).reduce((a, b) => a + b, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt fartyg</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(orgStats?.vesselCounts || {}).reduce((a, b) => a + b, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alla organisationer</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Namn</TableHead>
                <TableHead>Org.nr</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead className="text-center">Användare</TableHead>
                <TableHead className="text-center">Fartyg</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground">{org.org_number || '-'}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {org.contact_email && <div>{org.contact_email}</div>}
                      {org.contact_phone && <div className="text-muted-foreground">{org.contact_phone}</div>}
                      {!org.contact_email && !org.contact_phone && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{orgStats?.memberCounts[org.id] || 0}</TableCell>
                  <TableCell className="text-center">{orgStats?.vesselCounts[org.id] || 0}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={org.is_active ? 'default' : 'secondary'}>
                      {org.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/backoffice/organizations/${org.id}`}>
                          Visa
                        </Link>
                      </Button>
                      <Dialog open={editingOrg?.id === org.id} onOpenChange={(open) => !open && setEditingOrg(null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(org)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <form onSubmit={handleSubmit}>
                            <DialogHeader>
                              <DialogTitle>Redigera organisation</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-name">Namn *</Label>
                                <Input
                                  id="edit-name"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-org_number">Organisationsnummer</Label>
                                <Input
                                  id="edit-org_number"
                                  value={formData.org_number}
                                  onChange={(e) => setFormData({ ...formData, org_number: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact_email">Kontakt e-post</Label>
                                <Input
                                  id="edit-contact_email"
                                  type="email"
                                  value={formData.contact_email}
                                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact_phone">Kontakt telefon</Label>
                                <Input
                                  id="edit-contact_phone"
                                  value={formData.contact_phone}
                                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label htmlFor="edit-active">Aktiv</Label>
                                <Switch
                                  id="edit-active"
                                  checked={editingOrg?.is_active}
                                  onCheckedChange={() => toggleActive(editingOrg)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="submit" disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? 'Sparar...' : 'Spara'}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {organizations?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Inga organisationer än. Skapa den första!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
