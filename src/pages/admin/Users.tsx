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
import { User, Shield, Award, Ship, Plus, Trash2, FileText, Upload, ExternalLink, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; name: string } | null>(null);

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

  const addExternalUser = useMutation({
    mutationFn: async ({ fullName }: { fullName: string }) => {
      const { error } = await supabase.from('profiles').insert({
        full_name: fullName,
        is_external: true,
        user_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast({ title: 'Extern besättning tillagd' });
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
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      setSelectedProfileId(null);
      toast({ title: 'Extern besättning borttagen' });
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
                <AddExternalUserDialog onAdd={(name) => addExternalUser.mutate({ fullName: name })} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profiles?.map(profile => (
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
                    </div>
                    <p className="text-xs opacity-70">{profile.email || 'Ingen e-post'}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            {selectedProfile ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedProfile.full_name}</CardTitle>
                    {isExternalUser && (
                      <p className="text-sm text-muted-foreground mt-1">Extern besättning (ingen inloggning)</p>
                    )}
                  </div>
                  {isExternalUser && (
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
}: {
  cert: any;
  oderId: string;
  onRemove: () => void;
  onUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
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

  return (
    <div className="flex items-center justify-between p-3 rounded bg-muted/50">
      <div className="flex-1">
        <p className="font-medium">{cert.certificate_type?.name}</p>
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
        <Button variant="outline" size="sm">
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
