import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, addDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardList, Play, AlertTriangle, Clock, CheckCircle, Calendar, RefreshCw, History, Eye, Check, X, MessageSquare, Camera, Filter, Trash2, FileDown, Loader2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useSharedVessel } from '@/hooks/useSharedVessel';

type ChecklistStatus = 'ok' | 'due_soon' | 'overdue';

interface ChecklistWithStatus {
  id: string;
  name: string;
  description: string | null;
  interval_days: number | null;
  applies_to_all_vessels: boolean;
  lastCompleted: string | null;
  nextDue: string | null;
  status: ChecklistStatus;
  daysRemaining: number | null;
  inProgressId: string | null;
}

export default function Checklists() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const vesselFromUrl = searchParams.get('vessel');
  
  const { selectedVessel, setSelectedVessel } = useSharedVessel(vesselFromUrl);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  const [abortConfirm, setAbortConfirm] = useState<{ open: boolean; executionId: string | null }>({
    open: false,
    executionId: null,
  });
  
  // History filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);

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

  const { data: checklistTemplates } = useQuery({
    queryKey: ['checklist-templates', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const templateIds = checklistTemplates?.map((t) => t.id) || [];

  const { data: templateVessels } = useQuery({
    queryKey: ['checklist-template-vessels', templateIds],
    enabled: templateIds.length > 0,
    queryFn: async () => {
      if (templateIds.length === 0) return [];
      const { data, error } = await supabase
        .from('checklist_template_vessels')
        .select('*')
        .in('checklist_template_id', templateIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: executions } = useQuery({
    queryKey: ['checklist-executions', selectedVessel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_executions')
        .select('*, checklist_templates(name)')
        .eq('vessel_id', selectedVessel)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVessel,
  });

  const { data: profiles } = useOrgProfiles(selectedOrgId);

  const { data: executionDetails } = useQuery({
    queryKey: ['execution-details', selectedExecution],
    queryFn: async () => {
      if (!selectedExecution) return null;
      
      const { data: execution, error: execError } = await supabase
        .from('checklist_executions')
        .select('*, checklist_templates(name, description)')
        .eq('id', selectedExecution)
        .single();
      if (execError) throw execError;

      const { data: steps, error: stepsError } = await supabase
        .from('checklist_steps')
        .select('*')
        .eq('checklist_template_id', execution.checklist_template_id)
        .order('step_order');
      if (stepsError) throw stepsError;

      const { data: results, error: resultsError } = await supabase
        .from('checklist_step_results')
        .select('*')
        .eq('checklist_execution_id', selectedExecution);
      if (resultsError) throw resultsError;

      return { execution, steps, results };
    },
    enabled: !!selectedExecution,
  });

  const abortExecution = useMutation({
    mutationFn: async (executionId: string) => {
      // Delete step results first
      const { error: stepError } = await supabase
        .from('checklist_step_results')
        .delete()
        .eq('checklist_execution_id', executionId);
      if (stepError) throw stepError;

      // Then delete execution
      const { error } = await supabase
        .from('checklist_executions')
        .delete()
        .eq('id', executionId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklist-executions'] });
      toast({ title: 'Kontroll avbruten' });
      setAbortConfirm({ open: false, executionId: null });
    },
    onError: (error: any) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const getProfileName = (userId: string) => {
    return profiles?.find((p) => p.user_id === userId)?.full_name || 'Okänd';
  };

  // Get applicable checklists for selected vessel
  const applicableChecklists = checklistTemplates?.filter((ct) => {
    if (ct.applies_to_all_vessels) return true;
    return templateVessels?.some((tv) => tv.checklist_template_id === ct.id && tv.vessel_id === selectedVessel);
  }) || [];

  // Calculate status for each checklist
  const checklistsWithStatus: ChecklistWithStatus[] = applicableChecklists.map((ct) => {
    const templateExecutions = executions?.filter((e) => e.checklist_template_id === ct.id) || [];
    const completedExecutions = templateExecutions.filter((e) => e.status === 'completed');
    const inProgressExecution = templateExecutions.find((e) => e.status === 'in_progress');
    
    const lastCompleted = completedExecutions[0]?.completed_at || null;
    let nextDue: string | null = null;
    let status: ChecklistStatus = 'ok';
    let daysRemaining: number | null = null;

    if (ct.interval_days) {
      if (lastCompleted) {
        const nextDueDate = startOfDay(addDays(new Date(lastCompleted), ct.interval_days));
        nextDue = format(nextDueDate, 'yyyy-MM-dd');
        const today = startOfDay(new Date());
        daysRemaining = differenceInDays(nextDueDate, today);
        
        if (daysRemaining < 0) {
          status = 'overdue';
        } else if (daysRemaining <= 7) {
          status = 'due_soon';
        }
      } else {
        // Never completed - show as "Ej utförd" (countdown starts after first completion)
        nextDue = 'Ej utförd';
        // Don't set status to overdue - keep it neutral until first completion
      }
    }

    return {
      id: ct.id,
      name: ct.name,
      description: ct.description,
      interval_days: ct.interval_days,
      applies_to_all_vessels: ct.applies_to_all_vessels,
      lastCompleted,
      nextDue,
      status,
      daysRemaining,
      inProgressId: inProgressExecution?.id || null,
    };
  });

  const overdueCount = checklistsWithStatus.filter((c) => c.status === 'overdue').length;
  const dueSoonCount = checklistsWithStatus.filter((c) => c.status === 'due_soon').length;
  const inProgressCount = checklistsWithStatus.filter((c) => c.inProgressId).length;

  const getStatusBadge = (checklist: ChecklistWithStatus) => {
    if (checklist.inProgressId) {
      return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />Pågår</Badge>;
    }
    // Show "Ej utförd" for checklists that have never been completed
    if (checklist.nextDue === 'Ej utförd') {
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Ej utförd</Badge>;
    }
    // Only show status badge for overdue (Förfallen)
    // For scheduled checklists with interval, the days badge is enough - no need for "OK"
    switch (checklist.status) {
      case 'overdue':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Förfallen</Badge>;
      default:
        return null; // No badge needed - days indicator is sufficient
    }
  };

  const getExecutionStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />Slutförd</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />Misslyckad</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" />Pågår</Badge>;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">Checklistor</h1>
            <p className="text-muted-foreground text-sm mt-1">Operativa checklistor och säkerhetskontroller</p>
          </div>
        </div>

        {/* Vessel selector */}
        <Card>
          <CardContent className="py-4 md:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="whitespace-nowrap text-sm">Välj fartyg:</Label>
              <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setActiveTab('overview'); }}>
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Välj ett fartyg för att se checklistor</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
              <TabsTrigger value="overview" className="gap-2 text-xs sm:text-sm">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Översikt</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2 text-xs sm:text-sm">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Historik</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3 md:space-y-4 mt-4">
              {/* Status cards */}
              {(overdueCount > 0 || dueSoonCount > 0 || inProgressCount > 0) && (
                <div className="grid gap-2 md:gap-4 grid-cols-1 sm:grid-cols-3">
                  {overdueCount > 0 && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardContent className="p-3 md:pt-6 flex items-center gap-3 md:gap-4">
                        <AlertTriangle className="h-6 w-6 md:h-8 md:w-8 text-destructive flex-shrink-0" />
                        <div>
                          <p className="font-medium text-destructive text-sm md:text-base">Förfallna</p>
                          <p className="text-xs md:text-sm text-muted-foreground">{overdueCount} checklista(or)</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {dueSoonCount > 0 && (
                    <Card className="border-primary/50 bg-primary/5">
                      <CardContent className="p-3 md:pt-6 flex items-center gap-3 md:gap-4">
                        <Clock className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-medium text-primary text-sm md:text-base">Kommande</p>
                          <p className="text-xs md:text-sm text-muted-foreground">{dueSoonCount} checklista(or)</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {inProgressCount > 0 && (
                    <Card className="border-yellow-500/50 bg-yellow-500/5">
                      <CardContent className="p-3 md:pt-6 flex items-center gap-3 md:gap-4">
                        <RefreshCw className="h-6 w-6 md:h-8 md:w-8 text-yellow-600 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-600 text-sm md:text-base">Pågående</p>
                          <p className="text-xs md:text-sm text-muted-foreground">{inProgressCount} checklista(or)</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Checklists list */}
              {checklistsWithStatus.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Inga checklistor tillgängliga för detta fartyg</p>
                  </CardContent>
                </Card>
              ) : (
              <div className="space-y-2 md:space-y-3">
                  {checklistsWithStatus.map((checklist) => (
                    <Card key={checklist.id} className={checklist.status === 'overdue' ? 'border-destructive/50' : ''}>
                      <CardContent className="p-3 md:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm md:text-base">{checklist.name}</span>
                              {getStatusBadge(checklist)}
                              {checklist.interval_days && checklist.daysRemaining !== null && (
                                checklist.daysRemaining >= 0 ? (
                                  <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white text-xs">
                                    <Clock className="h-3 w-3" />
                                    <span className="hidden sm:inline">Utför inom </span>{checklist.daysRemaining}d
                                  </Badge>
                                ) : (
                                  <Badge className="gap-1 bg-red-600 hover:bg-red-600 text-white text-xs">
                                    <AlertTriangle className="h-3 w-3" />
                                    -{Math.abs(checklist.daysRemaining)}d
                                  </Badge>
                                )
                              )}
                              {!checklist.interval_days && (
                                <Badge variant="outline" className="text-xs">Manuell</Badge>
                              )}
                            </div>
                            {checklist.description && (
                              <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">{checklist.description}</p>
                            )}
                            {checklist.lastCompleted && (
                              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                                Senast: {format(new Date(checklist.lastCompleted), 'd MMM yyyy', { locale: sv })}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            {checklist.inProgressId ? (
                              <>
                                <Button asChild className="flex-1 sm:flex-initial" size="sm">
                                  <Link to={`/portal/checklists/execute/${checklist.inProgressId}`}>
                                    <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">Fortsätt</span>
                                    <span className="sm:hidden">Fortsätt</span>
                                  </Link>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setAbortConfirm({ open: true, executionId: checklist.inProgressId })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button asChild className="w-full sm:w-auto" size="sm">
                                <Link to={`/portal/checklists/execute?template=${checklist.id}&vessel=${selectedVessel}`}>
                                  <Play className="h-4 w-4 mr-1 sm:mr-2" />
                                  Starta
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Checklisthistorik
                    </CardTitle>
                    {(filterStatus !== 'all' || filterTemplate !== 'all' || filterDateFrom || filterDateTo) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilterStatus('all');
                          setFilterTemplate('all');
                          setFilterDateFrom(undefined);
                          setFilterDateTo(undefined);
                        }}
                      >
                        Rensa filter
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filter:</span>
                    </div>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla statusar</SelectItem>
                        <SelectItem value="completed">Slutförd</SelectItem>
                        <SelectItem value="in_progress">Pågår</SelectItem>
                        <SelectItem value="failed">Misslyckad</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterTemplate} onValueChange={setFilterTemplate}>
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Checklista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla checklistor</SelectItem>
                        {applicableChecklists.map((ct) => (
                          <SelectItem key={ct.id} value={ct.id}>{ct.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                          <Calendar className="h-4 w-4" />
                          {filterDateFrom ? format(filterDateFrom, 'd MMM', { locale: sv }) : 'Från'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filterDateFrom}
                          onSelect={setFilterDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 gap-2">
                          <Calendar className="h-4 w-4" />
                          {filterDateTo ? format(filterDateTo, 'd MMM', { locale: sv }) : 'Till'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filterDateTo}
                          onSelect={setFilterDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {(() => {
                    const filteredExecutions = executions?.filter((execution) => {
                      // Status filter
                      if (filterStatus !== 'all' && execution.status !== filterStatus) return false;
                      
                      // Template filter
                      if (filterTemplate !== 'all' && execution.checklist_template_id !== filterTemplate) return false;
                      
                      // Date filters
                      const executionDate = new Date(execution.started_at);
                      if (filterDateFrom && isBefore(executionDate, startOfDay(filterDateFrom))) return false;
                      if (filterDateTo && isAfter(executionDate, endOfDay(filterDateTo))) return false;
                      
                      return true;
                    }) || [];

                    if (!executions || executions.length === 0) {
                      return (
                        <div className="py-8 text-center">
                          <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Ingen historik finns för detta fartyg</p>
                        </div>
                      );
                    }

                    if (filteredExecutions.length === 0) {
                      return (
                        <div className="py-8 text-center">
                          <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Inga resultat matchar filtren</p>
                        </div>
                      );
                    }

                    return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Checklista</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Startad</TableHead>
                          <TableHead>Slutförd</TableHead>
                          <TableHead>Utförd av</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExecutions.map((execution) => (
                          <TableRow key={execution.id}>
                            <TableCell className="font-medium">
                              {(execution.checklist_templates as any)?.name || 'Okänd'}
                            </TableCell>
                            <TableCell>{getExecutionStatusBadge(execution.status)}</TableCell>
                            <TableCell>
                              {format(new Date(execution.started_at), 'd MMM yyyy HH:mm', { locale: sv })}
                            </TableCell>
                            <TableCell>
                              {execution.completed_at 
                                ? format(new Date(execution.completed_at), 'd MMM yyyy HH:mm', { locale: sv })
                                : '-'
                              }
                            </TableCell>
                            <TableCell>{getProfileName(execution.started_by)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedExecution(execution.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Visa
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Execution details dialog */}
      <Dialog open={!!selectedExecution} onOpenChange={(open) => !open && setSelectedExecution(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              {(executionDetails?.execution?.checklist_templates as any)?.name || 'Checklistdetaljer'}
            </DialogTitle>
          </DialogHeader>
          
          {executionDetails && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Export button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!executionDetails) return;
                      const exec = executionDetails.execution;
                      const templateName = (exec.checklist_templates as any)?.name || 'Checklista';
                      const vesselName = vessels?.find(v => v.id === exec.vessel_id)?.name || '';
                      const completedDate = exec.completed_at 
                        ? format(new Date(exec.completed_at), 'd MMM yyyy HH:mm', { locale: sv })
                        : '-';
                      const startedDate = format(new Date(exec.started_at), 'd MMM yyyy HH:mm', { locale: sv });
                      const performer = getProfileName(exec.started_by);

                      const stepsHtml = executionDetails.steps.map((step, index) => {
                        const result = executionDetails.results.find((r) => r.checklist_step_id === step.id);
                        const statusText = result 
                          ? (result.value === 'deviation' ? 'Avvikelse' : result.value === 'no' ? 'Nej' : 'Godkänt')
                          : 'Ej utförd';
                        const statusColor = result 
                          ? (result.value === 'deviation' || result.value === 'no' ? '#dc2626' : '#16a34a')
                          : '#9ca3af';
                        
                        let checklistItemsHtml = '';
                        if (step.checklist_items && step.checklist_items.length > 0) {
                          checklistItemsHtml = `
                            <div style="margin-top:8px;padding:8px 12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
                              <p style="font-size:11px;font-weight:600;color:#374151;margin-bottom:6px;">Kontrollpunkter:</p>
                              ${step.checklist_items.map(item => `
                                <div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;">
                                  <span style="color:${result ? '#16a34a' : '#9ca3af'};">&#10003;</span>
                                  <span>${item}</span>
                                </div>
                              `).join('')}
                            </div>
                          `;
                        }
                        
                        return `
                          <div style="border:1px solid ${result ? '#bbf7d0' : '#e5e7eb'};border-radius:8px;padding:14px;margin-bottom:10px;background:#fff;">
                            <div style="display:flex;align-items:flex-start;gap:10px;">
                              <div style="width:24px;height:24px;border-radius:50%;background:${result ? '#22c55e' : '#e5e7eb'};color:${result ? '#fff' : '#6b7280'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;">
                                ${result ? '✓' : index + 1}
                              </div>
                              <div style="flex:1;">
                                <p style="font-weight:600;font-size:13px;margin:0;">${step.title}</p>
                                <p style="font-size:11px;color:#6b7280;margin:4px 0;">${step.instruction}</p>
                                ${checklistItemsHtml}
                                ${result ? `
                                  <div style="margin-top:8px;">
                                    <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:600;background:${statusColor}20;color:${statusColor};">${statusText}</span>
                                    <span style="font-size:10px;color:#9ca3af;margin-left:8px;">${format(new Date(result.confirmed_at), 'd MMM yyyy HH:mm', { locale: sv })} av ${getProfileName(result.confirmed_by)}</span>
                                  </div>
                                  ${result.comment ? `<div style="margin-top:6px;padding:6px 10px;background:#f3f4f6;border-radius:6px;font-size:11px;"><strong>Kommentar:</strong> ${result.comment}</div>` : ''}
                                ` : '<p style="font-size:11px;color:#9ca3af;font-style:italic;margin-top:6px;">Ej utförd</p>'}
                              </div>
                            </div>
                          </div>
                        `;
                      }).join('');

                      const printWindow = window.open('', '_blank');
                      if (!printWindow) {
                        toast({ title: 'Popup-blockerare hindrade exporten', variant: 'destructive' });
                        return;
                      }
                      printWindow.document.write(`<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8"><title>${templateName} - ${vesselName}</title>
                        <style>
                          * { box-sizing:border-box; margin:0; padding:0; }
                          body { font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif; padding:24px 32px; max-width:210mm; margin:0 auto; color:#1a1a1a; font-size:11px; line-height:1.6; background:white; }
                          @media print { body { padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
                        </style></head><body>
                        <div style="border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px;">
                          <h1 style="font-size:22px;font-weight:700;color:#1e3a5f;margin:0 0 4px 0;">${templateName}</h1>
                          <p style="color:#4b5563;font-size:13px;font-weight:500;margin:0;">${vesselName}</p>
                          <div style="font-size:10px;color:#6b7280;margin-top:8px;">Utskriven: ${new Date().toLocaleString('sv-SE')}</div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:20px;padding:12px 16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                          <div><span style="font-weight:600;color:#374151;">Status:</span> ${exec.status === 'completed' ? 'Slutförd' : 'Pågår'}</div>
                          <div><span style="font-weight:600;color:#374151;">Utförd av:</span> ${performer}</div>
                          <div><span style="font-weight:600;color:#374151;">Startad:</span> ${startedDate}</div>
                          <div><span style="font-weight:600;color:#374151;">Slutförd:</span> ${completedDate}</div>
                        </div>
                        <h3 style="font-size:14px;font-weight:700;color:#1e3a5f;margin-bottom:12px;">Steg och resultat</h3>
                        ${stepsHtml}
                        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;text-align:center;">
                          Genererad från SeaLog • ${new Date().toLocaleDateString('sv-SE')}
                        </div>
                      </body></html>`);
                      printWindow.document.close();
                      printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
                    }}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Exportera / Skriv ut
                  </Button>
                </div>

                {/* Execution info */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="mt-1">{getExecutionStatusBadge(executionDetails.execution.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Utförd av</p>
                    <p className="font-medium">{getProfileName(executionDetails.execution.started_by)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Startad</p>
                    <p className="font-medium">
                      {format(new Date(executionDetails.execution.started_at), 'd MMM yyyy HH:mm', { locale: sv })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Slutförd</p>
                    <p className="font-medium">
                      {executionDetails.execution.completed_at 
                        ? format(new Date(executionDetails.execution.completed_at), 'd MMM yyyy HH:mm', { locale: sv })
                        : '-'
                      }
                    </p>
                  </div>
                </div>

                {/* Steps and results */}
                <div className="space-y-3">
                  <h4 className="font-medium">Steg och resultat</h4>
                  {executionDetails.steps.map((step, index) => {
                    const result = executionDetails.results.find((r) => r.checklist_step_id === step.id);
                    return (
                      <Card key={step.id} className={result ? 'border-green-500/30' : 'border-muted'}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                              result ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                            }`}>
                              {result ? <Check className="h-4 w-4" /> : index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{step.title}</p>
                              <p className="text-sm text-muted-foreground">{step.instruction}</p>
                              
                              {/* Show checklist sub-items */}
                              {(step as any).checklist_items && (step as any).checklist_items.length > 0 && (
                                <div className="mt-2 p-2 bg-muted/30 rounded-lg border border-muted">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Kontrollpunkter:</p>
                                  {((step as any).checklist_items as string[]).map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
                                      <Check className={`h-3.5 w-3.5 flex-shrink-0 ${result ? 'text-green-600' : 'text-muted-foreground'}`} />
                                      <span className={result ? '' : 'text-muted-foreground'}>{item}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {result && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-4 text-sm">
                                    <Badge variant={result.value === 'no' || result.value === 'deviation' ? 'destructive' : 'default'} className={result.value !== 'no' && result.value !== 'deviation' ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-100' : ''}>
                                      {result.value === 'yes' ? 'Ja' : result.value === 'no' ? 'Nej' : result.value === 'deviation' ? 'Avvikelse' : 'Godkänt'}
                                    </Badge>
                                    <span className="text-muted-foreground">
                                      {format(new Date(result.confirmed_at), 'd MMM yyyy HH:mm', { locale: sv })}
                                    </span>
                                    <span className="text-muted-foreground">
                                      av {getProfileName(result.confirmed_by)}
                                    </span>
                                  </div>
                                  
                                  {result.comment && (
                                    <div className="flex items-start gap-2 p-2 bg-muted/50 rounded text-sm">
                                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                                      <p>{result.comment}</p>
                                    </div>
                                  )}
                                  
                                  {result.photo_url && (
                                    <div className="flex items-center gap-2">
                                      <Camera className="h-4 w-4 text-muted-foreground" />
                                      <a 
                                        href={result.photo_url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline"
                                      >
                                        Visa foto
                                      </a>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {!result && (
                                <p className="text-sm text-muted-foreground italic mt-2">Ej utförd</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={abortConfirm.open}
        onOpenChange={(open) => setAbortConfirm({ open, executionId: open ? abortConfirm.executionId : null })}
        title="Avbryt pågående kontroll?"
        description="Är du säker på att du vill avbryta och radera den pågående kontrollen? Alla sparade steg kommer att försvinna."
        confirmLabel="Avbryt & radera"
        cancelLabel="Behåll"
        onConfirm={() => abortConfirm.executionId && abortExecution.mutate(abortConfirm.executionId)}
        variant="destructive"
      />
    </MainLayout>
  );
}
