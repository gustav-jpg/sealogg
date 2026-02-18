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
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  CONTROL_TYPE_LABELS,
  CONTROL_STATUS_LABELS,
  ControlType,
  ControlStatus,
} from '@/lib/types';
import { format, addMonths, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock, Calendar, Gauge, Eye, Check, History, Printer, FolderOpen, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { HistorySection } from '@/components/selfcontrol/HistorySection';
import { SparePartsTab } from '@/components/spare-parts/SparePartsTab';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePrint } from '@/hooks/usePrint';
import { useSharedVessel } from '@/hooks/useSharedVessel';

export default function SelfControl() {
  const { user, isAdmin } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const { selectedVessel, setSelectedVessel } = useSharedVessel();
  const [activeTab, setActiveTab] = useState('all');
  const [mainTab, setMainTab] = useState('kontroller');
  const [performDialogOpen, setPerformDialogOpen] = useState(false);
  const [selectedControlPoint, setSelectedControlPoint] = useState<any>(null);
  const [performDate, setPerformDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [performNotes, setPerformNotes] = useState('');
  const [performEngineHours, setPerformEngineHours] = useState('');
  const [performFiles, setPerformFiles] = useState<File[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [groupByCategory, setGroupByCategory] = useState(true);

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

  const { data: controlPoints } = useQuery({
    queryKey: ['control-points', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('control_points')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const controlPointIds = controlPoints?.map((cp) => cp.id) || [];

  const { data: controlPointVessels } = useQuery({
    queryKey: ['control-point-vessels', controlPointIds],
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

  const { data: vesselStates } = useQuery({
    queryKey: ['vessel-control-states', selectedVessel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessel_control_point_state')
        .select(`*, control_point:control_points(*), engine:vessel_engine_hours(*)`)
        .eq('vessel_id', selectedVessel);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVessel,
  });

  const { data: vesselEngines } = useQuery({
    queryKey: ['vessel-engines', selectedVessel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessel_engine_hours')
        .select('*')
        .eq('vessel_id', selectedVessel)
        .order('engine_type', { ascending: true })
        .order('engine_number', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVessel,
  });

  // Calculate applicable control points for selected vessel
  const applicableControlPoints = controlPoints?.filter((cp) => {
    if (cp.applies_to_all_vessels) return true;
    return controlPointVessels?.some((cpv) => cpv.control_point_id === cp.id && cpv.vessel_id === selectedVessel);
  }) || [];

  // Get or calculate state for each control point
  const controlPointsWithState = applicableControlPoints.map((cp) => {
    const existingState = vesselStates?.find((s) => s.control_point_id === cp.id);
    
    let status: ControlStatus = 'ok';
    let daysRemaining: number | null = null;
    let hoursRemaining: number | null = null;
    let nextDue: string | null = null;

    if (cp.type === 'calendar') {
      if (existingState?.next_due_date) {
        const nextDueDate = new Date(existingState.next_due_date);
        daysRemaining = differenceInDays(nextDueDate, new Date());
        nextDue = format(nextDueDate, 'yyyy-MM-dd');
        
        if (daysRemaining < 0) {
          status = 'forfallen';
        } else if (daysRemaining <= 30) {
          status = 'kommande';
        }
      } else {
        status = 'forfallen'; // Never done
        nextDue = 'Ej utförd';
      }
    } else if (cp.type === 'engine_hours') {
      const engine = existingState?.engine_id 
        ? vesselEngines?.find((e) => e.id === existingState.engine_id)
        : vesselEngines?.[0];
      
      const currentHours = engine?.current_hours || 0;
      
      if (existingState?.next_due_at_engine_hours) {
        hoursRemaining = existingState.next_due_at_engine_hours - currentHours;
        nextDue = `${existingState.next_due_at_engine_hours}h`;
        
        if (hoursRemaining < 0) {
          status = 'forfallen';
        } else if (cp.interval_engine_hours && hoursRemaining <= cp.interval_engine_hours * 0.1) {
          status = 'kommande';
        }
      } else {
        status = 'forfallen';
        nextDue = 'Ej utförd';
      }
    }

    return {
      ...cp,
      state: existingState,
      status,
      daysRemaining,
      hoursRemaining,
      nextDue,
    };
  });

  // Filter based on active tab
  const filteredControlPoints = controlPointsWithState.filter((cp) => {
    switch (activeTab) {
      case 'upcoming': return cp.status === 'kommande';
      case 'overdue': return cp.status === 'forfallen';
      default: return true;
    }
  });

  const overdueCount = controlPointsWithState.filter((cp) => cp.status === 'forfallen').length;
  const upcomingCount = controlPointsWithState.filter((cp) => cp.status === 'kommande').length;

  // Group by category
  const groupedControlPoints = filteredControlPoints.reduce((groups, cp) => {
    const categoryName = cp.category || 'Övrigt';
    if (!groups[categoryName]) {
      groups[categoryName] = [];
    }
    groups[categoryName].push(cp);
    return groups;
  }, {} as Record<string, typeof filteredControlPoints>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedControlPoints).sort((a, b) => a.localeCompare(b, 'sv'));

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const expandAllCategories = () => {
    setExpandedCategories(new Set(sortedCategories));
  };

  const collapseAllCategories = () => {
    setExpandedCategories(new Set());
  };

  const performControl = useMutation({
    mutationFn: async () => {
      if (!selectedControlPoint || !selectedVessel) return;

      const cp = selectedControlPoint;
      const engine = selectedEngineId 
        ? vesselEngines?.find(e => e.id === selectedEngineId)
        : vesselEngines?.[0];
      const engineHoursValue = performEngineHours ? parseInt(performEngineHours) : (engine?.current_hours || 0);

      // Create record
      const { data: record, error: recordError } = await supabase
        .from('control_point_records')
        .insert({
          control_point_id: cp.id,
          vessel_id: selectedVessel,
          engine_id: cp.type === 'engine_hours' && engine ? engine.id : null,
          performed_by: user?.id,
          performed_at: performDate,
          engine_hours_at_perform: cp.type === 'engine_hours' ? engineHoursValue : null,
          notes: performNotes || null,
        })
        .select()
        .single();

      if (recordError) throw recordError;

      // Upload files
      for (const file of performFiles) {
        const filePath = `control-points/${record.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath);

          // organization_id is auto-set by trigger from record_id -> vessel
          await supabase.from('control_point_attachments').insert({
            record_id: record.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            uploaded_by: user?.id,
          } as any);
        }
      }

      // Update or create state
      const selectedEngine = selectedEngineId 
        ? vesselEngines?.find(e => e.id === selectedEngineId)
        : vesselEngines?.[0];
      
      const nextDueDate = cp.type === 'calendar' && cp.interval_months
        ? format(addMonths(new Date(performDate), cp.interval_months), 'yyyy-MM-dd')
        : null;

      const nextDueEngineHours = cp.type === 'engine_hours' && cp.interval_engine_hours
        ? engineHoursValue + cp.interval_engine_hours
        : null;

      const stateData = {
        vessel_id: selectedVessel,
        control_point_id: cp.id,
        engine_id: cp.type === 'engine_hours' && selectedEngine ? selectedEngine.id : null,
        last_done_date: performDate,
        last_done_at_engine_hours: cp.type === 'engine_hours' ? engineHoursValue : null,
        next_due_date: nextDueDate,
        next_due_at_engine_hours: nextDueEngineHours,
        status: 'ok' as ControlStatus,
      };

      // Find existing state for this control point and engine combination
      const existingState = vesselStates?.find((s) => 
        s.control_point_id === cp.id && 
        (cp.type !== 'engine_hours' || s.engine_id === (selectedEngine?.id || null))
      );
      
      if (existingState) {
        await supabase
          .from('vessel_control_point_state')
          .update(stateData)
          .eq('id', existingState.id);
      } else {
        await supabase
          .from('vessel_control_point_state')
          .insert(stateData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vessel-control-states', selectedVessel] });
      queryClient.invalidateQueries({ queryKey: ['control-point-records'] });
      toast({ title: 'Utförd', description: 'Kontrollen har markerats som utförd.' });
      setPerformDialogOpen(false);
      resetPerformForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetPerformForm = () => {
    setSelectedControlPoint(null);
    setPerformDate(format(new Date(), 'yyyy-MM-dd'));
    setPerformNotes('');
    setPerformEngineHours('');
    setPerformFiles([]);
    setSelectedEngineId('');
  };

  const openPerformDialog = (cp: any) => {
    setSelectedControlPoint(cp);
    
    // For engine_hours type, try to find the matching engine based on machine_name
    if (cp.type === 'engine_hours' && cp.machine_name && vesselEngines) {
      // Find engine that matches the control point's machine_name
      // The machine_name might be in format "VesselName: EngineName" or just "EngineName"
      const matchingEngine = vesselEngines.find((engine: any) => {
        const engineName = getEngineName(engine);
        // Direct match
        if (engineName === cp.machine_name) return true;
        // Check if machine_name ends with the engine name (format: "VesselName: EngineName")
        if (cp.machine_name.endsWith(`: ${engineName}`)) return true;
        // Check if machine_name contains the engine name
        if (cp.machine_name.includes(engineName)) return true;
        return false;
      });
      
      if (matchingEngine) {
        setSelectedEngineId(matchingEngine.id);
        setPerformEngineHours(matchingEngine.current_hours?.toString() || '0');
      } else {
        // Fallback to first engine if no match found
        const firstEngine = vesselEngines[0];
        if (firstEngine) {
          setSelectedEngineId(firstEngine.id);
          setPerformEngineHours(firstEngine.current_hours?.toString() || '0');
        } else {
          setSelectedEngineId('');
          setPerformEngineHours('0');
        }
      }
    } else {
      // For non-engine controls or if no vesselEngines, reset
      const firstEngine = vesselEngines?.[0];
      if (firstEngine) {
        setSelectedEngineId(firstEngine.id);
        setPerformEngineHours(firstEngine.current_hours?.toString() || '0');
      } else {
        setSelectedEngineId('');
        setPerformEngineHours('0');
      }
    }
    setPerformDialogOpen(true);
  };

  const getEngineName = (engine: any) => {
    if (!engine) return 'Okänd';
    const typeLabel = engine.engine_type === 'main' ? 'Huvudmaskin' : 'Generator';
    return engine.name || `${typeLabel} ${engine.engine_number}`;
  };

  const getStatusColor = (status: ControlStatus) => {
    switch (status) {
      case 'forfallen': return 'destructive';
      case 'kommande': return 'default';
      case 'ok': return 'secondary';
    }
  };

  const getStatusIcon = (status: ControlStatus) => {
    switch (status) {
      case 'forfallen': return <AlertTriangle className="h-4 w-4" />;
      case 'kommande': return <Clock className="h-4 w-4" />;
      case 'ok': return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">Underhåll och Egenkontroll</h1>
            <p className="text-muted-foreground text-sm mt-1">Planerade kontroller och service</p>
          </div>
          {selectedVessel && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => printContent('self-control-list', { 
                title: 'Underhåll och Egenkontroll',
                subtitle: vessels?.find(v => v.id === selectedVessel)?.name || ''
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Skriv ut</span>
            </Button>
          )}
        </div>

        {/* Vessel selector */}
        <Card>
          <CardContent className="py-4 md:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="whitespace-nowrap text-sm">Välj fartyg:</Label>
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue placeholder="Välj fartyg" />
                </SelectTrigger>
                <SelectContent>
                  {vessels?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!selectedVessel ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Välj ett fartyg för att se kontroller</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="kontroller" className="text-xs sm:text-sm">
                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                Kontroller
              </TabsTrigger>
              <TabsTrigger value="reservdelar" className="text-xs sm:text-sm">
                <Package className="h-4 w-4 mr-1.5" />
                Reservdelar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kontroller" className="mt-4 space-y-4 md:space-y-6">
            {/* Warnings */}
            {(overdueCount > 0 || upcomingCount > 0) && (
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                {overdueCount > 0 && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 md:pt-6 flex items-center gap-3 md:gap-4">
                      <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-destructive flex-shrink-0" />
                      <div>
                        <p className="font-medium text-destructive text-sm md:text-base">Förfallna kontroller</p>
                        <p className="text-xs md:text-sm text-muted-foreground">{overdueCount} kontroll(er)</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {upcomingCount > 0 && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="p-4 md:pt-6 flex items-center gap-3 md:gap-4">
                      <Clock className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                      <div>
                        <p className="font-medium text-primary text-sm md:text-base">Kommande kontroller</p>
                        <p className="text-xs md:text-sm text-muted-foreground">{upcomingCount} kontroll(er)</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tabs and list */}
            <div id="self-control-list">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
                <TabsTrigger value="all" className="text-xs sm:text-sm">Alla</TabsTrigger>
                <TabsTrigger value="upcoming" className="text-xs sm:text-sm">Kommande</TabsTrigger>
                <TabsTrigger value="overdue" className="text-xs sm:text-sm">Förfallna</TabsTrigger>
                <TabsTrigger value="history" className="text-xs sm:text-sm">
                  <History className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Historik</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                {filteredControlPoints.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Inga kontroller att visa</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3 md:space-y-4">
                    {/* Category controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={expandAllCategories}
                          className="text-xs"
                        >
                          Expandera
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={collapseAllCategories}
                          className="text-xs"
                        >
                          Minimera
                        </Button>
                      </div>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {sortedCategories.length} kategorier, {filteredControlPoints.length} kontroller
                      </span>
                    </div>

                    {/* Grouped control points */}
                    {sortedCategories.map((category) => {
                      const categoryPoints = groupedControlPoints[category];
                      const isExpanded = expandedCategories.has(category);
                      const categoryOverdue = categoryPoints.filter(cp => cp.status === 'forfallen').length;
                      const categoryUpcoming = categoryPoints.filter(cp => cp.status === 'kommande').length;

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
                              {categoryOverdue > 0 && (
                                <Badge variant="destructive" className="text-xs">{categoryOverdue}</Badge>
                              )}
                              {categoryUpcoming > 0 && (
                                <Badge variant="default" className="text-xs hidden sm:inline-flex">{categoryUpcoming} kommande</Badge>
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t">
                              {categoryPoints.map((cp) => (
                                <div key={cp.id} className="p-3 md:p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 md:gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-medium text-sm md:text-base">{cp.name}</span>
                                        {/* Show badges like checklists: green for days remaining, red for overdue */}
                                        {cp.nextDue === 'Ej utförd' && (
                                          <Badge variant="destructive" className="gap-1 text-xs">
                                            <AlertTriangle className="h-3 w-3" />
                                            Ej utförd
                                          </Badge>
                                        )}
                                        {cp.nextDue !== 'Ej utförd' && cp.daysRemaining !== null && cp.daysRemaining < 0 && (
                                          <Badge variant="destructive" className="gap-1 text-xs">
                                            <AlertTriangle className="h-3 w-3" />
                                            <span className="hidden sm:inline">Försenad </span>{Math.abs(cp.daysRemaining)}<span className="hidden sm:inline"> dagar</span><span className="sm:hidden">d</span>
                                          </Badge>
                                        )}
                                        {cp.nextDue !== 'Ej utförd' && cp.hoursRemaining !== null && cp.hoursRemaining < 0 && (
                                          <Badge variant="destructive" className="gap-1 text-xs">
                                            <AlertTriangle className="h-3 w-3" />
                                            <span className="hidden sm:inline">Försenad </span>{Math.abs(cp.hoursRemaining)}<span className="hidden sm:inline"> timmar</span><span className="sm:hidden">h</span>
                                          </Badge>
                                        )}
                                        {cp.nextDue !== 'Ej utförd' && cp.daysRemaining !== null && cp.daysRemaining >= 0 && (
                                          <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                                            <Clock className="h-3 w-3" />
                                            <span className="hidden sm:inline">Utför inom </span>{cp.daysRemaining}<span className="hidden sm:inline"> dagar</span><span className="sm:hidden">d</span>
                                          </Badge>
                                        )}
                                        {cp.nextDue !== 'Ej utförd' && cp.hoursRemaining !== null && cp.hoursRemaining >= 0 && (
                                          <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-xs">
                                            <Clock className="h-3 w-3" />
                                            <span className="hidden sm:inline">Utför inom </span>{cp.hoursRemaining}<span className="hidden sm:inline"> timmar</span><span className="sm:hidden">h</span>
                                          </Badge>
                                        )}
                                      </div>
                                      {cp.description && (
                                        <p className="text-xs md:text-sm text-muted-foreground mt-1 mb-2 line-clamp-2">{cp.description}</p>
                                      )}
                                      <div className="flex items-center gap-3 md:gap-4 text-xs md:text-sm text-muted-foreground">
                                        <span>
                                          {cp.type === 'calendar' 
                                            ? `${cp.interval_months} mån` 
                                            : `${cp.interval_engine_hours}h`}
                                        </span>
                                        {cp.nextDue !== 'Ej utförd' && (
                                          <span className="hidden sm:inline">Nästa: {cp.nextDue}</span>
                                        )}
                                      </div>
                                    </div>
                                    {isAdmin && (
                                      <Button variant="default" size="sm" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); openPerformDialog(cp); }}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Utför
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="mt-4">
                {controlPointsWithState.filter((cp) => cp.status === 'kommande').length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Inga kommande kontroller</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {controlPointsWithState.filter((cp) => cp.status === 'kommande').map((cp) => (
                      <Card key={cp.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-medium">{cp.name}</span>
                                  {cp.daysRemaining !== null && cp.daysRemaining >= 0 && (
                                    <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                                      <Clock className="h-3 w-3" />
                                      Utför inom {cp.daysRemaining} dagar
                                    </Badge>
                                  )}
                                  {cp.hoursRemaining !== null && cp.hoursRemaining >= 0 && (
                                    <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                                      <Clock className="h-3 w-3" />
                                      Utför inom {cp.hoursRemaining}h
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>Nästa: {cp.nextDue}</span>
                                </div>
                              </div>
                            {isAdmin && (
                              <Button variant="default" size="sm" onClick={() => openPerformDialog(cp)}>
                                <Check className="h-4 w-4 mr-1" />
                                Utför
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="overdue" className="mt-4">
                {controlPointsWithState.filter((cp) => cp.status === 'forfallen').length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Inga förfallna kontroller</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {controlPointsWithState.filter((cp) => cp.status === 'forfallen').map((cp) => (
                      <Card key={cp.id} className="hover:shadow-md transition-shadow border-destructive/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-medium">{cp.name}</span>
                                {cp.nextDue === 'Ej utförd' ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Ej utförd
                                  </Badge>
                                ) : (
                                  <>
                                    {cp.daysRemaining !== null && cp.daysRemaining < 0 && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Försenad {Math.abs(cp.daysRemaining)} dagar
                                      </Badge>
                                    )}
                                    {cp.hoursRemaining !== null && cp.hoursRemaining < 0 && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Försenad {Math.abs(cp.hoursRemaining)}h
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              {cp.nextDue !== 'Ej utförd' && (
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span>Förföll: {cp.nextDue}</span>
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <Button variant="destructive" size="sm" onClick={() => openPerformDialog(cp)}>
                                <Check className="h-4 w-4 mr-1" />
                                Utför nu
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <HistorySection
                  selectedVessel={selectedVessel}
                  controlPoints={applicableControlPoints}
                  getEngineName={getEngineName}
                />
              </TabsContent>
            </Tabs>
            </div>
            </TabsContent>

            <TabsContent value="reservdelar" className="mt-4">
              <SparePartsTab selectedVessel={selectedVessel} />
            </TabsContent>
          </Tabs>
        )}

        {/* Perform dialog */}
        <Dialog open={performDialogOpen} onOpenChange={setPerformDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Markera som utförd</DialogTitle>
            </DialogHeader>
            {selectedControlPoint && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  performControl.mutate();
                }}
                className="space-y-4"
              >
                <div className="p-3 rounded bg-muted/50">
                  <p className="font-medium">{selectedControlPoint.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedControlPoint.description}</p>
                </div>

                <div className="space-y-2">
                  <Label>Datum för utförande *</Label>
                  <Input type="date" value={performDate} onChange={(e) => setPerformDate(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">
                    Välj datum då kontrollen faktiskt utfördes. Kan vara ett tidigare datum vid import.
                  </p>
                </div>

                {selectedControlPoint.type === 'engine_hours' && vesselEngines && vesselEngines.length > 0 && (() => {
                  // Check if control point has a pre-defined machine that matches
                  // The machine_name might be in format "VesselName: EngineName" or just "EngineName"
                  const hasPredefinedMachine = selectedControlPoint.machine_name && 
                    vesselEngines.some((engine: any) => {
                      const engineName = getEngineName(engine);
                      if (engineName === selectedControlPoint.machine_name) return true;
                      if (selectedControlPoint.machine_name.endsWith(`: ${engineName}`)) return true;
                      if (selectedControlPoint.machine_name.includes(engineName)) return true;
                      return false;
                    });
                  
                  return (
                  <>
                    {hasPredefinedMachine ? (
                      // Show pre-defined machine as read-only
                      <div className="space-y-2">
                        <Label>Maskin</Label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <span className="text-sm font-medium">{selectedControlPoint.machine_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({vesselEngines.find(e => e.id === selectedEngineId)?.current_hours || 0}h)
                          </span>
                        </div>
                      </div>
                    ) : (
                      // Show dropdown only when no machine is pre-defined
                      <div className="space-y-2">
                        <Label>Välj maskin *</Label>
                        <Select value={selectedEngineId} onValueChange={(id) => {
                          setSelectedEngineId(id);
                          const engine = vesselEngines.find(e => e.id === id);
                          if (engine) {
                            setPerformEngineHours(engine.current_hours?.toString() || '0');
                          }
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj maskin" />
                          </SelectTrigger>
                          <SelectContent>
                            {vesselEngines.map((engine) => (
                              <SelectItem key={engine.id} value={engine.id}>
                                {getEngineName(engine)} ({engine.current_hours}h)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Maskintimmar vid utförande</Label>
                      <Input
                        type="number"
                        value={performEngineHours}
                        onChange={(e) => setPerformEngineHours(e.target.value)}
                        placeholder="Aktuella maskintimmar"
                      />
                    </div>
                  </>
                  );
                })()}

                <div className="space-y-2">
                  <Label>Anteckningar</Label>
                  <Textarea
                    value={performNotes}
                    onChange={(e) => setPerformNotes(e.target.value)}
                    rows={3}
                    placeholder="Eventuella noteringar..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bilagor (bilder & dokument)</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);
                      setPerformFiles(prev => [...prev, ...newFiles]);
                      e.target.value = ''; // Reset input to allow selecting same file again
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Bilder, PDF, Word, Excel m.m. Du kan välja flera filer.
                  </p>
                  {performFiles.length > 0 && (
                    <div className="space-y-2 mt-2">
                      <p className="text-sm font-medium">{performFiles.length} fil(er) valda:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {performFiles.map((file, index) => (
                          <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 p-2 bg-muted rounded text-sm">
                            <span className="truncate flex-1">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setPerformFiles(prev => prev.filter((_, i) => i !== index))}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setPerformDialogOpen(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={performControl.isPending}>
                    {performControl.isPending ? 'Sparar...' : 'Markera utförd'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}