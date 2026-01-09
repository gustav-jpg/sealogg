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
import {
  CONTROL_TYPE_LABELS,
  CONTROL_STATUS_LABELS,
  ControlType,
  ControlStatus,
} from '@/lib/types';
import { format, addMonths, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock, Calendar, Gauge, Eye, Check, History, Printer, FolderOpen, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { usePrint } from '@/hooks/usePrint';

export default function SelfControl() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');
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
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: controlPoints } = useQuery({
    queryKey: ['control-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_points')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: controlPointVessels } = useQuery({
    queryKey: ['control-point-vessels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_point_vessels')
        .select('*');
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

  // Fetch control point records for history
  const { data: controlRecords } = useQuery({
    queryKey: ['control-point-records', selectedVessel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_point_records')
        .select(`
          *,
          control_point:control_points(*),
          engine:vessel_engine_hours(*),
          performer:profiles!control_point_records_performed_by_fkey(full_name)
        `)
        .eq('vessel_id', selectedVessel)
        .order('performed_at', { ascending: false })
        .limit(100);
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

          await supabase.from('control_point_attachments').insert({
            record_id: record.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            uploaded_by: user?.id,
          });
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
    // Pre-select the first engine if available
    const firstEngine = vesselEngines?.[0];
    if (firstEngine) {
      setSelectedEngineId(firstEngine.id);
      setPerformEngineHours(firstEngine.current_hours?.toString() || '0');
    } else {
      setSelectedEngineId('');
      setPerformEngineHours('0');
    }
    setPerformDialogOpen(true);
  };

  const getEngineName = (engine: any) => {
    if (!engine) return 'Okänd';
    const typeLabel = engine.engine_type === 'main' ? 'Huvudmaskin' : 'Hjälpmaskin';
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Egenkontroll</h1>
            <p className="text-muted-foreground mt-1">Planerade kontroller och service</p>
          </div>
          {selectedVessel && (
            <Button 
              variant="outline" 
              onClick={() => printContent('self-control-list', { 
                title: 'Egenkontrollprogram', 
                subtitle: vessels?.find(v => v.id === selectedVessel)?.name || ''
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
          )}
        </div>

        {/* Vessel selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Välj fartyg:</Label>
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="max-w-xs">
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
          <>
            {/* Warnings */}
            {(overdueCount > 0 || upcomingCount > 0) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {overdueCount > 0 && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="pt-6 flex items-center gap-4">
                      <AlertTriangle className="h-8 w-8 text-destructive" />
                      <div>
                        <p className="font-medium text-destructive">Förfallna kontroller</p>
                        <p className="text-sm text-muted-foreground">{overdueCount} kontroll(er) har passerat förfallodatum</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {upcomingCount > 0 && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="pt-6 flex items-center gap-4">
                      <Clock className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium text-primary">Kommande kontroller</p>
                        <p className="text-sm text-muted-foreground">{upcomingCount} kontroll(er) närmar sig förfallodatum</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tabs and list */}
            <div id="self-control-list">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Alla ({controlPointsWithState.length})</TabsTrigger>
                <TabsTrigger value="upcoming">Kommande ({upcomingCount})</TabsTrigger>
                <TabsTrigger value="overdue">Förfallna ({overdueCount})</TabsTrigger>
                <TabsTrigger value="history">
                  <History className="h-4 w-4 mr-1" />
                  Historik
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
                  <div className="space-y-4">
                    {/* Category controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={expandAllCategories}
                        >
                          Expandera alla
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={collapseAllCategories}
                        >
                          Kollapsa alla
                        </Button>
                      </div>
                      <span className="text-sm text-muted-foreground">
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
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <FolderOpen className="h-5 w-5 text-primary" />
                              <span className="font-medium">{category}</span>
                              <Badge variant="secondary">{categoryPoints.length}</Badge>
                              {categoryOverdue > 0 && (
                                <Badge variant="destructive">{categoryOverdue} förfallna</Badge>
                              )}
                              {categoryUpcoming > 0 && (
                                <Badge variant="default">{categoryUpcoming} kommande</Badge>
                              )}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t">
                              {categoryPoints.map((cp) => (
                                <div key={cp.id} className="p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-medium">{cp.name}</span>
                                        {/* Show status badges based on state */}
                                        {cp.status === 'forfallen' && cp.nextDue !== 'Ej utförd' && cp.daysRemaining !== null && cp.daysRemaining < 0 && (
                                          <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Försenad {Math.abs(cp.daysRemaining)} dagar
                                          </Badge>
                                        )}
                                        {cp.status === 'forfallen' && cp.nextDue !== 'Ej utförd' && cp.hoursRemaining !== null && cp.hoursRemaining < 0 && (
                                          <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Försenad {Math.abs(cp.hoursRemaining)}h
                                          </Badge>
                                        )}
                                        {cp.nextDue === 'Ej utförd' && (
                                          <Badge variant="destructive" className="gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Ej utförd
                                          </Badge>
                                        )}
                                        {cp.status === 'kommande' && cp.daysRemaining !== null && cp.daysRemaining >= 0 && (
                                          <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                                            <Clock className="h-3 w-3" />
                                            Utför inom {cp.daysRemaining} dagar
                                          </Badge>
                                        )}
                                        {cp.status === 'kommande' && cp.hoursRemaining !== null && cp.hoursRemaining >= 0 && (
                                          <Badge className="gap-1 bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                                            <Clock className="h-3 w-3" />
                                            Utför inom {cp.hoursRemaining}h
                                          </Badge>
                                        )}
                                        {/* No badge for 'ok' status - implied by lack of other badges */}
                                      </div>
                                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>
                                          Intervall: {cp.type === 'calendar' 
                                            ? `${cp.interval_months} mån` 
                                            : `${cp.interval_engine_hours}h`}
                                        </span>
                                        {cp.nextDue !== 'Ej utförd' && (
                                          <span>Nästa: {cp.nextDue}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="default" size="sm" onClick={(e) => { e.stopPropagation(); openPerformDialog(cp); }}>
                                        <Check className="h-4 w-4 mr-1" />
                                        Utför
                                      </Button>
                                    </div>
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
                            <Button variant="default" size="sm" onClick={() => openPerformDialog(cp)}>
                              <Check className="h-4 w-4 mr-1" />
                              Utför
                            </Button>
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
                            <Button variant="destructive" size="sm" onClick={() => openPerformDialog(cp)}>
                              <Check className="h-4 w-4 mr-1" />
                              Utför nu
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {!controlRecords || controlRecords.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Ingen historik ännu</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {controlRecords.map((record: any) => (
                      <Card key={record.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{record.control_point?.name || 'Okänd kontrollpunkt'}</span>
                                <Badge variant="secondary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Utförd
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span>Datum: {format(new Date(record.performed_at), 'yyyy-MM-dd', { locale: sv })}</span>
                                <span>Utförd av: {record.performer?.full_name || 'Okänd'}</span>
                                {record.engine_hours_at_perform && (
                                  <span>
                                    Maskintimmar: {record.engine_hours_at_perform}h
                                    {record.engine && ` (${getEngineName(record.engine)})`}
                                  </span>
                                )}
                              </div>
                              {record.notes && (
                                <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                                  {record.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
            </div>
          </>
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
                  <Label>Datum *</Label>
                  <Input type="date" value={performDate} onChange={(e) => setPerformDate(e.target.value)} required />
                </div>

                {selectedControlPoint.type === 'engine_hours' && vesselEngines && vesselEngines.length > 0 && (
                  <>
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
                )}

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
                  <Label>Bilagor</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setPerformFiles(Array.from(e.target.files || []))}
                  />
                  {performFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground">{performFiles.length} fil(er) valda</p>
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