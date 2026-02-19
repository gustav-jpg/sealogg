import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Ship, Trash2, Settings, Gauge, Pencil, Award, Upload, FileText, Search, X, AlertTriangle, CheckCircle, Users } from 'lucide-react';
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
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedVessel, setSelectedVessel] = useState<{ id: string; name: string; description: string | null; main_engine_count: number; auxiliary_engine_count: number; primary_engine_id?: string | null } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mainEngineCount, setMainEngineCount] = useState(1);
  const [auxiliaryEngineCount, setAuxiliaryEngineCount] = useState(0);
  const [engineHoursInputs, setEngineHoursInputs] = useState<{ id?: string; engine_type: string; engine_number: number; current_hours: number; name: string }[]>([]);
  const [selectedPrimaryEngineId, setSelectedPrimaryEngineId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; vessel: { id: string; name: string } | null }>({ open: false, vessel: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [maxPassengers, setMaxPassengers] = useState<string>('');

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

  const today = new Date().toISOString().split('T')[0];
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + 2);
  const warningDateStr = warningDate.toISOString().split('T')[0];

  const processedVessels = useMemo(() => {
    if (!vessels) return [];
    return vessels.map(vessel => {
      const certs = vesselCertificates?.filter(c => c.vessel_id === vessel.id) || [];
      const expiredCount = certs.filter(c => !c.is_indefinite && c.expiry_date && c.expiry_date < today).length;
      const expiringCount = certs.filter(c => !c.is_indefinite && c.expiry_date && c.expiry_date >= today && c.expiry_date <= warningDateStr).length;
      const engines = vesselEngineHours?.filter(e => e.vessel_id === vessel.id) || [];
      const totalEngines = vessel.main_engine_count + vessel.auxiliary_engine_count;
      return {
        ...vessel,
        certCount: certs.length,
        expiredCount,
        expiringCount,
        engines,
        totalEngines,
      };
    });
  }, [vessels, vesselCertificates, vesselEngineHours, today, warningDateStr]);

  const filteredVessels = useMemo(() => {
    if (!searchQuery.trim()) return processedVessels;
    const q = searchQuery.toLowerCase();
    return processedVessels.filter(v =>
      v.name.toLowerCase().includes(q) ||
      (v.description && v.description.toLowerCase().includes(q))
    );
  }, [processedVessels, searchQuery]);

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
          organization_id: selectedOrgId,
          max_passengers: maxPassengers ? parseInt(maxPassengers) : null,
        })
        .select()
        .single();
      if (vesselError) throw vesselError;

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
      setMaxPassengers('');
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
      queryClient.invalidateQueries({ queryKey: ['vessels'] });
      toast({ title: 'Sparat', description: 'Maskintimmar uppdaterade.' });
      setEngineDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openEngineDialog = (vessel: { id: string; name: string; main_engine_count: number; auxiliary_engine_count: number; primary_engine_id?: string | null }) => {
    setSelectedVessel({ ...vessel, description: null });
    const existingHours = vesselEngineHours?.filter(h => h.vessel_id === vessel.id) || [];
    const inputs: { id?: string; engine_type: string; engine_number: number; current_hours: number; name: string }[] = [];
    
    for (let i = 1; i <= vessel.main_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      inputs.push({ 
        id: existing?.id,
        engine_type: 'main', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Huvudmaskin ${i}`
      });
    }
    for (let i = 1; i <= vessel.auxiliary_engine_count; i++) {
      const existing = existingHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      inputs.push({ 
        id: existing?.id,
        engine_type: 'auxiliary', 
        engine_number: i, 
        current_hours: existing?.current_hours || 0,
        name: existing?.name || `Hjälpmaskin ${i}`
      });
    }
    
    setEngineHoursInputs(inputs);
    setSelectedPrimaryEngineId(vessel.primary_engine_id || null);
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
      setDetailDialogOpen(false);
      setSelectedVessel(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openVesselDetail = (vessel: typeof processedVessels[0]) => {
    setSelectedVessel(vessel);
    setDetailDialogOpen(true);
  };

  const selectedVesselCerts = vesselCertificates?.filter(c => c.vessel_id === selectedVessel?.id) || [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Fartygsregister</h1>
            <p className="text-muted-foreground mt-1">Hantera fartyg, maskintimmar och certifikat</p>
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
                <div className="space-y-2">
                  <Label htmlFor="maxPax">Max passagerare</Label>
                  <Input id="maxPax" type="number" min={0} value={maxPassengers} onChange={e => setMaxPassengers(e.target.value)} placeholder="T.ex. 75" />
                </div>
                <Button onClick={() => createVessel.mutate()} disabled={!name || createVessel.isPending} className="w-full">
                  {createVessel.isPending ? 'Skapar...' : 'Skapa fartyg'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Sök på namn eller beskrivning..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            Visar {filteredVessels.length} av {processedVessels.length}
          </span>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-320px)] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fartyg</TableHead>
                    <TableHead className="w-[120px]">Maskiner</TableHead>
                    <TableHead className="w-[150px]">Certifikat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVessels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'Inga fartyg matchar sökningen' : 'Inga fartyg ännu'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVessels.map(vessel => (
                      <TableRow
                        key={vessel.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openVesselDetail(vessel)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Ship className="h-5 w-5 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{vessel.name}</p>
                              {vessel.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {vessel.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Gauge className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{vessel.totalEngines}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {vessel.expiredCount > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {vessel.expiredCount} utgångna
                            </Badge>
                          ) : vessel.expiringCount > 0 ? (
                            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              {vessel.expiringCount} går ut snart
                            </Badge>
                          ) : vessel.certCount > 0 ? (
                            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {vessel.certCount} cert.
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Inga</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={(open) => { setDetailDialogOpen(open); if (!open) setSelectedVessel(null); }}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            {selectedVessel && (
              <div className="space-y-6">
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Ship className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{selectedVessel.name}</DialogTitle>
                        {selectedVessel.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">{selectedVessel.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                {/* Maskiner */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Maskiner</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openEngineDialog(selectedVessel)}>
                      <Settings className="h-3.5 w-3.5 mr-1.5" />
                      Redigera timmar
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedVessel.main_engine_count} huvudmaskin{selectedVessel.main_engine_count !== 1 ? 'er' : ''}
                    {selectedVessel.auxiliary_engine_count > 0 && (
                      <span> + {selectedVessel.auxiliary_engine_count} hjälpmaskin{selectedVessel.auxiliary_engine_count !== 1 ? 'er' : ''}</span>
                    )}
                  </div>
                  {vesselEngineHours?.filter(e => e.vessel_id === selectedVessel.id).map(engine => (
                    <div key={engine.id} className="flex items-center justify-between text-sm">
                      <span>{engine.name || `${engine.engine_type === 'main' ? 'Huvudmaskin' : 'Hjälpmaskin'} ${engine.engine_number}`}</span>
                      <Badge variant="secondary">{engine.current_hours} h</Badge>
                    </div>
                  ))}
                  
                  {/* Primär maskin för bunkring */}
                  {vesselEngineHours?.filter(e => e.vessel_id === selectedVessel.id && e.engine_type === 'main').length > 0 && (
                    <div className="pt-3 mt-3 border-t space-y-2">
                      <Label className="text-sm font-medium">Primär maskin för bunkring</Label>
                      <p className="text-xs text-muted-foreground">Denna maskin används som standard vid registrering av bunkring i dagsrapporten.</p>
                      <Select 
                        value={selectedVessel.primary_engine_id || ''} 
                        onValueChange={async (val) => {
                          const newPrimaryId = val || null;
                          const { error } = await supabase
                            .from('vessels')
                            .update({ primary_engine_id: newPrimaryId })
                            .eq('id', selectedVessel.id);
                          if (error) {
                            toast({ title: 'Fel', description: error.message, variant: 'destructive' });
                          } else {
                            setSelectedVessel({ ...selectedVessel, primary_engine_id: newPrimaryId });
                            queryClient.invalidateQueries({ queryKey: ['vessels'] });
                            toast({ title: 'Sparat', description: 'Primär maskin uppdaterad.' });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj primär maskin" />
                        </SelectTrigger>
                        <SelectContent>
                          {vesselEngineHours
                            ?.filter(e => e.vessel_id === selectedVessel.id && e.engine_type === 'main')
                            .map(e => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.name || `Huvudmaskin ${e.engine_number}`}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Max passagerare */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Max passagerare</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Varning visas i loggbok och passagerarregistrering när antalet överskrids.</p>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Ej satt"
                    value={(selectedVessel as any).max_passengers ?? ''}
                    onChange={async (e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      const { error } = await supabase
                        .from('vessels')
                        .update({ max_passengers: val } as any)
                        .eq('id', selectedVessel.id);
                      if (error) {
                        toast({ title: 'Fel', description: error.message, variant: 'destructive' });
                      } else {
                        setSelectedVessel({ ...selectedVessel, max_passengers: val } as any);
                        queryClient.invalidateQueries({ queryKey: ['vessels'] });
                      }
                    }}
                    className="w-32"
                  />
                </div>

                {/* Certifikat */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Certifikat</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCertDialogOpen(true)}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Hantera
                    </Button>
                  </div>
                  {selectedVesselCerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Inga certifikat tillagda</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedVesselCerts.map(cert => {
                        const isExpired = !cert.is_indefinite && cert.expiry_date && cert.expiry_date < today;
                        const isExpiring = !cert.is_indefinite && cert.expiry_date && cert.expiry_date >= today && cert.expiry_date <= warningDateStr;
                        return (
                          <Badge
                            key={cert.id}
                            variant={isExpired ? 'destructive' : 'secondary'}
                            className={`text-xs ${
                              isExpiring
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                : !isExpired
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : ''
                            }`}
                          >
                            {cert.name}
                            {cert.expiry_date && !cert.is_indefinite && (
                              <span className="ml-1 opacity-70">
                                ({format(new Date(cert.expiry_date), 'yyyy-MM-dd')})
                              </span>
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteConfirm({ open: true, vessel: { id: selectedVessel.id, name: selectedVessel.name } })}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Ta bort fartyg
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Engine Hours Dialog */}
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
          certificates={selectedVesselCerts}
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
  const [editFile, setEditFile] = useState<File | undefined>();
  const [editExistingFileUrl, setEditExistingFileUrl] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteConfirmCert, setDeleteConfirmCert] = useState<{ id: string; name: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
    if (!editName || !vessel) return;
    
    setIsUpdating(true);
    try {
      let fileUrl: string | null | undefined = undefined; // undefined = no change
      
      // Upload new file if provided
      if (editFile) {
        const fileExt = editFile.name.split('.').pop();
        const fileName = `${vessel.id}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('vessel-certificates')
          .upload(fileName, editFile);
        
        if (uploadError) throw uploadError;
        
        // Delete old file if exists
        if (editExistingFileUrl) {
          await supabase.storage.from('vessel-certificates').remove([editExistingFileUrl]);
        }
        
        fileUrl = fileName;
      }
      
      const updateData: any = {
        name: editName,
        issue_date: editIssueDate || null,
        expiry_date: editIsIndefinite ? null : editExpiryDate || null,
        is_indefinite: editIsIndefinite,
        updated_at: new Date().toISOString(),
      };
      
      // Only update file_url if a new file was uploaded
      if (fileUrl !== undefined) {
        updateData.file_url = fileUrl;
      }
      
      const { error } = await supabase
        .from('vessel_certificates')
        .update(updateData)
        .eq('id', certId);
      
      if (error) throw error;
      
      toast({ title: 'Certifikat uppdaterat' });
      setEditingCert(null);
      setEditFile(undefined);
      setEditExistingFileUrl(null);
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
    setEditFile(undefined);
    setEditExistingFileUrl(cert.file_url || null);
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

    try {
      const { data, error } = await supabase.storage
        .from('vessel-certificates')
        .createSignedUrl(fileUrl, 300);

      if (error || !data?.signedUrl) {
        throw new Error('Kunde inte skapa länk till dokumentet');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const fullUrl = data.signedUrl.startsWith('http')
        ? data.signedUrl
        : `${supabaseUrl}/storage/v1${data.signedUrl}`;

      window.open(fullUrl, '_blank');
    } catch (error: any) {
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
                      {/* File upload for edit */}
                      <div className="space-y-2">
                        <Label className="text-xs">Dokument</Label>
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={e => setEditFile(e.target.files?.[0])}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editFileInputRef.current?.click()}
                            className="gap-2"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {editFile ? 'Byt fil' : editExistingFileUrl ? 'Ersätt dokument' : 'Ladda upp'}
                          </Button>
                          {editFile && (
                            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {editFile.name}
                            </span>
                          )}
                          {!editFile && editExistingFileUrl && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Dokument finns
                            </span>
                          )}
                        </div>
                      </div>
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
                          onClick={() => {
                            setEditingCert(null);
                            setEditFile(undefined);
                            setEditExistingFileUrl(null);
                          }}
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
                      {cert.file_url && cert.file_url.trim() !== '' && (
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