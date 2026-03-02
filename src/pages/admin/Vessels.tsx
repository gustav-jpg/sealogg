import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Ship, Gauge, Search, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function AdminVessels() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mainEngineCount, setMainEngineCount] = useState(1);
  const [auxiliaryEngineCount, setAuxiliaryEngineCount] = useState(0);
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
      return { ...vessel, certCount: certs.length, expiredCount, expiringCount, engines, totalEngines };
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
      setName(''); setDescription(''); setMainEngineCount(1); setAuxiliaryEngineCount(0); setMaxPassengers('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

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
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
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
                    <TableHead className="w-[150px]">Certifikat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVessels.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? 'Inga fartyg matchar sökningen' : 'Inga fartyg ännu'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVessels.map(vessel => (
                      <TableRow
                        key={vessel.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/portal/admin/vessels/${vessel.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Ship className="h-5 w-5 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{vessel.name}</p>
                              {vessel.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">{vessel.description}</p>
                              )}
                            </div>
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
      </div>
    </MainLayout>
  );
}
