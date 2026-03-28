import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgCertificateTypes } from '@/hooks/useOrgCertificateTypes';
import { useQuery } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { WEATHER_STATIONS, UFS_CHARTS, getUFSChartsByRegion } from '@/lib/maritime-data';
import { Plus, Trash2, Award, GraduationCap, Settings, Building2, Wind, AlertTriangle, Save, Home, X, KeyRound, Copy } from 'lucide-react';

export default function SettingsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();

  // Certificate types state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  // Exercise categories state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: { id: string; name: string; type: 'cert' | 'exercise' } | null }>({ open: false, item: null });

  // Startsida settings state
  const [weatherStationId, setWeatherStationId] = useState('98040');
  const [smhiLon, setSmhiLon] = useState('19.5013');
  const [smhiLat, setSmhiLat] = useState('59.4428');
  const [chartNumbers, setChartNumbers] = useState<string[]>([]);

  const { data: certificateTypes } = useOrgCertificateTypes(selectedOrgId);

  const { data: organization } = useQuery({
    queryKey: ['organization-detail', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: registrationCode } = useQuery({
    queryKey: ['registration-code', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organization_registration_codes')
        .select('code, is_active')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: exerciseCategories } = useQuery({
    queryKey: ['exercise-categories', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('exercise_categories')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Fetch org settings for startsida
  const { data: orgSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['org-settings', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  useEffect(() => {
    if (orgSettings) {
      setWeatherStationId(orgSettings.weather_station_id || '98040');
      setSmhiLon(String(orgSettings.smhi_forecast_lon ?? '19.5013'));
      setSmhiLat(String(orgSettings.smhi_forecast_lat ?? '59.4428'));
      setChartNumbers(orgSettings.ufs_chart_numbers || []);
    }
  }, [orgSettings]);

  // Certificate type mutations
  const createCertType = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No organization found');
      const { error } = await supabase.from('certificate_types').insert({
        name: typeName,
        description: typeDescription || null,
        organization_id: selectedOrgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp skapad' });
      setTypeDialogOpen(false);
      setTypeName('');
      setTypeDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certificate_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp borttagen' });
      setDeleteConfirm({ open: false, item: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // Exercise category mutations
  const createCategory = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const { error } = await supabase
        .from('exercise_categories')
        .insert({ name: catName, description: catDescription || null, organization_id: selectedOrgId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Kategori skapad' });
      setCatDialogOpen(false);
      setCatName('');
      setCatDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Kategori borttagen' });
      setDeleteConfirm({ open: false, item: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const payload = {
        organization_id: selectedOrgId,
        weather_station_id: weatherStationId,
        weather_station_source: 'smhi',
        smhi_forecast_lon: parseFloat(smhiLon),
        smhi_forecast_lat: parseFloat(smhiLat),
        ufs_chart_numbers: chartNumbers,
      };
      const { error } = await supabase
        .from('organization_settings')
        .upsert(payload, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      toast({ title: 'Inställningar sparade' });
    },
    onError: (error) => {
      toast({ title: 'Kunde inte spara', description: String(error), variant: 'destructive' });
    },
  });

  const handleDeleteConfirm = () => {
    if (!deleteConfirm.item) return;
    if (deleteConfirm.item.type === 'cert') {
      deleteCertType.mutate(deleteConfirm.item.id);
    } else {
      deleteCategory.mutate(deleteConfirm.item.id);
    }
  };

  const removeChart = (chart: string) => {
    setChartNumbers(chartNumbers.filter(c => c !== chart));
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Inställningar
          </h1>
          <p className="text-muted-foreground mt-1">Hantera organisationsinställningar</p>
        </div>

        <Tabs defaultValue="organization" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Information
            </TabsTrigger>
            <TabsTrigger value="startsida" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Startsida
            </TabsTrigger>
            <TabsTrigger value="certificate-types" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Certifikatstyper
            </TabsTrigger>
            <TabsTrigger value="exercise-categories" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Övningskategorier
            </TabsTrigger>
          </TabsList>

          {/* Organization Info Tab */}
          <TabsContent value="organization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Rederi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Namn</Label>
                    <p className="font-medium">{organization?.name || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Org.nummer</Label>
                    <p className="font-medium">{organization?.org_number || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Kontakt e-post</Label>
                    <p className="font-medium">{organization?.contact_email || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Kontakt telefon</Label>
                    <p className="font-medium">{organization?.contact_phone || '–'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Registration code card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <KeyRound className="h-5 w-5" />
                  Registreringskod
                </CardTitle>
                <CardDescription>
                  Nya anställda anger denna kod på <span className="font-medium">sealogg.se/ny</span> för att registrera sig.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {registrationCode ? (
                  <div className="flex items-center gap-3">
                    <code className="text-3xl font-mono font-bold tracking-[0.3em] bg-muted px-4 py-2 rounded-lg">
                      {registrationCode.code}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(registrationCode.code);
                        toast({ title: 'Kopierad', description: 'Registreringskoden har kopierats.' });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Ingen registreringskod genererad.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Startsida Settings Tab */}
          <TabsContent value="startsida" className="space-y-4">
            {settingsLoading ? (
              <div className="h-40 bg-muted animate-pulse rounded-lg" />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wind className="h-5 w-5" />
                      Väderstation
                    </CardTitle>
                    <CardDescription>
                      Välj vilken väderstation som ska användas för vinddata och väderprognos på startsidan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Station</Label>
                      <Select
                        value={weatherStationId}
                        onValueChange={(val) => {
                          setWeatherStationId(val);
                          const station = WEATHER_STATIONS.find(s => s.id === val);
                          if (station) {
                            setSmhiLon(String(station.lon));
                            setSmhiLat(String(station.lat));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj väderstation" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEATHER_STATIONS.map(station => (
                            <SelectItem key={station.id} value={station.id}>
                              {station.name} (ID: {station.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        SMHI-koordinater uppdateras automatiskt vid stationsbyte. Nuvarande: {smhiLat}, {smhiLon}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5" />
                      UFS Sjökort
                    </CardTitle>
                    <CardDescription>
                      Välj vilka sjökortsnummer som ska visas för UFS-varningar på startsidan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {chartNumbers.length === 0 && (
                        <p className="text-sm text-muted-foreground">Inga sjökort valda</p>
                      )}
                      {chartNumbers.map(chart => {
                        const chartData = UFS_CHARTS.find(c => c.value === chart);
                        return (
                          <Badge key={chart} variant="secondary" className="text-sm py-1 px-3 gap-1">
                            {chartData ? chartData.label : chart}
                            <button onClick={() => removeChart(chart)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                    
                    {(() => {
                      const grouped = getUFSChartsByRegion();
                      return (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-md p-3">
                          {Object.entries(grouped).map(([region, charts]) => (
                            <div key={region}>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{region}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {charts.map(chart => {
                                  const isSelected = chartNumbers.includes(chart.value);
                                  return (
                                    <label key={chart.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setChartNumbers(prev => [...prev, chart.value]);
                                          } else {
                                            setChartNumbers(prev => prev.filter(c => c !== chart.value));
                                          }
                                        }}
                                      />
                                      {chart.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saveSettings.isPending ? 'Sparar...' : 'Spara inställningar'}
                </Button>
              </>
            )}
          </TabsContent>

          {/* Certificate Types Tab */}
          <TabsContent value="certificate-types" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Certifikatstyper</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Definiera vilka typer av certifikat besättningsmedlemmar kan ha, t.ex. behörigheter och utbildningar.
                    </p>
                  </div>
                  <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Lägg till
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Skapa certifikattyp</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="cert-name">Namn *</Label>
                          <Input
                            id="cert-name"
                            value={typeName}
                            onChange={(e) => setTypeName(e.target.value)}
                            placeholder="T.ex. Befäls Behörighet klass 6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cert-desc">Beskrivning</Label>
                          <Textarea
                            id="cert-desc"
                            value={typeDescription}
                            onChange={(e) => setTypeDescription(e.target.value)}
                          />
                        </div>
                        <Button
                          onClick={() => createCertType.mutate()}
                          disabled={!typeName || createCertType.isPending}
                          className="w-full"
                        >
                          {createCertType.isPending ? 'Skapar...' : 'Skapa'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {certificateTypes && certificateTypes.length > 0 ? (
                  <div className="space-y-1.5">
                    {certificateTypes.map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2.5">
                          <Award className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{ct.name}</p>
                            {ct.description && (
                              <p className="text-xs text-muted-foreground">{ct.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteConfirm({ open: true, item: { id: ct.id, name: ct.name, type: 'cert' } })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-6 text-sm">
                    Inga certifikattyper skapade ännu
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exercise Categories Tab */}
          <TabsContent value="exercise-categories" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Övningskategorier</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Hantera kategorier för säkerhetsövningar som kan loggas i loggboken, t.ex. MOB-övning eller brandövning.
                    </p>
                  </div>
                  <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Lägg till
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ny övningskategori</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="cat-name">Namn *</Label>
                          <Input
                            id="cat-name"
                            value={catName}
                            onChange={e => setCatName(e.target.value)}
                            placeholder="T.ex. MOB-övning"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cat-desc">Beskrivning</Label>
                          <Textarea
                            id="cat-desc"
                            value={catDescription}
                            onChange={e => setCatDescription(e.target.value)}
                            placeholder="Valfri beskrivning av övningen"
                            rows={3}
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => createCategory.mutate()}
                          disabled={createCategory.isPending || !catName.trim()}
                        >
                          {createCategory.isPending ? 'Skapar...' : 'Skapa kategori'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {exerciseCategories && exerciseCategories.length > 0 ? (
                  <div className="space-y-1.5">
                    {exerciseCategories.map(category => (
                      <div key={category.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2.5">
                          <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{category.name}</p>
                            {category.description && (
                              <p className="text-xs text-muted-foreground">{category.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteConfirm({ open: true, item: { id: category.id, name: category.name, type: 'exercise' } })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-6 text-sm">Inga övningskategorier skapade</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title={deleteConfirm.item?.type === 'cert' ? 'Ta bort certifikattyp' : 'Ta bort övningskategori'}
        description={`Är du säker på att du vill ta bort "${deleteConfirm.item?.name}"?`}
        confirmLabel="Ta bort"
        onConfirm={handleDeleteConfirm}
      />
    </MainLayout>
  );
}
