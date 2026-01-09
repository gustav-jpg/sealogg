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
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays, addDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ClipboardList, Play, AlertTriangle, Clock, CheckCircle, Calendar, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

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
        .select('*')
        .eq('vessel_id', selectedVessel)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVessel,
  });

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
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Välj ett fartyg för att se checklistor</p>
            </CardContent>
          </Card>
        ) : (
          <>
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
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            {checklist.lastCompleted && (
                              <span>Senast: {format(new Date(checklist.lastCompleted), 'd MMM yyyy', { locale: sv })}</span>
                            )}
                            {checklist.nextDue && checklist.interval_days && (
                              <span>
                                Nästa: {checklist.nextDue === 'Ej utförd' ? checklist.nextDue : format(new Date(checklist.nextDue), 'd MMM yyyy', { locale: sv })}
                                {checklist.daysRemaining !== null && checklist.daysRemaining >= 0 && ` (${checklist.daysRemaining} dagar)`}
                                {checklist.daysRemaining !== null && checklist.daysRemaining < 0 && ` (${Math.abs(checklist.daysRemaining)} dagar sedan)`}
                              </span>
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
          </>
        )}
      </div>
    </MainLayout>
  );
}
