import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePrint } from '@/hooks/usePrint';
import {
  DEVIATION_TYPE_LABELS,
  DEVIATION_SEVERITY_LABELS,
  DEVIATION_STATUS_LABELS,
  DeviationType,
  DeviationSeverity,
  DeviationStatus,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { ArrowLeft, Plus, FileText, MessageSquare, Image, X, Printer, Pencil, Trash2, BookOpen } from 'lucide-react';

export default function DeviationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, canEdit } = useAuth();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const [newAction, setNewAction] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newStatus, setNewStatus] = useState<DeviationStatus | ''>('');
  
  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<DeviationType>('avvikelse');
  const [editSeverity, setEditSeverity] = useState<DeviationSeverity>('medel');
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const { data: deviation, isLoading } = useQuery({
    queryKey: ['deviation', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deviations')
        .select(`*, vessel:vessels(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      
      // Fetch creator profile
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', data.created_by)
        .maybeSingle();
      
      return { ...data, creator_profile: creatorProfile };
    },
    enabled: !!id,
  });

  const { data: actions } = useQuery({
    queryKey: ['deviation-actions', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deviation_actions')
        .select(`*`)
        .eq('deviation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Fetch profiles for all action creators
      const userIds = [...new Set(data.map(a => a.created_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      return data.map(a => ({ ...a, creator_name: profileMap.get(a.created_by) || 'Okänd' }));
    },
    enabled: !!id,
  });

  const { data: responses } = useQuery({
    queryKey: ['deviation-responses', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deviation_responses')
        .select(`*`)
        .eq('deviation_id', id)
        .order('responded_at', { ascending: true });
      if (error) throw error;
      
      // Fetch profiles for all responders
      const userIds = [...new Set(data.map(r => r.responded_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      return data.map(r => ({ ...r, responder_name: profileMap.get(r.responded_by) || 'Okänd' }));
    },
    enabled: !!id,
  });

  const { data: attachments } = useQuery({
    queryKey: ['deviation-attachments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deviation_attachments')
        .select('*')
        .eq('deviation_id', id)
        .order('uploaded_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const addAction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('deviation_actions')
        .insert({
          deviation_id: id,
          action_text: newAction,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviation-actions', id] });
      toast({ title: 'Tillagd', description: 'Åtgärden har lagts till.' });
      setNewAction('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const addResponse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('deviation_responses')
        .insert({
          deviation_id: id,
          response_text: newResponse,
          responded_by: user?.id,
        });
      if (error) throw error;

      // Update status to 'aterrapporterad'
      await supabase
        .from('deviations')
        .update({ status: 'aterrapporterad' })
        .eq('id', id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviation-responses', id] });
      queryClient.invalidateQueries({ queryKey: ['deviation', id] });
      toast({ title: 'Tillagd', description: 'Återrapporteringen har lagts till.' });
      setNewResponse('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: DeviationStatus) => {
      const updateData: any = { status };
      if (status === 'stangd') {
        updateData.closed_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('deviations')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviation', id] });
      queryClient.invalidateQueries({ queryKey: ['deviations'] });
      toast({ title: 'Uppdaterad', description: 'Status har ändrats.' });
      setNewStatus('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateDeviation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('deviations')
        .update({
          title: editTitle,
          description: editDescription,
          type: editType,
          severity: editSeverity,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviation', id] });
      queryClient.invalidateQueries({ queryKey: ['deviations'] });
      toast({ title: 'Uppdaterad', description: 'Avvikelsen har uppdaterats.' });
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDeviation = useMutation({
    mutationFn: async () => {
      // First add a comment with the deletion reason
      await supabase
        .from('deviation_actions')
        .insert({
          deviation_id: id,
          action_text: `[RADERAD] ${deleteReason}`,
          created_by: user?.id,
        });

      // Then update the deviation to be closed with "Raderad" in title
      const { error } = await supabase
        .from('deviations')
        .update({
          title: `[RADERAD] ${deviation?.title}`,
          status: 'stangd',
          closed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviations'] });
      toast({ title: 'Raderad', description: 'Avvikelsen har markerats som raderad.' });
      navigate('/portal/deviations');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openEditDialog = () => {
    if (deviation) {
      setEditTitle(deviation.title);
      setEditDescription(deviation.description);
      setEditType(deviation.type as DeviationType);
      setEditSeverity(deviation.severity as DeviationSeverity);
      setShowEditDialog(true);
    }
  };

  const getSeverityColor = (sev: DeviationSeverity) => {
    switch (sev) {
      case 'hog': return 'destructive';
      case 'medel': return 'default';
      case 'lag': return 'secondary';
    }
  };

  const getStatusColor = (status: DeviationStatus) => {
    switch (status) {
      case 'stangd': return 'secondary';
      case 'aterrapporterad': return 'default';
      case 'under_utredning': return 'outline';
      case 'oppen': return 'destructive';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </MainLayout>
    );
  }

  if (!deviation) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Avvikelsen hittades inte.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/deviations')}>
            Tillbaka
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isOpen = deviation.status !== 'stangd';
  const isOwnDeviation = deviation.created_by === user?.id;
  const canEditDeviation = isOwnDeviation && isOpen;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/deviations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold">{deviation.title}</h1>
              <Badge variant={getSeverityColor(deviation.severity as DeviationSeverity)}>
                {DEVIATION_SEVERITY_LABELS[deviation.severity as DeviationSeverity]}
              </Badge>
              <Badge variant={getStatusColor(deviation.status as DeviationStatus)}>
                {DEVIATION_STATUS_LABELS[deviation.status as DeviationStatus]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {(deviation as any).vessel?.name} • {format(new Date(deviation.date), 'PPP', { locale: sv })}
            </p>
          </div>
          <div className="flex gap-2">
            {canEditDeviation && (
              <>
                <Button variant="outline" size="icon" onClick={openEditDialog}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => setShowDeleteDialog(true)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => printContent('deviation-print-content', {
                title: `Avvikelse - ${deviation.title}`,
                subtitle: `${(deviation as any).vessel?.name} • ${format(new Date(deviation.date), 'PPP', { locale: sv })}`,
              })}
            >
              <Printer className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Redigera avvikelse</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateDeviation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Rubrik *</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Typ *</Label>
                  <Select value={editType} onValueChange={(v) => setEditType(v as DeviationType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVIATION_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allvarlighetsgrad *</Label>
                  <Select value={editSeverity} onValueChange={(v) => setEditSeverity(v as DeviationSeverity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVIATION_SEVERITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Beskrivning *</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} required rows={4} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={updateDeviation.isPending}>
                  {updateDeviation.isPending ? 'Sparar...' : 'Spara ändringar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Radera avvikelse</DialogTitle>
              <DialogDescription>
                Avvikelsen kommer att markeras som raderad och stängas. Du måste ange en anledning.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                deleteDeviation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Anledning till radering *</Label>
                <Textarea 
                  value={deleteReason} 
                  onChange={(e) => setDeleteReason(e.target.value)} 
                  required 
                  rows={3} 
                  placeholder="Beskriv varför avvikelsen raderas..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Avbryt
                </Button>
                <Button type="submit" variant="destructive" disabled={deleteDeviation.isPending || !deleteReason.trim()}>
                  {deleteDeviation.isPending ? 'Raderar...' : 'Radera avvikelse'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div id="deviation-print-content" className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Detaljer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Typ</Label>
                    <p className="font-medium">{DEVIATION_TYPE_LABELS[deviation.type as DeviationType]}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Rapporterad av</Label>
                    <p className="font-medium">{(deviation as any).creator_profile?.full_name || 'Okänd'}</p>
                  </div>
                </div>
                {deviation.logbook_id && (
                  <div>
                    <Label className="text-muted-foreground">Kopplad loggbok</Label>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm font-medium"
                      onClick={() => navigate(`/portal/logbook/${deviation.logbook_id}`)}
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                      Visa loggbok ({format(new Date(deviation.date), 'PPP', { locale: sv })})
                    </Button>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Beskrivning</Label>
                  <p className="mt-1 whitespace-pre-wrap">{deviation.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            {attachments && attachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Bilagor ({attachments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {attachments.map((att) => (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 rounded border hover:bg-muted transition-colors"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate text-sm">{att.file_name}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Åtgärder</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {actions && actions.length > 0 ? (
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <div key={action.id} className={`p-3 rounded ${action.action_text.startsWith('[RADERAD]') ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'}`}>
                        <p>{action.action_text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(action as any).creator_name} • {format(new Date(action.created_at), 'PPP HH:mm', { locale: sv })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Inga åtgärder registrerade</p>
                )}

                {(canEdit || isAdmin) && isOpen && (
                  <div className="flex gap-2">
                    <Input
                      value={newAction}
                      onChange={(e) => setNewAction(e.target.value)}
                      placeholder="Beskriv åtgärd..."
                    />
                    <Button onClick={() => addAction.mutate()} disabled={!newAction || addAction.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Responses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Återrapportering
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {responses && responses.length > 0 ? (
                  <div className="space-y-2">
                    {responses.map((response) => (
                      <div key={response.id} className="p-3 rounded bg-primary/10 border border-primary/20">
                        <p>{response.response_text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(response as any).responder_name} • {format(new Date(response.responded_at), 'PPP HH:mm', { locale: sv })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Ingen återrapportering ännu</p>
                )}

                {isAdmin && isOpen && (
                  <div className="space-y-2">
                    <Textarea
                      value={newResponse}
                      onChange={(e) => setNewResponse(e.target.value)}
                      placeholder="Skriv återrapportering..."
                      rows={3}
                    />
                    <Button onClick={() => addResponse.mutate()} disabled={!newResponse || addResponse.isPending}>
                      Skicka återrapportering
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {(canEdit || isAdmin) && isOpen && (
              <Card>
                <CardHeader>
                  <CardTitle>Ändra status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={newStatus} onValueChange={(v) => setNewStatus(v as DeviationStatus)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj ny status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVIATION_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    onClick={() => newStatus && updateStatus.mutate(newStatus)}
                    disabled={!newStatus || updateStatus.isPending}
                  >
                    Uppdatera status
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isOpen && (
              <Card className="border-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <X className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Denna avvikelse är stängd.</p>
                  {deviation.closed_at && (
                    <p className="text-xs mt-1">
                      Stängd {format(new Date(deviation.closed_at), 'PPP', { locale: sv })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}