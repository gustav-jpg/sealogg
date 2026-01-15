import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Ship, Trash2, Settings, Gauge, Pencil, Award, Upload, FileText, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function AdminVessels() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [engineDialogOpen, setEngineDialogOpen] = useState(false);
  const [certDialogOpen, setCertDialogOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<{ id: string; name: string; main_engine_count: number; auxiliary_engine_count: number } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mainEngineCount, setMainEngineCount] = useState(1);
  const [auxiliaryEngineCount, setAuxiliaryEngineCount] = useState(0);
  const [engineHoursInputs, setEngineHoursInputs] = useState<{ engine_type: string; engine_number: number; current_hours: number; name: string }[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; vessel: { id: string; name: string } | null }>({ open: false, vessel: null });

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

  const vesselIds = vessels?.map((v) => v.id) || [];


  const { data: vesselEngineHours } = useQuery({
    queryKey: ['vessel-engine-hours', vesselIds],
    enabled: vesselIds.length > 0,
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_engine_hours')
        .select('*')
        .in('vessel_id', vesselIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: vesselCertificates } = useQuery({
    queryKey: ['vessel-certificates', vesselIds],
    enabled: vesselIds.length > 0,
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_certificates')
        .select('*')
        .in('vessel_id', vesselIds)
        .order('expiry_date');
      if (error) throw error;
      return data;
    },
  });

  const createVessel = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      
      const { data: vessel, error: vesselError } = await supabase
        .from('vessels')
        .insert({ 
          name, 
          description: description || null,
          main_engine_count: mainEngineCount,
          auxiliary_engine_count: auxiliaryEngineCount,
          organization_id: selectedOrgId
        })
        .select()
        .single();
      if (vesselError) throw vesselError;

      // Skapa engine hours records för alla maskiner
      const engineRecords = [];
      for (let i = 1; i <= mainEngineCount; i++) {
        engineRecords.push({ vessel_id: vessel.id, engine_type: 'main', engine_number: i, current_hours: 0, name: `Huvudmaskin ${i}` });
      }
      for (let i = 1; i <= auxiliaryEngineCount; i++) {
        engineRecords.push({ vessel_id: vessel.id, engine_type: 'auxiliary', engine_number: i, current_hours: 0, name: `Hjälpmaskin ${i}` });
      }
      if (engineRecords.length > 0) {
        const { error: engineError } = await supabase.from('vessel_engine_hours').insert(engineRecords);
        if (engineError) throw engineError;
      }

      return vessel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      toast({ title: 'Skapat', description: 'Fartyget har skapats.' });
      setDialogOpen(false);
      setName('');
      setDescription('');
      setMainEngineCount(1);
      setAuxiliaryEngineCount(0);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateEngineHours = useMutation({
    mutationFn: async () => {
      if (!selectedVessel) throw new Error('Inget fartyg valt');
      
      for (const input of engineHoursInputs) {
        const { error } = await supabase
          .from('vessel_engine_hours')
          .upsert({
            vessel_id: selectedVessel.id,
            engine_type: input.engine_type,
            engine_number: input.engine_number,
            current_hours: input.current_hours,
            name: input.name || null,
            updated_at: new Date().toISOString()
          }, { onConflict: 'vessel_id,engine_type,engine_number' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      toast({ title: 'Sparat', description: 'Maskintimmar uppdaterade.' });
      setEngineDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openEngineDialog = (vessel: { id: string; name: string; main_engine_count: number; auxiliary_engine_count: number }) => {
    setSelectedVessel(vessel);
    const existingHours = vesselEngineHours?.filter(h => h.vessel_id === vessel.id) || [];
    const inputs: { engine_type: string; engine_number: number; current_hours: number; name: string }[] = [];
    
    for (let i = 1; i <= vessel.main_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      inputs.push({ 
        engine_type: 'main', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Huvudmaskin ${i}`
      });
    }
    for (let i = 1; i <= vessel.auxiliary_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      inputs.push({ 
        engine_type: 'auxiliary', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Hjälpmaskin ${i}`
      });
    }
    
    setEngineHoursInputs(inputs);
    setEngineDialogOpen(true);
  };

  const deleteVessel = useMutation({
    mutationFn: async (vesselId: string) => {
      const { error } = await supabase.from('vessels').delete().eq('id', vesselId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      toast({ title: 'Borttaget', description: 'Fartyget har tagits bort.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });


  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Fartyg</h1>
            <p className="text-muted-foreground mt-1">Hantera fartyg och certifikat</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nytt fartyg
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Skapa fartyg</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn *</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="T.ex. MS Charm" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Beskrivning</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="mainEngines">Antal huvudmaskiner</Label>
                    <Input id="mainEngines" type="number" min={0} value={mainEngineCount} onChange={e => setMainEngineCount(parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auxEngines">Antal hjälpmaskiner</Label>
                    <Input id="auxEngines" type="number" min={0} value={auxiliaryEngineCount} onChange={e => setAuxiliaryEngineCount(parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <Button onClick={() => createVessel.mutate()} disabled={!name || createVessel.isPending} className="w-full">
                  {createVessel.isPending ? 'Skapar...' : 'Skapa fartyg'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vessels?.map(vessel => {
            const vesselCerts = vesselCertificates?.filter(c => c.vessel_id === vessel.id) || [];
            const today = new Date().toISOString().split('T')[0];
            const warningDate = new Date();
            warningDate.setMonth(warningDate.getMonth() + 2);
            const warningDateStr = warningDate.toISOString().split('T')[0];
            
            return (
              <Card key={vessel.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/30">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Ship className="h-5 w-5 text-primary" />
                      {vessel.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteConfirm({ open: true, vessel: { id: vessel.id, name: vessel.name } })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardTitle>
                  {vessel.description && (
                    <p className="text-sm text-muted-foreground">{vessel.description}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Maskiner */}
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {vessel.main_engine_count} huvudmaskin{vessel.main_engine_count !== 1 ? 'er' : ''}
                        {vessel.auxiliary_engine_count > 0 && (
                          <span className="text-muted-foreground"> + {vessel.auxiliary_engine_count} hjälp</span>
                        )}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEngineDialog(vessel)}>
                      <Settings className="h-3.5 w-3.5 mr-1" />
                      Timmar
                    </Button>
                  </div>
                  
                  {/* Certifikat - med färgkodade namn */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                        <Award className="h-3 w-3" />
                        Certifikat
                      </p>
                      {vesselCerts.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Inga certifikat</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {vesselCerts.map(cert => {
                            const isExpired = cert.expiry_date < today;
                            const isExpiring = cert.expiry_date >= today && cert.expiry_date <= warningDateStr;
                            
                            return (
                              <Badge 
                                key={cert.id}
                                variant={isExpired ? "destructive" : isExpiring ? "secondary" : "default"}
                                className={`text-xs ${
                                  isExpiring 
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
                                    : !isExpired 
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' 
                                      : ''
                                }`}
                              >
                                {cert.name}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                      setSelectedVessel(vessel);
                      setCertDialogOpen(true);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={engineDialogOpen} onOpenChange={setEngineDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Maskintimmar - {selectedVessel?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {engineHoursInputs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Gauge className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Inga maskiner konfigurerade</p>
                </div>
              ) : (
                <div className="divide-y">
                  {engineHoursInputs.map((input, index) => (
                    <div key={`${input.engine_type}-${input.engine_number}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={input.engine_type === 'main' ? 'default' : 'secondary'} className="text-xs">
                          {input.engine_type === 'main' ? 'Huvud' : 'Hjälp'} #{input.engine_number}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Namn</Label>
                          <Input
                            value={input.name}
                            onChange={e => {
                              const updated = [...engineHoursInputs];
                              updated[index].name = e.target.value;
                              setEngineHoursInputs(updated);
                            }}
                            placeholder={input.engine_type === 'main' ? `Huvudmaskin ${input.engine_number}` : `Hjälpmaskin ${input.engine_number}`}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Timmar</Label>
                          <Input
                            type="number"
                            min={0}
                            value={input.current_hours}
                            onChange={e => {
                              const updated = [...engineHoursInputs];
                              updated[index].current_hours = parseInt(e.target.value) || 0;
                              setEngineHoursInputs(updated);
                            }}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={() => updateEngineHours.mutate()} disabled={updateEngineHours.isPending || engineHoursInputs.length === 0} className="w-full">
                {updateEngineHours.isPending ? 'Sparar...' : 'Spara maskintimmar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        <VesselCertificatesDialog 
          open={certDialogOpen}
          onOpenChange={setCertDialogOpen}
          vessel={selectedVessel}
          certificates={vesselCertificates?.filter(c => c.vessel_id === selectedVessel?.id) || []}
          userId={user?.id}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['vessel-certificates'] });
          }}
        />

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ open, vessel: open ? deleteConfirm.vessel : null })}
          title="Ta bort fartyg"
          description={`Är du säker på att du vill ta bort "${deleteConfirm.vessel?.name}"? Detta går inte att ångra och all relaterad data (loggböcker, bemanningskrav, maskintimmar) kan påverkas.`}
          confirmLabel="Ta bort"
          onConfirm={() => {
            if (deleteConfirm.vessel) {
              deleteVessel.mutate(deleteConfirm.vessel.id);
              setDeleteConfirm({ open: false, vessel: null });
            }
          }}
        />
      </div>
    </MainLayout>
  );
}

function VesselCertificatesDialog({
  open,
  onOpenChange,
  vessel,
  certificates,
  userId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vessel: { id: string; name: string } | null;
  certificates: any[];
  userId?: string;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [file, setFile] = useState<File | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingCert, setEditingCert] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIssueDate, setEditIssueDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editIsIndefinite, setEditIsIndefinite] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteConfirmCert, setDeleteConfirmCert] = useState<{ id: string; name: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + 2);
  const warningDateStr = warningDate.toISOString().split('T')[0];

  const handleAdd = async () => {
    if (!vessel || !name || (!isIndefinite && !expiryDate)) return;
    
    setIsAdding(true);
    try {
      let fileUrl: string | null = null;
      
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${vessel.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('vessel-certificates')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        fileUrl = fileName;
      }
      
      const { error } = await supabase.from('vessel_certificates').insert({
        vessel_id: vessel.id,
        name,
        description: description || null,
        expiry_date: isIndefinite ? null : expiryDate,
        issue_date: issueDate || null,
        is_indefinite: isIndefinite,
        file_url: fileUrl,
        created_by: userId,
      });
      
      if (error) throw error;
      
      toast({ title: 'Certifikat tillagt' });
      setName('');
      setDescription('');
      setExpiryDate('');
      setIssueDate('');
      setIsIndefinite(false);
      setFile(undefined);
      setShowAddForm(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdate = async (certId: string) => {
    if (!editName) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('vessel_certificates')
        .update({
          name: editName,
          issue_date: editIssueDate || null,
          expiry_date: editIsIndefinite ? null : editExpiryDate || null,
          is_indefinite: editIsIndefinite,
          updated_at: new Date().toISOString(),
        })
        .eq('id', certId);
      
      if (error) throw error;
      
      toast({ title: 'Certifikat uppdaterat' });
      setEditingCert(null);
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = (cert: any) => {
    setEditingCert(cert.id);
    setEditName(cert.name);
    setEditIssueDate(cert.issue_date || '');
    setEditExpiryDate(cert.expiry_date || '');
    setEditIsIndefinite(cert.is_indefinite || false);
  };

  const handleDelete = async (certId: string) => {
    setIsDeleting(certId);
    try {
      const cert = certificates.find(c => c.id === certId);
      if (cert?.file_url) {
        await supabase.storage.from('vessel-certificates').remove([cert.file_url]);
      }
      
      const { error } = await supabase.from('vessel_certificates').delete().eq('id', certId);
      if (error) throw error;
      
      toast({ title: 'Certifikat borttaget' });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleViewFile = async (fileUrl: string) => {
    if (!fileUrl || fileUrl.trim() === '') {
      toast({ title: 'Fel', description: 'Inget dokument finns uppladdat', variant: 'destructive' });
      return;
    }
    
    // Open window immediately to avoid popup blocker
    const win = window.open('about:blank', '_blank');
    
    // Show loading message in the new window
    if (win) {
      win.document.write('<html><head><title>Laddar dokument...</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui;color:#666;">Laddar dokument...</body></html>');
    }
    
    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (win) win.close();
        toast({ title: 'Fel', description: 'Du måste vara inloggad', variant: 'destructive' });
        return;
      }

      // Build the edge function URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/serve-certificate?bucket=vessel-certificates&path=${encodeURIComponent(fileUrl)}`;
      
      // Fetch the file with auth header
      const response = await fetch(edgeFunctionUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Kunde inte hämta dokumentet');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      if (win) {
        win.location.href = blobUrl;
      } else {
        // Fallback if popup was blocked
        window.open(blobUrl, '_blank');
      }
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error: any) {
      if (win) win.close();
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fartygscertifikat - {vessel?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing certificates */}
          <div className="space-y-2">
            <Label>Befintliga certifikat</Label>
            {certificates.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">Inga certifikat tillagda ännu</p>
            ) : (
              certificates.map(cert => {
                const isExpired = !cert.is_indefinite && cert.expiry_date && cert.expiry_date < today;
                const isExpiring = !cert.is_indefinite && cert.expiry_date && cert.expiry_date >= today && cert.expiry_date <= warningDateStr;
                const isEditing = editingCert === cert.id;
                
                if (isEditing) {
                  return (
                    <div key={cert.id} className="p-3 rounded-lg bg-muted/50 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Namn</Label>
                        <Input 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Certifikatnamn"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Utfärdat</Label>
                        <Input 
                          type="date" 
                          value={editIssueDate} 
                          onChange={e => setEditIssueDate(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`edit-indefinite-${cert.id}`}
                          checked={editIsIndefinite}
                          onChange={e => setEditIsIndefinite(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <Label htmlFor={`edit-indefinite-${cert.id}`} className="text-sm">Tillsvidare (inget utgångsdatum)</Label>
                      </div>
                      {!editIsIndefinite && (
                        <div className="space-y-2">
                          <Label className="text-xs">Utgår</Label>
                          <Input 
                            type="date" 
                            value={editExpiryDate} 
                            onChange={e => setEditExpiryDate(e.target.value)}
                          />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleUpdate(cert.id)}
                          disabled={!editName || isUpdating}
                        >
                          {isUpdating ? 'Sparar...' : 'Spara'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setEditingCert(null)}
                        >
                          Avbryt
                        </Button>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={cert.id} className={`flex items-center justify-between p-3 rounded-lg ${isExpired ? 'bg-destructive/10' : isExpiring ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/50'}`}>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{cert.name}</span>
                        {cert.is_indefinite && <Badge variant="secondary" className="text-xs">Tillsvidare</Badge>}
                        {isExpired && <Badge variant="destructive" className="text-xs">Utgånget</Badge>}
                        {isExpiring && <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">Går ut snart</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {cert.issue_date && (
                          <p>Utfärdat: {format(new Date(cert.issue_date), 'yyyy-MM-dd')}</p>
                        )}
                        {cert.is_indefinite ? (
                          <p>Gäller tillsvidare</p>
                        ) : cert.expiry_date ? (
                          <p>Utgår: {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}</p>
                        ) : null}
                      </div>
                      {cert.description && <p className="text-xs text-muted-foreground">{cert.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {cert.file_url && cert.file_url.trim() !== '' ? (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewFile(cert.file_url);
                          }}
                          className="h-8 w-8"
                          title="Visa dokument"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div 
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground/50"
                          title="Inget dokument uppladdat"
                        >
                          <Lock className="h-4 w-4" />
                        </div>
                      )}
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startEditing(cert);
                        }}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteConfirmCert({ id: cert.id, name: cert.name });
                        }}
                        disabled={isDeleting === cert.id}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Add new certificate button & form */}
          <div className="border-t pt-4">
            {!showAddForm ? (
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowAddForm(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Lägg till certifikat
              </Button>
            ) : (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Lägg till nytt certifikat</Label>
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setName('');
                      setDescription('');
                      setExpiryDate('');
                      setIssueDate('');
                      setIsIndefinite(false);
                      setFile(undefined);
                    }}
                  >
                    Avbryt
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input 
                    placeholder="Certifikatnamn *" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Input 
                    placeholder="Beskrivning (valfritt)" 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Utfärdat (valfritt)</Label>
                  <Input 
                    type="date" 
                    value={issueDate} 
                    onChange={e => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="new-indefinite"
                    checked={isIndefinite}
                    onChange={e => setIsIndefinite(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="new-indefinite" className="text-sm">Tillsvidare (inget utgångsdatum)</Label>
                </div>
                {!isIndefinite && (
                  <div className="space-y-2">
                    <Label className="text-xs">Utgångsdatum *</Label>
                    <Input 
                      type="date" 
                      value={expiryDate} 
                      onChange={e => setExpiryDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">Fil (valfritt)</Label>
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
                <Button 
                  onClick={handleAdd} 
                  disabled={!name || (!isIndefinite && !expiryDate) || isAdding}
                  className="w-full"
                >
                  {isAdding ? 'Lägger till...' : 'Lägg till certifikat'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      
      <ConfirmDialog
        open={!!deleteConfirmCert}
        onOpenChange={(open) => !open && setDeleteConfirmCert(null)}
        title="Radera certifikat?"
        description={`Är du säker på att du vill radera certifikatet "${deleteConfirmCert?.name}"? Detta kan inte ångras.`}
        confirmLabel="Radera"
        onConfirm={() => {
          if (deleteConfirmCert) {
            handleDelete(deleteConfirmCert.id);
            setDeleteConfirmCert(null);
          }
        }}
      />
    </Dialog>
  );
}