import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  CONTROL_TYPE_LABELS,
  ControlType,
} from '@/lib/types';
import { Plus, Edit, Trash2, Calendar, Gauge, ClipboardCheck, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';

export default function ControlPoints() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingControlPoint, setEditingControlPoint] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedVesselFilter, setSelectedVesselFilter] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ControlType>('calendar');
  const [intervalMonths, setIntervalMonths] = useState('12');
  const [intervalEngineHours, setIntervalEngineHours] = useState('250');
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [machineName, setMachineName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState('');

  // Get user's organization
  const { data: userOrg } = useQuery({
    queryKey: ['user-organization', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
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

  const vesselIds = vessels?.map((v) => v.id) || [];

  const { data: allEngines } = useQuery({
    queryKey: ['all-engines', vesselIds],
    enabled: vesselIds.length > 0,
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_engine_hours')
        .select('*, vessels(name)')
        .in('vessel_id', vesselIds)
        .order('vessel_id')
        .order('engine_type')
        .order('engine_number');
      if (error) throw error;
      return data;
    },
  });

  const { data: controlPoints, isLoading } = useQuery({
    queryKey: ['control-points-admin', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('control_points')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const controlPointIds = controlPoints?.map((cp) => cp.id) || [];

  const { data: controlPointVessels } = useQuery({
    queryKey: ['control-point-vessels-admin', controlPointIds],
    enabled: controlPointIds.length > 0,
    queryFn: async () => {
      if (controlPointIds.length === 0) return [];
      const { data, error } = await supabase
        .from('control_point_vessels')
        .select('*')
        .in('control_point_id', controlPointIds);
      if (error) throw error;
      return data;
    },
  });

  const createControlPoint = useMutation({
    mutationFn: async () => {
      if (!userOrg?.organization_id) throw new Error('No organization found');
      if (!selectedVessel) throw new Error('Välj ett fartyg');
      
      const { data: cp, error } = await supabase
        .from('control_points')
        .insert({
          name,
          description: description || null,
          type,
          interval_months: type === 'calendar' ? parseInt(intervalMonths) : null,
          interval_engine_hours: type === 'engine_hours' ? parseInt(intervalEngineHours) : null,
          applies_to_all_vessels: false,
          is_active: isActive,
          machine_name: machineName || null,
          category: category || null,
          organization_id: userOrg.organization_id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add vessel association
      await supabase.from('control_point_vessels').insert({
        control_point_id: cp.id,
        vessel_id: selectedVessel,
      });

      return cp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['control-point-vessels'] });
      toast({ title: 'Skapad', description: 'Kontrollpunkten har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateControlPoint = useMutation({
    mutationFn: async () => {
      if (!editingControlPoint) return;
      if (!selectedVessel) throw new Error('Välj ett fartyg');

      const { error } = await supabase
        .from('control_points')
        .update({
          name,
          description: description || null,
          type,
          interval_months: type === 'calendar' ? parseInt(intervalMonths) : null,
          interval_engine_hours: type === 'engine_hours' ? parseInt(intervalEngineHours) : null,
          applies_to_all_vessels: false,
          is_active: isActive,
          machine_name: machineName || null,
          category: category || null,
        })
        .eq('id', editingControlPoint.id);

      if (error) throw error;

      // Update vessel association
      await supabase
        .from('control_point_vessels')
        .delete()
        .eq('control_point_id', editingControlPoint.id);

      await supabase.from('control_point_vessels').insert({
        control_point_id: editingControlPoint.id,
        vessel_id: selectedVessel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      queryClient.invalidateQueries({ queryKey: ['control-point-vessels'] });
      toast({ title: 'Uppdaterad', description: 'Kontrollpunkten har uppdaterats.' });
      setEditingControlPoint(null);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteControlPoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('control_points').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-points-admin'] });
      toast({ title: 'Raderad', description: 'Kontrollpunkten har raderats.' });
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setType('calendar');
    setIntervalMonths('12');
    setIntervalEngineHours('250');
    setSelectedVessel('');
    setMachineName('');
    setIsActive(true);
    setCategory('');
  };

  const openEditDialog = (cp: any) => {
    setEditingControlPoint(cp);
    setName(cp.name);
    setDescription(cp.description || '');
    setType(cp.type);
    setIntervalMonths(cp.interval_months?.toString() || '12');
    setIntervalEngineHours(cp.interval_engine_hours?.toString() || '250');
    setMachineName(cp.machine_name || '');
    setIsActive(cp.is_active);
    setCategory(cp.category || '');
    
    // Get the vessel for this control point
    const cpVessels = controlPointVessels?.filter((cpv) => cpv.control_point_id === cp.id) || [];
    setSelectedVessel(cpVessels[0]?.vessel_id || '');
  };


  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Namn *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="T.ex. Oljebyte huvudmaskin" />
      </div>

      <div className="space-y-2">
        <Label>Kategori</Label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="T.ex. Motor, Säkerhet, Skrov..." />
      </div>

      <div className="space-y-2">
        <Label>Beskrivning / Instruktion</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detaljerad beskrivning av kontrollen..." />
      </div>

      <div className="space-y-2">
        <Label>Typ *</Label>
        <Select value={type} onValueChange={(v) => setType(v as ControlType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="calendar">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Kalenderbaserad
              </span>
            </SelectItem>
            <SelectItem value="engine_hours">
              <span className="flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Maskintimmar
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === 'calendar' ? (
        <div className="space-y-2">
          <Label>Intervall (månader) *</Label>
          <Input type="number" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} min="1" placeholder="12" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Intervall (maskintimmar) *</Label>
            <Input type="number" value={intervalEngineHours} onChange={(e) => setIntervalEngineHours(e.target.value)} min="1" placeholder="250" />
          </div>
          <div className="space-y-2">
            <Label>Välj maskin</Label>
            <Select value={machineName || "__all__"} onValueChange={(v) => setMachineName(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Välj maskin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Alla maskiner</SelectItem>
                {allEngines?.map((engine) => {
                  const vesselName = (engine.vessels as any)?.name || '';
                  const engineLabel = engine.name || 
                    `${engine.engine_type === 'main' ? 'Huvudmaskin' : 'Generator'} ${engine.engine_number}`;
                  return (
                    <SelectItem key={engine.id} value={`${vesselName}: ${engineLabel}`}>
                      {vesselName}: {engineLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lämna tomt om kontrollen gäller alla maskiner
            </p>
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Fartyg *</Label>
        <Select value={selectedVessel} onValueChange={setSelectedVessel}>
          <SelectTrigger>
            <SelectValue placeholder="Välj fartyg..." />
          </SelectTrigger>
          <SelectContent>
            {vessels?.map((vessel) => (
              <SelectItem key={vessel.id} value={vessel.id}>
                {vessel.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label>Aktiv</Label>
        <Switch checked={isActive} onCheckedChange={setIsActive} />
      </div>
    </div>
  );

  // Filter control points by selected vessel
  const filteredControlPoints = controlPoints?.filter((cp) => {
    if (!selectedVesselFilter) return true;
    
    // Check if this control point applies to the selected vessel
    if (cp.applies_to_all_vessels) return true;
    
    const cpVessels = controlPointVessels?.filter((cpv) => cpv.control_point_id === cp.id) || [];
    return cpVessels.some((cpv) => cpv.vessel_id === selectedVesselFilter);
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Egenkontrollpunkter</h1>
            <p className="text-muted-foreground mt-1">Hantera kontrollpunkter och service</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny kontrollpunkt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Skapa kontrollpunkt</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createControlPoint.mutate();
                }}
              >
                {formContent}
                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createControlPoint.isPending || !name || !selectedVessel}>
                    {createControlPoint.isPending ? 'Skapar...' : 'Skapa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vessel Filter */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium whitespace-nowrap">Visa kontrollpunkter för:</Label>
              <Select value={selectedVesselFilter || "__all__"} onValueChange={(v) => setSelectedVesselFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Välj fartyg..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Alla fartyg</SelectItem>
                  {vessels?.map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVesselFilter && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedVesselFilter('')}>
                  Rensa filter
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        ) : filteredControlPoints?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {selectedVesselFilter 
                  ? 'Inga kontrollpunkter för detta fartyg' 
                  : 'Inga kontrollpunkter skapade'}
              </p>
            </CardContent>
          </Card>
        ) : (() => {
          // Group control points by category
          const grouped = filteredControlPoints?.reduce((acc, cp) => {
            const cat = cp.category || 'Okategoriserad';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(cp);
            return acc;
          }, {} as Record<string, typeof filteredControlPoints>);
          
          // Sort categories alphabetically, but put "Okategoriserad" last
          const sortedCategories = Object.keys(grouped || {}).sort((a, b) => {
            if (a === 'Okategoriserad') return 1;
            if (b === 'Okategoriserad') return -1;
            return a.localeCompare(b, 'sv');
          });
          
          const toggleCategory = (cat: string) => {
            setExpandedCategories(prev => {
              const next = new Set(prev);
              if (next.has(cat)) {
                next.delete(cat);
              } else {
                next.add(cat);
              }
              return next;
            });
          };

          const expandAll = () => setExpandedCategories(new Set(sortedCategories));
          const collapseAll = () => setExpandedCategories(new Set());
          
          return (
            <div className="space-y-3 md:space-y-4">
              {/* Category controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAll}
                    className="text-xs"
                  >
                    Expandera
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAll}
                    className="text-xs"
                  >
                    Minimera
                  </Button>
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {sortedCategories.length} kategorier, {filteredControlPoints?.length || 0} kontroller
                </span>
              </div>

              {/* Grouped control points */}
              {sortedCategories.map((category) => {
                const categoryPoints = grouped![category]!;
                const isExpanded = expandedCategories.has(category);

                return (
                  <Card key={category} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCategory(category)}
                    >
                      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <FolderOpen className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                        <span className="font-medium text-sm md:text-base">{category}</span>
                        <Badge variant="secondary" className="text-xs">{categoryPoints.length}</Badge>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t">
                        {categoryPoints.map((cp) => {
                          const cpVessels = controlPointVessels?.filter((cpv) => cpv.control_point_id === cp.id) || [];
                          const vesselNames = vessels?.filter((v) => cpVessels.some((cpv) => cpv.vessel_id === v.id)).map((v) => v.name) || [];
                          
                          return (
                            <div key={cp.id} className={`p-3 md:p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors ${!cp.is_active ? 'opacity-60' : ''}`}>
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 md:gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-medium text-sm md:text-base">{cp.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {cp.type === 'calendar' ? <Calendar className="h-3 w-3 mr-1" /> : <Gauge className="h-3 w-3 mr-1" />}
                                      {CONTROL_TYPE_LABELS[cp.type as ControlType]}
                                    </Badge>
                                    {!cp.is_active && <Badge variant="secondary" className="text-xs">Inaktiv</Badge>}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs md:text-sm text-muted-foreground flex-wrap">
                                    <span>
                                      Intervall: {cp.type === 'calendar' 
                                        ? `${cp.interval_months} mån` 
                                        : `${cp.interval_engine_hours}h`}
                                    </span>
                                    {vesselNames.length > 0 && (
                                      <span>{vesselNames.join(', ')}</span>
                                    )}
                                    {cp.machine_name && <span>Maskin: {cp.machine_name}</span>}
                                  </div>
                                  {cp.description && (
                                    <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-1">{cp.description}</p>
                                  )}
                                </div>
                                <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditDialog(cp); }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(cp.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          );
        })()}

        {/* Edit dialog */}
        <Dialog open={!!editingControlPoint} onOpenChange={(open) => !open && setEditingControlPoint(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redigera kontrollpunkt</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateControlPoint.mutate();
              }}
            >
              {formContent}
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingControlPoint(null)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={updateControlPoint.isPending || !name || !selectedVessel}>
                  {updateControlPoint.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="Radera kontrollpunkt"
          description="Är du säker på att du vill radera denna kontrollpunkt? All historik kopplad till punkten kommer också att raderas."
          confirmLabel="Radera"
          onConfirm={() => deleteConfirmId && deleteControlPoint.mutate(deleteConfirmId)}
        />
      </div>
    </MainLayout>
  );
}