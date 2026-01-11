import { useState, useRef } from 'react';
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
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { APP_ROLE_LABELS, AppRole } from '@/lib/types';
import { User, Shield, Award, Ship, Plus, Trash2, FileText, Upload, ExternalLink, UserPlus, AlertTriangle, RefreshCw, Mail, Pencil, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';

export default function AdminUsers() {
  const { toast } = useToast();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; name: string } | null>(null);

  const { data: profiles } = useOrgProfiles(selectedOrgId);


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
    queryKey: ['vessels', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('vessels')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
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
    queryKey: ['certificate-types', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('certificate_types')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const addExternalUser = useMutation({
    mutationFn: async ({ fullName }: { fullName: string }) => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const { error } = await supabase.from('profiles').insert({
        full_name: fullName,
        is_external: true,
        user_id: null,
        organization_id: selectedOrgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      toast({ title: 'Extern besättning tillagd' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const invitePortalUserMutation = useMutation({
    mutationFn: async ({ email, fullName, role }: { email: string; fullName: string; role: AppRole }) => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const response = await supabase.functions.invoke('invite-portal-user', {
        body: { email, fullName, role, organizationId: selectedOrgId },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ 
        title: data.isNewUser 
          ? 'Nytt konto skapat!' 
          : 'Roll tillagd',
        description: data.isNewUser 
          ? 'Användaren får ett e-postmeddelande för att sätta lösenord.' 
          : 'Rollen har lagts till för befintlig användare.'
      });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const linkEmailMutation = useMutation({
    mutationFn: async ({ profileId, email, role }: { profileId: string; email: string; role?: AppRole }) => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const response = await supabase.functions.invoke('link-email-to-profile', {
        body: { profileId, email, role, organizationId: selectedOrgId },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast({ 
        title: 'E-post kopplad!', 
        description: 'Användaren får ett e-postmeddelande för att sätta lösenord.'
      });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteExternalUser = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      setSelectedProfileId(null);
      toast({ title: 'Extern besättning borttagen' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateProfileName = useMutation({
    mutationFn: async ({ profileId, fullName }: { profileId: string; fullName: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      toast({ title: 'Namn uppdaterat' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updatePreferredVessel = useMutation({
    mutationFn: async ({ profileId, vesselId }: { profileId: string; vesselId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_vessel_id: vesselId })
        .eq('id', profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-profiles', selectedOrgId] });
      queryClient.invalidateQueries({ queryKey: ['profiles-with-preferred'] });
      toast({ title: 'Föredragen båt uppdaterad' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
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
    mutationFn: async (data: { userId: string; certTypeId: string; expiryDate: string; file?: File }) => {
      let fileUrl: string | null = null;
      
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        const fileName = `${data.userId}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(fileName, data.file);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('certificates')
          .getPublicUrl(fileName);
        
        fileUrl = fileName; // Store the path, not the public URL since bucket is private
      }
      
      const { error } = await supabase.from('user_certificates').insert({
        profile_id: data.userId,
        certificate_type_id: data.certTypeId,
        expiry_date: data.expiryDate,
        file_url: fileUrl,
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

  const uploadCertificateFile = useMutation({
    mutationFn: async ({ certId, oderId, file }: { certId: string; oderId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${oderId}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { error } = await supabase.from('user_certificates')
        .update({ file_url: fileName })
        .eq('id', certId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-certificates'] });
      toast({ title: 'Fil uppladdad' });
    },
    onError: (error) => {
      toast({ title: 'Fel vid uppladdning', description: error.message, variant: 'destructive' });
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

  const renewCertificate = useMutation({
    mutationFn: async ({ certId, newExpiryDate, oldFileUrl, newFile, profileId }: { 
      certId: string; 
      newExpiryDate: string; 
      oldFileUrl: string | null;
      newFile: File;
      profileId: string;
    }) => {
      // Delete old file if exists
      if (oldFileUrl) {
        await supabase.storage.from('certificates').remove([oldFileUrl]);
      }
      
      // Upload new file
      const fileExt = newFile.name.split('.').pop();
      const fileName = `${profileId}/${crypto.randomUUID()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(fileName, newFile);
      
      if (uploadError) throw uploadError;
      
      // Update certificate record
      const { error } = await supabase
        .from('user_certificates')
        .update({ 
          expiry_date: newExpiryDate,
          file_url: fileName
        })
        .eq('id', certId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-certificates'] });
      toast({ title: 'Certifikat förnyat', description: 'Nytt certifikat har laddats upp.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const addInduction = useMutation({
    mutationFn: async ({ profileId, vesselId, inductedAt, file }: { profileId: string; vesselId: string; inductedAt: string; file?: File }) => {
      let documentUrl: string | null = null;
      
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profileId}/${vesselId}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('inductions')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        documentUrl = fileName;
      }
      
      const { error } = await supabase.from('user_vessel_inductions').insert({ 
        profile_id: profileId, 
        vessel_id: vesselId,
        inducted_at: inductedAt,
        document_url: documentUrl,
      });
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

  const selectedProfile = profiles?.find(p => p.id === selectedProfileId);
  const selectedUserRoles = selectedProfile?.user_id ? userRoles?.filter(r => r.user_id === selectedProfile.user_id) || [] : [];
  const selectedUserCerts = userCertificates?.filter(c => c.profile_id === selectedProfile?.id) || [];
  const selectedUserInductions = inductions?.filter(i => i.profile_id === selectedProfile?.id) || [];
  const isExternalUser = selectedProfile?.is_external === true;

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
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Användare
                </span>
                <div className="flex gap-1">
                  <InviteUserDialog 
                    onInvite={(data) => invitePortalUserMutation.mutate(data)} 
                    isLoading={invitePortalUserMutation.isPending}
                  />
                  <AddExternalUserDialog onAdd={(name) => addExternalUser.mutate({ fullName: name })} />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profiles?.map(profile => {
                  // Check for expiring certificates
                  const profileCerts = userCertificates?.filter(c => c.profile_id === profile.id) || [];
                  const today = new Date().toISOString().split('T')[0];
                  const warningDate = new Date();
                  warningDate.setMonth(warningDate.getMonth() + 2);
                  const warningDateStr = warningDate.toISOString().split('T')[0];
                  
                  const expiredCerts = profileCerts.filter(c => c.expiry_date < today);
                  const expiringCerts = profileCerts.filter(c => c.expiry_date >= today && c.expiry_date <= warningDateStr);
                  
                  const hasExpired = expiredCerts.length > 0;
                  const hasExpiring = expiringCerts.length > 0;
                  
                  return (
                    <button
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`w-full text-left p-2 rounded transition-colors ${
                        selectedProfileId === profile.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{profile.full_name}</p>
                        {profile.is_external && (
                          <Badge variant="outline" className="text-xs">Extern</Badge>
                        )}
                        {hasExpired && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Utgånget
                          </Badge>
                        )}
                        {!hasExpired && hasExpiring && (
                          <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Går ut snart
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs opacity-70">{profile.email || 'Ingen e-post'}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedProfile ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {selectedProfile.full_name}
                        <EditNameDialog 
                          profileId={selectedProfile.id}
                          currentName={selectedProfile.full_name}
                          onSave={(data) => updateProfileName.mutate(data)}
                          isLoading={updateProfileName.isPending}
                        />
                      </CardTitle>
                      {isExternalUser && (
                        <p className="text-sm text-muted-foreground mt-1">Extern besättning (ingen inloggning)</p>
                      )}
                    </div>
                  </div>
                  {isExternalUser && (
                    <div className="flex gap-2">
                      <LinkEmailDialog 
                        profileId={selectedProfile.id}
                        profileName={selectedProfile.full_name}
                        onLink={(data) => linkEmailMutation.mutate(data)}
                        isLoading={linkEmailMutation.isPending}
                      />
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => setDeleteConfirm({ 
                          open: true, 
                          type: 'user', 
                          id: selectedProfile.id, 
                          name: selectedProfile.full_name 
                        })}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Ta bort
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue={isExternalUser ? "certificates" : "roles"}>
                    <TabsList>
                      {!isExternalUser && (
                        <TabsTrigger value="roles">
                          <Shield className="h-4 w-4 mr-1" />
                          Approller
                        </TabsTrigger>
                      )}
                      <TabsTrigger value="certificates">
                        <Award className="h-4 w-4 mr-1" />
                        Certifikat
                      </TabsTrigger>
                      <TabsTrigger value="inductions">
                        <Ship className="h-4 w-4 mr-1" />
                        Inskolningar
                      </TabsTrigger>
                      <TabsTrigger value="settings">
                        <Settings className="h-4 w-4 mr-1" />
                        Inställningar
                      </TabsTrigger>
                    </TabsList>

                    {!isExternalUser && (
                      <TabsContent value="roles" className="space-y-4 mt-4">
                        <div className="flex gap-2 flex-wrap">
                          {selectedUserRoles.map(role => (
                            <Badge key={role.id} variant="secondary" className="gap-1">
                              {APP_ROLE_LABELS[role.role as AppRole]}
                              <button 
                                onClick={() => setDeleteConfirm({ 
                                  open: true, 
                                  type: 'role', 
                                  id: role.id, 
                                  name: APP_ROLE_LABELS[role.role as AppRole] 
                                })} 
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Select onValueChange={v => addRole.mutate({ userId: selectedProfile.user_id!, role: v as AppRole })}>
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
                    )}

                    <TabsContent value="certificates" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        {selectedUserCerts.map(cert => (
                          <CertificateItem
                            key={cert.id}
                            cert={cert}
                            oderId={selectedProfile.id}
                            onRemove={() => setDeleteConfirm({ 
                              open: true, 
                              type: 'certificate', 
                              id: cert.id, 
                              name: cert.certificate_type?.name || 'Certifikat' 
                            })}
                            onUpload={(file) => uploadCertificateFile.mutate({ 
                              certId: cert.id, 
                              oderId: selectedProfile.id, 
                              file 
                            })}
                            onRenew={(newDate, newFile) => renewCertificate.mutate({
                              certId: cert.id,
                              newExpiryDate: newDate,
                              oldFileUrl: cert.file_url,
                              newFile,
                              profileId: selectedProfile.id
                            })}
                          />
                        ))}
                      </div>
                      <AddCertificateDialog
                        certificateTypes={certificateTypes || []}
                        onAdd={(certTypeId, expiryDate, file) => addCertificate.mutate({ 
                          userId: selectedProfile.id, 
                          certTypeId, 
                          expiryDate,
                          file 
                        })}
                      />
                    </TabsContent>

                    <TabsContent value="inductions" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        {selectedUserInductions.map(ind => (
                          <InductionItem 
                            key={ind.id}
                            induction={ind}
                            onRemove={() => setDeleteConfirm({ 
                              open: true, 
                              type: 'induction', 
                              id: ind.id, 
                              name: (ind as any).vessel?.name || 'Inskolning' 
                            })}
                          />
                        ))}
                      </div>
                      <AddInductionDialog
                        vessels={vessels || []}
                        existingVesselIds={selectedUserInductions.map(i => i.vessel_id)}
                        onAdd={(vesselId, inductedAt, file) => addInduction.mutate({ 
                          profileId: selectedProfile.id, 
                          vesselId,
                          inductedAt,
                          file 
                        })}
                      />
                    </TabsContent>

                    <TabsContent value="settings" className="space-y-4 mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="preferred-vessel">Föredragen båt för sjödagar</Label>
                          <p className="text-sm text-muted-foreground">
                            Används vid rapportering till Transportstyrelsen om personen arbetat på flera båtar samma dag.
                          </p>
                          <Select 
                            value={selectedProfile.preferred_vessel_id || 'none'} 
                            onValueChange={(v) => updatePreferredVessel.mutate({ 
                              profileId: selectedProfile.id, 
                              vesselId: v === 'none' ? null : v 
                            })}
                          >
                            <SelectTrigger className="w-64">
                              <SelectValue placeholder="Välj båt" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Ingen föredragen båt</SelectItem>
                              {vessels?.map(vessel => (
                                <SelectItem key={vessel.id} value={vessel.id}>
                                  {vessel.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
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

        <ConfirmDialog
          open={deleteConfirm?.open || false}
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
          title={
            deleteConfirm?.type === 'user' ? 'Ta bort extern besättning' :
            deleteConfirm?.type === 'role' ? 'Ta bort roll' :
            deleteConfirm?.type === 'certificate' ? 'Ta bort certifikat' :
            deleteConfirm?.type === 'induction' ? 'Ta bort inskolning' : 'Bekräfta borttagning'
          }
          description={`Är du säker på att du vill ta bort "${deleteConfirm?.name}"? Detta går inte att ångra.`}
          confirmLabel="Ta bort"
          onConfirm={() => {
            if (deleteConfirm) {
              switch (deleteConfirm.type) {
                case 'user':
                  deleteExternalUser.mutate(deleteConfirm.id);
                  break;
                case 'role':
                  removeRole.mutate(deleteConfirm.id);
                  break;
                case 'certificate':
                  removeCertificate.mutate(deleteConfirm.id);
                  break;
                case 'induction':
                  removeInduction.mutate(deleteConfirm.id);
                  break;
              }
              setDeleteConfirm(null);
            }
          }}
        />
      </div>
    </MainLayout>
  );
}

function CertificateItem({
  cert,
  oderId,
  onRemove,
  onUpload,
  onRenew,
}: {
  cert: any;
  oderId: string;
  onRemove: () => void;
  onUpload: (file: File) => void;
  onRenew: (newDate: string, newFile: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renewFileInputRef = useRef<HTMLInputElement>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [renewFile, setRenewFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleRenewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRenewFile(file);
    }
  };

  const handleViewFile = async () => {
    if (cert.file_url) {
      const { data, error } = await supabase.storage
        .from('certificates')
        .createSignedUrl(cert.file_url, 3600); // 1 hour expiry
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const handleRenew = () => {
    if (newExpiryDate && renewFile) {
      onRenew(newExpiryDate, renewFile);
      setRenewDialogOpen(false);
      setNewExpiryDate('');
      setRenewFile(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const isExpired = cert.expiry_date < today;
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + 2);
  const isExpiring = cert.expiry_date >= today && cert.expiry_date <= warningDate.toISOString().split('T')[0];

  return (
    <div className={`flex items-center justify-between p-3 rounded ${isExpired ? 'bg-destructive/10 border border-destructive/30' : isExpiring ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted/50'}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{cert.certificate_type?.name}</p>
          {isExpired && (
            <Badge variant="destructive" className="text-xs">Utgånget</Badge>
          )}
          {isExpiring && !isExpired && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Går ut snart</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Utgår: {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}
        </p>
        {cert.file_url && (
          <button 
            onClick={handleViewFile}
            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
          >
            <FileText className="h-3 w-3" />
            Visa fil
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
        />
        <input
          type="file"
          ref={renewFileInputRef}
          onChange={handleRenewFileChange}
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
        />
        <Dialog open={renewDialogOpen} onOpenChange={(open) => {
          setRenewDialogOpen(open);
          if (!open) {
            setNewExpiryDate('');
            setRenewFile(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              title="Förnya certifikat"
              className={isExpired || isExpiring ? 'text-amber-600 hover:text-amber-700' : ''}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Förnya certifikat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Förnya <strong>{cert.certificate_type?.name}</strong> genom att ladda upp nytt certifikat och ange nytt utgångsdatum. Det gamla certifikatet raderas automatiskt.
              </p>
              <div className="space-y-2">
                <Label>Nytt utgångsdatum *</Label>
                <Input 
                  type="date" 
                  value={newExpiryDate} 
                  onChange={e => setNewExpiryDate(e.target.value)}
                  min={today}
                />
              </div>
              <div className="space-y-2">
                <Label>Nytt certifikat (fil) *</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => renewFileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Välj fil
                  </Button>
                  {renewFile && (
                    <span className="text-sm text-muted-foreground">{renewFile.name}</span>
                  )}
                </div>
              </div>
              <Button onClick={handleRenew} disabled={!newExpiryDate || !renewFile} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Förnya certifikat
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fileInputRef.current?.click()}
          title={cert.file_url ? "Ersätt fil" : "Ladda upp fil"}
        >
          <Upload className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AddCertificateDialog({
  certificateTypes,
  onAdd,
}: {
  certificateTypes: { id: string; name: string }[];
  onAdd: (certTypeId: string, expiryDate: string, file?: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [certTypeId, setCertTypeId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (certTypeId && expiryDate) {
      onAdd(certTypeId, expiryDate, file);
      setOpen(false);
      setCertTypeId('');
      setExpiryDate('');
      setFile(undefined);
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
          <div className="space-y-2">
            <Label>Certifikatfil (valfritt)</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => setFile(e.target.files?.[0])}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {file ? file.name : 'Välj fil'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF, JPG eller PNG</p>
          </div>
          <Button onClick={handleAdd} disabled={!certTypeId || !expiryDate} className="w-full">
            Lägg till
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserDialog({ 
  onInvite, 
  isLoading 
}: { 
  onInvite: (data: { email: string; fullName: string; role: AppRole }) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('skeppare');

  const handleInvite = () => {
    if (email.trim() && fullName.trim()) {
      onInvite({ email: email.trim(), fullName: fullName.trim(), role });
      setOpen(false);
      setEmail('');
      setFullName('');
      setRole('skeppare');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Bjud in med e-post">
          <Mail className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bjud in användare</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Namn</Label>
            <Input 
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
              placeholder="Ange fullständigt namn"
            />
          </div>
          <div className="space-y-2">
            <Label>E-post</Label>
            <Input 
              type="email"
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="anna@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Roll</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">{APP_ROLE_LABELS.admin}</SelectItem>
                <SelectItem value="skeppare">{APP_ROLE_LABELS.skeppare}</SelectItem>
                <SelectItem value="readonly">{APP_ROLE_LABELS.readonly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            Användaren får ett e-postmeddelande för att sätta lösenord och kan sedan logga in.
          </p>
          <Button onClick={handleInvite} disabled={!email.trim() || !fullName.trim() || isLoading} className="w-full">
            {isLoading ? 'Bjuder in...' : 'Bjud in'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddExternalUserDialog({ onAdd }: { onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setOpen(false);
      setName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Lägg till extern (utan e-post)">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till extern besättning</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Namn</Label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ange fullständigt namn"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Personen kan tilldelas valfri roll i loggböcker. Certifikatkrav valideras per fartyg.
          </p>
          <Button onClick={handleAdd} disabled={!name.trim()} className="w-full">
            Lägg till
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InductionItem({
  induction,
  onRemove,
}: {
  induction: any;
  onRemove: () => void;
}) {
  const handleViewFile = async () => {
    if (induction.document_url) {
      const { data } = await supabase.storage
        .from('inductions')
        .createSignedUrl(induction.document_url, 3600);
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded bg-muted/50">
      <div className="flex-1">
        <p className="font-medium">{induction.vessel?.name}</p>
        <p className="text-xs text-muted-foreground">
          Inskolad: {format(new Date(induction.inducted_at), 'yyyy-MM-dd')}
        </p>
        {induction.document_url && (
          <button 
            onClick={handleViewFile}
            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
          >
            <FileText className="h-3 w-3" />
            Visa dokument
            <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </div>
      <Button variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function AddInductionDialog({
  vessels,
  existingVesselIds,
  onAdd,
}: {
  vessels: { id: string; name: string }[];
  existingVesselIds: string[];
  onAdd: (vesselId: string, inductedAt: string, file?: File) => void;
}) {
  const [open, setOpen] = useState(false);
  const [vesselId, setVesselId] = useState('');
  const [inductedAt, setInductedAt] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [file, setFile] = useState<File | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (vesselId && inductedAt) {
      onAdd(vesselId, inductedAt, file);
      setOpen(false);
      setVesselId('');
      setInductedAt(format(new Date(), 'yyyy-MM-dd'));
      setFile(undefined);
    }
  };

  const availableVessels = vessels.filter(v => !existingVesselIds.includes(v.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={availableVessels.length === 0}>
          <Plus className="h-4 w-4 mr-1" />
          Lägg till inskolning
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till inskolning</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fartyg</Label>
            <Select value={vesselId} onValueChange={setVesselId}>
              <SelectTrigger>
                <SelectValue placeholder="Välj fartyg" />
              </SelectTrigger>
              <SelectContent>
                {availableVessels.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Inskolningsdatum</Label>
            <Input type="date" value={inductedAt} onChange={e => setInductedAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Inskolningsdokument (valfritt)</Label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={e => setFile(e.target.files?.[0])}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {file ? file.name : 'Välj fil'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">PDF, JPG eller PNG</p>
          </div>
          <Button onClick={handleAdd} disabled={!vesselId || !inductedAt} className="w-full">
            Lägg till
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinkEmailDialog({
  profileId,
  profileName,
  onLink,
  isLoading,
}: {
  profileId: string;
  profileName: string;
  onLink: (data: { profileId: string; email: string; role?: AppRole }) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AppRole>('skeppare');

  const handleLink = () => {
    if (email.trim()) {
      onLink({ profileId, email: email.trim(), role });
      setOpen(false);
      setEmail('');
      setRole('skeppare');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-1" />
          Koppla e-post
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Koppla e-post till {profileName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Genom att koppla en e-post kan <strong>{profileName}</strong> logga in i portalen. De får ett e-postmeddelande för att sätta sitt lösenord.
          </p>
          <div className="space-y-2">
            <Label>E-postadress</Label>
            <Input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="anna@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Roll i portalen</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skeppare">Skeppare</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="readonly">Endast läsning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleLink} disabled={!email.trim() || isLoading} className="w-full">
            {isLoading ? 'Kopplar...' : 'Koppla e-post'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditNameDialog({
  profileId,
  currentName,
  onSave,
  isLoading,
}: {
  profileId: string;
  currentName: string;
  onSave: (data: { profileId: string; fullName: string }) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);

  const handleSave = () => {
    if (name.trim() && name.trim() !== currentName) {
      onSave({ profileId, fullName: name.trim() });
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen) setName(currentName);
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ändra namn</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Fullständigt namn</Label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Anna Andersson"
            />
          </div>
          <Button onClick={handleSave} disabled={!name.trim() || name.trim() === currentName || isLoading} className="w-full">
            {isLoading ? 'Sparar...' : 'Spara'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
