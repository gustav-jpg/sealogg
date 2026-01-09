import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { format, differenceInDays, addDays, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardList, Play, AlertTriangle, Clock, CheckCircle, Calendar, RefreshCw, History, Eye, Check, X, MessageSquare, Camera, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

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
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  
  // History filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: checklistTemplates } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: templateVessels } = useQuery({
    queryKey: ['checklist-template-vessels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_template_vessels')
        .select('*');
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

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name');
      if (error) throw error;
      return data;
    },
  });

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
        const nextDueDate = addDays(new Date(lastCompleted), ct.interval_days);
        nextDue = format(nextDueDate, 'yyyy-MM-dd');
        daysRemaining = differenceInDays(nextDueDate, new Date());
        
        if (daysRemaining < 0) {
          status = 'overdue';
        } else if (daysRemaining <= 7) {
          status = 'due_soon';
        }
      } else {
        status = 'overdue';
        nextDue = 'Ej utförd';
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
    switch (checklist.status) {
      case 'overdue':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Förfallen</Badge>;
      case 'due_soon':
        return <Badge variant="default" className="gap-1"><Clock className="h-3 w-3" />Snart</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />OK</Badge>;
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Checklistor</h1>
            <p className="text-muted-foreground mt-1">Operativa checklistor och säkerhetskontroller</p>
          </div>
        </div>

        {/* Vessel selector */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Välj fartyg:</Label>
              <Select value={selectedVessel} onValueChange={(v) => { setSelectedVessel(v); setActiveTab('overview'); }}>
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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Välj ett fartyg för att se checklistor</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Översikt
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                Historik
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Status cards */}
              {(overdueCount > 0 || dueSoonCount > 0 || inProgressCount > 0) && (
                <div className="grid gap-4 sm:grid-cols-3">
                  {overdueCount > 0 && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardContent className="pt-6 flex items-center gap-4">
                        <AlertTriangle className="h-8 w-8 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">Förfallna</p>
                          <p className="text-sm text-muted-foreground">{overdueCount} checklista(or)</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {dueSoonCount > 0 && (
                    <Card className="border-primary/50 bg-primary/5">
                      <CardContent className="pt-6 flex items-center gap-4">
                        <Clock className="h-8 w-8 text-primary" />
                        <div>
                          <p className="font-medium text-primary">Kommande</p>
                          <p className="text-sm text-muted-foreground">{dueSoonCount} checklista(or)</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {inProgressCount > 0 && (
                    <Card className="border-yellow-500/50 bg-yellow-500/5">
                      <CardContent className="pt-6 flex items-center gap-4">
                        <RefreshCw className="h-8 w-8 text-yellow-600" />
                        <div>
                          <p className="font-medium text-yellow-600">Pågående</p>
                          <p className="text-sm text-muted-foreground">{inProgressCount} checklista(or)</p>
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
                <div className="space-y-3">
                  {checklistsWithStatus.map((checklist) => (
                    <Card key={checklist.id} className={checklist.status === 'overdue' ? 'border-destructive/50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{checklist.name}</span>
                              {getStatusBadge(checklist)}
                              {checklist.interval_days && (
                                <Badge variant="outline" className="gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Var {checklist.interval_days}:e dag
                                </Badge>
                              )}
                              {!checklist.interval_days && (
                                <Badge variant="outline">Manuell</Badge>
                              )}
                            </div>
                            {checklist.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{checklist.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm mt-1">
                              {checklist.lastCompleted && (
                                <span className="text-muted-foreground">Senast: {format(new Date(checklist.lastCompleted), 'd MMM yyyy', { locale: sv })}</span>
                              )}
                              {checklist.interval_days && checklist.daysRemaining !== null && (
                                checklist.daysRemaining >= 0 ? (
                                  <span className="text-muted-foreground">
                                    Utför inom: <span className="font-medium text-foreground">{checklist.daysRemaining} dagar</span>
                                  </span>
                                ) : (
                                  <span className="text-destructive font-medium">
                                    Försenat: {Math.abs(checklist.daysRemaining)} dagar
                                  </span>
                                )
                              )}
                              {checklist.nextDue === 'Ej utförd' && (
                                <span className="text-destructive font-medium">Ej utförd</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {checklist.inProgressId ? (
                              <Button asChild>
                                <Link to={`/portal/checklists/execute/${checklist.inProgressId}`}>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Fortsätt
                                </Link>
                              </Button>
                            ) : (
                              <Button asChild>
                                <Link to={`/portal/checklists/execute?template=${checklist.id}&vessel=${selectedVessel}`}>
                                  <Play className="h-4 w-4 mr-2" />
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
                              
                              {result && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center gap-4 text-sm">
                                    <Badge variant={result.value === 'yes' || result.value === 'checked' ? 'secondary' : 'destructive'}>
                                      {result.value === 'yes' ? 'Ja' : result.value === 'no' ? 'Nej' : 'Bekräftad'}
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
    </MainLayout>
  );
}
