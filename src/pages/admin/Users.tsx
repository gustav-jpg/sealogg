import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { APP_ROLE_LABELS, AppRole } from '@/lib/types';
import { User, Shield, Award, Ship, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: userCertificates } = useQuery({
    queryKey: ['user-certificates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_certificates').select('*, certificate_type:certificate_types(*)');
      if (error) throw error;
      return data;
    },
  });

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: inductions } = useQuery({
    queryKey: ['user-inductions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_vessel_inductions').select('*, vessel:vessels(*)');
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

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ title: 'Roll tillagd' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('user_roles').delete().eq('id', roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ title: 'Roll borttagen' });
    },
  });

  const addCertificate = useMutation({
    mutationFn: async (data: { userId: string; certTypeId: string; expiryDate: string }) => {
      const { error } = await supabase.from('user_certificates').insert({
        user_id: data.userId,
        certificate_type_id: data.certTypeId,
        expiry_date: data.expiryDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-certificates'] });
      toast({ title: 'Certifikat tillagt' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const removeCertificate = useMutation({
    mutationFn: async (certId: string) => {
      const { error } = await supabase.from('user_certificates').delete().eq('id', certId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-certificates'] });
      toast({ title: 'Certifikat borttaget' });
    },
  });

  const addInduction = useMutation({
    mutationFn: async ({ userId, vesselId }: { userId: string; vesselId: string }) => {
      const { error } = await supabase.from('user_vessel_inductions').insert({ user_id: userId, vessel_id: vesselId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-inductions'] });
      toast({ title: 'Inskolning tillagd' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const removeInduction = useMutation({
    mutationFn: async (inductionId: string) => {
      const { error } = await supabase.from('user_vessel_inductions').delete().eq('id', inductionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-inductions'] });
      toast({ title: 'Inskolning borttagen' });
    },
  });

  const selectedUser = profiles?.find(p => p.user_id === selectedUserId);
  const selectedUserRoles = userRoles?.filter(r => r.user_id === selectedUserId) || [];
  const selectedUserCerts = userCertificates?.filter(c => c.user_id === selectedUserId) || [];
  const selectedUserInductions = inductions?.filter(i => i.user_id === selectedUserId) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Användare</h1>
          <p className="text-muted-foreground mt-1">Hantera användare, roller, certifikat och inskolningar</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Användare
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profiles?.map(profile => (
                  <button
                    key={profile.user_id}
                    onClick={() => setSelectedUserId(profile.user_id)}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      selectedUserId === profile.user_id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium">{profile.full_name}</p>
                    <p className="text-xs opacity-70">{profile.email}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedUser ? (
              <>
                <CardHeader>
                  <CardTitle>{selectedUser.full_name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="roles">
                    <TabsList>
                      <TabsTrigger value="roles">
                        <Shield className="h-4 w-4 mr-1" />
                        Roller
                      </TabsTrigger>
                      <TabsTrigger value="certificates">
                        <Award className="h-4 w-4 mr-1" />
                        Certifikat
                      </TabsTrigger>
                      <TabsTrigger value="inductions">
                        <Ship className="h-4 w-4 mr-1" />
                        Inskolningar
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="roles" className="space-y-4 mt-4">
                      <div className="flex gap-2 flex-wrap">
                        {selectedUserRoles.map(role => (
                          <Badge key={role.id} variant="secondary" className="gap-1">
                            {APP_ROLE_LABELS[role.role as AppRole]}
                            <button onClick={() => removeRole.mutate(role.id)} className="ml-1 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Select onValueChange={v => addRole.mutate({ userId: selectedUserId!, role: v as AppRole })}>
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Lägg till roll" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(APP_ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TabsContent>

                    <TabsContent value="certificates" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        {selectedUserCerts.map(cert => (
                          <div key={cert.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <p className="font-medium">{(cert as any).certificate_type?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Utgår: {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeCertificate.mutate(cert.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <AddCertificateDialog
                        certificateTypes={certificateTypes || []}
                        onAdd={(certTypeId, expiryDate) => addCertificate.mutate({ userId: selectedUserId!, certTypeId, expiryDate })}
                      />
                    </TabsContent>

                    <TabsContent value="inductions" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        {selectedUserInductions.map(ind => (
                          <div key={ind.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                            <div>
                              <p className="font-medium">{(ind as any).vessel?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                Inskolad: {format(new Date(ind.inducted_at), 'yyyy-MM-dd')}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeInduction.mutate(ind.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Select onValueChange={v => addInduction.mutate({ userId: selectedUserId!, vesselId: v })}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Lägg till inskolning" />
                        </SelectTrigger>
                        <SelectContent>
                          {vessels?.map(v => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="py-12 text-center text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Välj en användare för att se detaljer</p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}

function AddCertificateDialog({
  certificateTypes,
  onAdd,
}: {
  certificateTypes: { id: string; name: string }[];
  onAdd: (certTypeId: string, expiryDate: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [certTypeId, setCertTypeId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const handleAdd = () => {
    if (certTypeId && expiryDate) {
      onAdd(certTypeId, expiryDate);
      setOpen(false);
      setCertTypeId('');
      setExpiryDate('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Lägg till certifikat
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till certifikat</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Certifikattyp</Label>
            <Select value={certTypeId} onValueChange={setCertTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj typ" />
              </SelectTrigger>
              <SelectContent>
                {certificateTypes.map(ct => (
                  <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Utgångsdatum</Label>
            <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          </div>
          <Button onClick={handleAdd} disabled={!certTypeId || !expiryDate} className="w-full">
            Lägg till
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
