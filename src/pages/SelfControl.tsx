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
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock, Calendar, Gauge, Eye, Check } from 'lucide-react';

export default function SelfControl() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVessel, setSelectedVessel] = useState<string>('');
  const [activeTab, setActiveTab] = useState('all');
  const [performDialogOpen, setPerformDialogOpen] = useState(false);
  const [selectedControlPoint, setSelectedControlPoint] = useState<any>(null);
  const [performDate, setPerformDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [performNotes, setPerformNotes] = useState('');
  const [performEngineHours, setPerformEngineHours] = useState('');
  const [performFiles, setPerformFiles] = useState<File[]>([]);

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

  const performControl = useMutation({
    mutationFn: async () => {
      if (!selectedControlPoint || !selectedVessel) return;

      const cp = selectedControlPoint;
      const engine = vesselEngines?.[0];
      const engineHoursValue = performEngineHours ? parseInt(performEngineHours) : (engine?.current_hours || 0);

      // Create record
      const { data: record, error: recordError } = await supabase
        .from('control_point_records')
        .insert({
          control_point_id: cp.id,
          vessel_id: selectedVessel,
          engine_id: cp.type === 'engine_hours' ? engine?.id : null,
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
      const nextDueDate = cp.type === 'calendar' && cp.interval_months
        ? format(addMonths(new Date(performDate), cp.interval_months), 'yyyy-MM-dd')
        : null;

      const nextDueEngineHours = cp.type === 'engine_hours' && cp.interval_engine_hours
        ? engineHoursValue + cp.interval_engine_hours
        : null;

      const stateData = {
        vessel_id: selectedVessel,
        control_point_id: cp.id,
        engine_id: cp.type === 'engine_hours' ? engine?.id : null,
        last_done_date: performDate,
        last_done_at_engine_hours: cp.type === 'engine_hours' ? engineHoursValue : null,
        next_due_date: nextDueDate,
        next_due_at_engine_hours: nextDueEngineHours,
        status: 'ok' as ControlStatus,
      };

      const existingState = vesselStates?.find((s) => s.control_point_id === cp.id);
      
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
  };

  const openPerformDialog = (cp: any) => {
    setSelectedControlPoint(cp);
    const engine = vesselEngines?.[0];
    setPerformEngineHours(engine?.current_hours?.toString() || '0');
    setPerformDialogOpen(true);
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Alla ({controlPointsWithState.length})</TabsTrigger>
                <TabsTrigger value="upcoming">Kommande ({upcomingCount})</TabsTrigger>
                <TabsTrigger value="overdue">Förfallna ({overdueCount})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-4">
                {filteredControlPoints.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Inga kontroller att visa</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredControlPoints.map((cp) => (
                      <Card key={cp.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{cp.name}</span>
                                <Badge variant={getStatusColor(cp.status)}>
                                  {getStatusIcon(cp.status)}
                                  <span className="ml-1">{CONTROL_STATUS_LABELS[cp.status]}</span>
                                </Badge>
                                <Badge variant="outline">
                                  {cp.type === 'calendar' ? <Calendar className="h-3 w-3 mr-1" /> : <Gauge className="h-3 w-3 mr-1" />}
                                  {CONTROL_TYPE_LABELS[cp.type as ControlType]}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>
                                  Intervall: {cp.type === 'calendar' 
                                    ? `${cp.interval_months} mån` 
                                    : `${cp.interval_engine_hours}h`}
                                </span>
                                <span>Nästa: {cp.nextDue}</span>
                                {cp.daysRemaining !== null && (
                                  <span className={cp.daysRemaining < 0 ? 'text-destructive' : ''}>
                                    {cp.daysRemaining < 0 
                                      ? `${Math.abs(cp.daysRemaining)} dagar sedan` 
                                      : `${cp.daysRemaining} dagar kvar`}
                                  </span>
                                )}
                                {cp.hoursRemaining !== null && (
                                  <span className={cp.hoursRemaining < 0 ? 'text-destructive' : ''}>
                                    {cp.hoursRemaining < 0 
                                      ? `${Math.abs(cp.hoursRemaining)}h sedan` 
                                      : `${cp.hoursRemaining}h kvar`}
                                  </span>
                                )}
                              </div>
                              {cp.description && (
                                <p className="text-sm text-muted-foreground mt-1">{cp.description}</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button variant="default" size="sm" onClick={() => openPerformDialog(cp)}>
                                <Check className="h-4 w-4 mr-1" />
                                Utför
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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

                {selectedControlPoint.type === 'engine_hours' && (
                  <div className="space-y-2">
                    <Label>Maskintimmar vid utförande</Label>
                    <Input
                      type="number"
                      value={performEngineHours}
                      onChange={(e) => setPerformEngineHours(e.target.value)}
                      placeholder="Aktuella maskintimmar"
                    />
                  </div>
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