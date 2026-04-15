import { useState, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { Home, Plus, Trash2, CalendarIcon, FileText, Download, X, Check, Users } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isPast, isSameDay, isWithinInterval, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DocumentToUpload {
  id: string;
  file: File;
  displayName: string;
}

interface ExistingDocument {
  id: string;
  display_name: string;
  file_name: string;
  file_url: string;
}

interface IntranetMessage {
  id: string;
  organization_id: string;
  message_date: string;
  end_date: string | null;
  title: string;
  content: string | null;
  requires_confirmation: boolean;
  created_by: string;
  document_url: string | null;
  document_name: string | null;
  created_at: string;
  updated_at: string;
}

export default function IntranetAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: orgProfiles } = useOrgProfiles(selectedOrgId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmationsDialogOpen, setConfirmationsDialogOpen] = useState(false);
  const [confirmationsMessageId, setConfirmationsMessageId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [documentsToUpload, setDocumentsToUpload] = useState<DocumentToUpload[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; message: { id: string; title: string } | null }>({ open: false, message: null });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);

  const [viewDate, setViewDate] = useState(new Date());
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch messages that overlap the current week
  const { data: messages } = useQuery({
    queryKey: ['intranet-messages', selectedOrgId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      // Get messages where message_date <= weekEnd AND (end_date >= weekStart OR end_date IS NULL AND message_date >= weekStart)
      const { data, error } = await supabase
        .from('intranet_messages')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .lte('message_date', format(weekEnd, 'yyyy-MM-dd'))
        .or(`end_date.gte.${format(weekStart, 'yyyy-MM-dd')},and(end_date.is.null,message_date.gte.${format(weekStart, 'yyyy-MM-dd')})`)
        .order('message_date');
      if (error) throw error;
      return (data || []) as IntranetMessage[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch confirmation counts for messages that require it
  const messageIds = messages?.filter(m => m.requires_confirmation).map(m => m.id) || [];
  const { data: confirmationCounts } = useQuery({
    queryKey: ['intranet-confirmation-counts', messageIds],
    queryFn: async () => {
      if (messageIds.length === 0) return {};
      const { data, error } = await supabase
        .from('intranet_confirmations')
        .select('message_id')
        .in('message_id', messageIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(c => { counts[c.message_id] = (counts[c.message_id] || 0) + 1; });
      return counts;
    },
    enabled: messageIds.length > 0,
  });

  // Fetch confirmations for a specific message
  const { data: confirmationDetails } = useQuery({
    queryKey: ['intranet-confirmations-detail', confirmationsMessageId],
    queryFn: async () => {
      if (!confirmationsMessageId) return [];
      const { data, error } = await supabase
        .from('intranet_confirmations')
        .select('*')
        .eq('message_id', confirmationsMessageId)
        .order('confirmed_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!confirmationsMessageId,
  });

  const resetForm = () => {
    setEditingId(null);
    setSelectedDate(new Date());
    setEndDate(null);
    setIsMultiDay(false);
    setRequiresConfirmation(false);
    setTitle('');
    setContent('');
    setDocumentsToUpload([]);
    setExistingDocuments([]);
    setDocumentsToDelete([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openDialog = async (date?: Date, message?: IntranetMessage) => {
    if (message) {
      setEditingId(message.id);
      setSelectedDate(new Date(message.message_date + 'T00:00:00'));
      setEndDate(message.end_date ? new Date(message.end_date + 'T00:00:00') : null);
      setIsMultiDay(!!message.end_date);
      setRequiresConfirmation(message.requires_confirmation);
      setTitle(message.title);
      setContent(message.content || '');

      const { data: docs } = await supabase
        .from('intranet_documents')
        .select('id, display_name, file_name, file_url')
        .eq('message_id', message.id)
        .order('created_at');

      setExistingDocuments(docs || []);
      setDocumentsToUpload([]);
      setDocumentsToDelete([]);
    } else {
      resetForm();
      if (date) setSelectedDate(date);
    }
    setDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newDocs: DocumentToUpload[] = Array.from(files).map(file => ({
      id: crypto.randomUUID(),
      file,
      displayName: file.name.replace(/\.[^/.]+$/, ''),
    }));
    setDocumentsToUpload(prev => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateDocumentDisplayName = (id: string, displayName: string) => {
    setDocumentsToUpload(prev => prev.map(doc => doc.id === id ? { ...doc, displayName } : doc));
  };

  const removeDocumentToUpload = (id: string) => {
    setDocumentsToUpload(prev => prev.filter(doc => doc.id !== id));
  };

  const markExistingDocForDeletion = (id: string) => {
    setDocumentsToDelete(prev => [...prev, id]);
    setExistingDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const saveMessage = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !user) throw new Error('Ingen organisation vald');

      let messageId = editingId;

      const messageData = {
        organization_id: selectedOrgId,
        message_date: format(selectedDate, 'yyyy-MM-dd'),
        end_date: isMultiDay && endDate ? format(endDate, 'yyyy-MM-dd') : null,
        requires_confirmation: requiresConfirmation,
        title,
        content: content || null,
        created_by: user.id,
        document_url: null,
        document_name: null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('intranet_messages')
          .update(messageData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('intranet_messages')
          .insert(messageData)
          .select('id')
          .single();
        if (error) throw error;
        messageId = data.id;
      }

      if (!messageId) throw new Error('Kunde inte spara meddelande');

      if (documentsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('intranet_documents')
          .delete()
          .in('id', documentsToDelete);
        if (deleteError) throw deleteError;
      }

      for (const doc of documentsToUpload) {
        const fileExt = doc.file.name.split('.').pop();
        const fileName = `${selectedOrgId}/${messageId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('intranet-documents')
          .upload(fileName, doc.file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('intranet-documents')
          .getPublicUrl(fileName);

        const { error: docInsertError } = await supabase
          .from('intranet_documents')
          .insert({
            message_id: messageId,
            organization_id: selectedOrgId,
            display_name: doc.displayName || doc.file.name,
            file_name: doc.file.name,
            file_url: urlData.publicUrl,
            uploaded_by: user.id,
          });
        if (docInsertError) throw docInsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intranet-messages'] });
      toast({ title: 'Sparat', description: 'Meddelandet har sparats.' });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.from('intranet_messages').delete().eq('id', messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intranet-messages'] });
      toast({ title: 'Raderat', description: 'Meddelandet har tagits bort.' });
      setDeleteConfirm({ open: false, message: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // Get messages active on a given date
  const getMessagesForDate = (date: Date): IntranetMessage[] => {
    if (!messages) return [];
    const dateStr = format(date, 'yyyy-MM-dd');
    return messages.filter(m => {
      if (m.end_date) {
        return dateStr >= m.message_date && dateStr <= m.end_date;
      }
      return m.message_date === dateStr;
    });
  };

  const downloadDocument = async (doc: ExistingDocument) => {
    try {
      const urlParts = doc.file_url.split('/intranet-documents/');
      if (urlParts.length < 2) throw new Error('Invalid file URL');
      const filePath = decodeURIComponent(urlParts[1]);
      const { data, error } = await supabase.storage
        .from('intranet-documents')
        .createSignedUrl(filePath, 300);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error('No signed URL returned');
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: 'Fel', description: 'Kunde inte ladda ner filen', variant: 'destructive' });
    }
  };

  const openConfirmations = (messageId: string) => {
    setConfirmationsMessageId(messageId);
    setConfirmationsDialogOpen(true);
  };

  const getProfileName = (userId: string) => {
    const profile = orgProfiles?.find(p => p.user_id === userId);
    return profile?.full_name || 'Okänd';
  };

  const totalDocuments = existingDocuments.length + documentsToUpload.length;
  const totalOrgMembers = orgProfiles?.length || 0;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            Intranät
          </h1>
          <p className="text-muted-foreground text-sm">Hantera meddelanden på startsidan</p>
        </div>

        <div className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => openDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nytt meddelande
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Veckoöversikt</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setViewDate(addDays(viewDate, -7))}>
                    ← Föregående
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setViewDate(new Date())}>
                    Idag
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setViewDate(addDays(viewDate, 7))}>
                    Nästa →
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayMessages = getMessagesForDate(day);
                  const dayIsToday = isToday(day);
                  const dayIsPast = isPast(day) && !dayIsToday;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 rounded-lg border min-h-[130px] flex flex-col transition-colors",
                        dayIsToday && "border-primary bg-primary/5",
                        dayIsPast && "opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn("text-xs font-medium", dayIsToday && "text-primary")}>
                          {format(day, 'EEE', { locale: sv })}
                        </span>
                        <span className={cn("text-lg font-bold", dayIsToday && "text-primary")}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      <div className="flex-1 space-y-1">
                        {dayMessages.length > 0 ? (
                          dayMessages.map((msg) => {
                            const isMulti = !!msg.end_date;
                            const confCount = confirmationCounts?.[msg.id] || 0;
                            return (
                              <div
                                key={msg.id}
                                className={cn(
                                  "p-1.5 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity",
                                  isMulti
                                    ? "bg-primary/10 border-l-2 border-primary"
                                    : "bg-muted"
                                )}
                                onClick={() => openDialog(undefined, msg)}
                              >
                                <p className="font-medium line-clamp-2 leading-tight">{msg.title}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {msg.requires_confirmation && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 gap-0.5">
                                      <Check className="h-2.5 w-2.5" />
                                      {confCount}
                                    </Badge>
                                  )}
                                  {isMulti && (
                                    <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4">
                                      Pågående
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div
                            className="flex-1 flex items-center justify-center cursor-pointer hover:bg-muted/50 rounded transition-colors min-h-[60px]"
                            onClick={() => openDialog(day)}
                          >
                            <Plus className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {dayMessages.length > 0 && (
                        <button
                          className="mt-1 text-[10px] text-primary hover:underline self-start"
                          onClick={() => openDialog(day)}
                        >
                          + Lägg till
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Klicka på ett meddelande för att redigera, eller på + för att skapa nytt
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Message Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Redigera meddelande' : 'Nytt meddelande'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Startdatum *</Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(selectedDate, 'EEEE d MMMM yyyy', { locale: sv })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarOpen(false); } }}
                      locale={sv}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={isMultiDay} onCheckedChange={(checked) => { setIsMultiDay(checked); if (!checked) setEndDate(null); }} />
                <Label className="cursor-pointer" onClick={() => { setIsMultiDay(!isMultiDay); if (isMultiDay) setEndDate(null); }}>
                  Flerdagarsmeddelande
                </Label>
              </div>

              {isMultiDay && (
                <div className="space-y-2">
                  <Label>Slutdatum *</Label>
                  <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {endDate ? format(endDate, 'EEEE d MMMM yyyy', { locale: sv }) : 'Välj slutdatum'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate || undefined}
                        onSelect={(date) => { if (date) { setEndDate(date); setEndCalendarOpen(false); } }}
                        locale={sv}
                        disabled={(date) => date < selectedDate}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="T.ex. Säkerhetsinformation" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Meddelande</Label>
                <Textarea id="content" value={content} onChange={e => setContent(e.target.value)} placeholder="Skriv ditt meddelande här..." rows={4} />
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={requiresConfirmation} onCheckedChange={setRequiresConfirmation} />
                <div>
                  <Label className="cursor-pointer" onClick={() => setRequiresConfirmation(!requiresConfirmation)}>
                    Kräv bekräftelse
                  </Label>
                  <p className="text-xs text-muted-foreground">Besättningen måste bekräfta att de läst meddelandet</p>
                </div>
              </div>

              {editingId && requiresConfirmation && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openConfirmations(editingId)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Visa bekräftelser ({confirmationCounts?.[editingId] || 0}/{totalOrgMembers})
                </Button>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Dokument ({totalDocuments})</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till fil
                  </Button>
                  <Input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
                </div>

                {existingDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.file_name}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => downloadDocument(doc)} title="Ladda ner">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => markExistingDocForDeletion(doc.id)} title="Ta bort">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {documentsToUpload.map((doc) => (
                  <div key={doc.id} className="space-y-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-xs text-muted-foreground truncate flex-1">{doc.file.name}</span>
                      <Badge variant="outline" className="text-[10px]">Ny</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={() => removeDocumentToUpload(doc.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input value={doc.displayName} onChange={(e) => updateDocumentDisplayName(doc.id, e.target.value)} placeholder="Titel för dokumentet" className="h-8 text-sm" />
                  </div>
                ))}

                {totalDocuments === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">Inga dokument tillagda</p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                {editingId && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const message = messages?.find(m => m.id === editingId);
                      if (message) setDeleteConfirm({ open: true, message: { id: message.id, title: message.title } });
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Radera
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => saveMessage.mutate()}
                  disabled={!title || saveMessage.isPending || (isMultiDay && !endDate)}
                >
                  {saveMessage.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmations Dialog */}
        <Dialog open={confirmationsDialogOpen} onOpenChange={setConfirmationsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Bekräftelser</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {confirmationDetails && confirmationDetails.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    {confirmationDetails.length} av {totalOrgMembers} har bekräftat
                  </p>
                  {confirmationDetails.map((conf) => (
                    <div key={conf.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{getProfileName(conf.user_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conf.confirmed_at), 'd MMM HH:mm', { locale: sv })}
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen har bekräftat ännu</p>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
          title="Radera meddelande"
          description={`Är du säker på att du vill radera "${deleteConfirm.message?.title}"?`}
          confirmLabel="Radera"
          variant="destructive"
          onConfirm={() => {
            if (deleteConfirm.message) {
              deleteMessage.mutate(deleteConfirm.message.id);
              setDialogOpen(false);
            }
          }}
        />
      </div>
    </MainLayout>
  );
}
