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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Home, Plus, Trash2, CalendarIcon, FileText, Upload, X } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isFuture, isPast } from 'date-fns';
import { sv } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function IntranetAdmin() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingDocUrl, setExistingDocUrl] = useState<string | null>(null);
  const [existingDocName, setExistingDocName] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; message: { id: string; title: string } | null }>({ open: false, message: null });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // View state - show current week by default
  const [viewDate, setViewDate] = useState(new Date());
  const weekStart = startOfWeek(viewDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(viewDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Fetch messages for the current week view
  const { data: messages } = useQuery({
    queryKey: ['intranet-messages', selectedOrgId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('intranet_messages')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .gte('message_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('message_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('message_date');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const resetForm = () => {
    setEditingId(null);
    setSelectedDate(new Date());
    setTitle('');
    setContent('');
    setFile(null);
    setExistingDocUrl(null);
    setExistingDocName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openDialog = (date?: Date, message?: any) => {
    if (message) {
      setEditingId(message.id);
      setSelectedDate(new Date(message.message_date));
      setTitle(message.title);
      setContent(message.content || '');
      setExistingDocUrl(message.document_url);
      setExistingDocName(message.document_name);
    } else {
      resetForm();
      if (date) setSelectedDate(date);
    }
    setDialogOpen(true);
  };

  const saveMessage = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !user) throw new Error('Ingen organisation vald');
      
      let documentUrl = existingDocUrl;
      let documentName = existingDocName;
      
      // Upload new file if provided
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedOrgId}/${format(selectedDate, 'yyyy-MM-dd')}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('intranet-documents')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('intranet-documents')
          .getPublicUrl(fileName);
        
        documentUrl = urlData.publicUrl;
        documentName = file.name;
      }
      
      const messageData = {
        organization_id: selectedOrgId,
        message_date: format(selectedDate, 'yyyy-MM-dd'),
        title,
        content: content || null,
        document_url: documentUrl,
        document_name: documentName,
        created_by: user.id,
      };
      
      if (editingId) {
        const { error } = await supabase
          .from('intranet_messages')
          .update(messageData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('intranet_messages')
          .upsert(messageData, { onConflict: 'organization_id,message_date' });
        if (error) throw error;
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
      const { error } = await supabase
        .from('intranet_messages')
        .delete()
        .eq('id', messageId);
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

  const getMessageForDate = (date: Date) => {
    return messages?.find(m => m.message_date === format(date, 'yyyy-MM-dd'));
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <Home className="h-8 w-8" />
              Intranät
            </h1>
            <p className="text-muted-foreground mt-1">Hantera dagliga meddelanden för startsidan</p>
          </div>
          <Button onClick={() => openDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Nytt meddelande
          </Button>
        </div>

        {/* Week Navigation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Veckoöversikt</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDate(addDays(viewDate, -7))}
                >
                  ← Föregående
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDate(new Date())}
                >
                  Idag
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDate(addDays(viewDate, 7))}
                >
                  Nästa →
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const message = getMessageForDate(day);
                const dayIsToday = isToday(day);
                const dayIsPast = isPast(day) && !dayIsToday;
                
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-3 rounded-lg border min-h-[120px] flex flex-col cursor-pointer transition-colors hover:bg-muted/50",
                      dayIsToday && "border-primary bg-primary/5",
                      dayIsPast && "opacity-60"
                    )}
                    onClick={() => openDialog(day, message)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-xs font-medium",
                        dayIsToday && "text-primary"
                      )}>
                        {format(day, 'EEE', { locale: sv })}
                      </span>
                      <span className={cn(
                        "text-lg font-bold",
                        dayIsToday && "text-primary"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    
                    {message ? (
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-medium line-clamp-2">{message.title}</p>
                        {message.document_name && (
                          <Badge variant="secondary" className="text-[10px] py-0">
                            <FileText className="h-2.5 w-2.5 mr-1" />
                            Dokument
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Klicka på en dag för att lägga till eller redigera meddelande
            </p>
          </CardContent>
        </Card>

        {/* Message Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Redigera meddelande' : 'Nytt meddelande'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Datum *</Label>
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
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                      locale={sv}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="T.ex. Dagens rutt"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Meddelande</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Skriv ditt meddelande här..."
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Dokument</Label>
                {existingDocName && !file && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm flex-1 truncate">{existingDocName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setExistingDocUrl(null);
                        setExistingDocName(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={e => setFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground">
                    Ny fil: {file.name}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                {editingId && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const message = messages?.find(m => m.id === editingId);
                      if (message) {
                        setDeleteConfirm({ open: true, message: { id: message.id, title: message.title } });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Radera
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => saveMessage.mutate()}
                  disabled={!title || saveMessage.isPending}
                >
                  {saveMessage.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
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
