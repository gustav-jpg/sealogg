import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Home, Plus, Trash2, CalendarIcon, FileText, Download, X, Wind, AlertTriangle, Save, Settings } from 'lucide-react';
import { WEATHER_STATIONS, UFS_CHARTS, getUFSChartsByRegion } from '@/lib/maritime-data';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isPast } from 'date-fns';
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
  const [documentsToUpload, setDocumentsToUpload] = useState<DocumentToUpload[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<ExistingDocument[]>([]);
  const [documentsToDelete, setDocumentsToDelete] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; message: { id: string; title: string } | null }>({ open: false, message: null });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Settings state
  const [weatherStationId, setWeatherStationId] = useState('98040');
  const [smhiLon, setSmhiLon] = useState('19.5013');
  const [smhiLat, setSmhiLat] = useState('59.4428');
  const [chartNumbers, setChartNumbers] = useState<string[]>([]);
  

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

  // Fetch org settings
  const { data: orgSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['org-settings', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  useEffect(() => {
    if (orgSettings) {
      setWeatherStationId(orgSettings.weather_station_id || '98040');
      setSmhiLon(String(orgSettings.smhi_forecast_lon ?? '19.5013'));
      setSmhiLat(String(orgSettings.smhi_forecast_lat ?? '59.4428'));
      setChartNumbers(orgSettings.ufs_chart_numbers || []);
    }
  }, [orgSettings]);

  const resetForm = () => {
    setEditingId(null);
    setSelectedDate(new Date());
    setTitle('');
    setContent('');
    setDocumentsToUpload([]);
    setExistingDocuments([]);
    setDocumentsToDelete([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openDialog = async (date?: Date, message?: any) => {
    if (message) {
      setEditingId(message.id);
      setSelectedDate(new Date(message.message_date));
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
    setDocumentsToUpload(prev => 
      prev.map(doc => doc.id === id ? { ...doc, displayName } : doc)
    );
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
          .upsert(messageData, { onConflict: 'organization_id,message_date' })
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

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const payload = {
        organization_id: selectedOrgId,
        weather_station_id: weatherStationId,
        weather_station_source: 'smhi',
        smhi_forecast_lon: parseFloat(smhiLon),
        smhi_forecast_lat: parseFloat(smhiLat),
        ufs_chart_numbers: chartNumbers,
      };
      const { error } = await supabase
        .from('organization_settings')
        .upsert(payload, { onConflict: 'organization_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      toast({ title: 'Inställningar sparade' });
    },
    onError: (error) => {
      toast({ title: 'Kunde inte spara', description: String(error), variant: 'destructive' });
    },
  });

  const getMessageForDate = (date: Date) => {
    return messages?.find(m => m.message_date === format(date, 'yyyy-MM-dd'));
  };

  const downloadDocument = async (doc: ExistingDocument) => {
    try {
      const urlParts = doc.file_url.split('/intranet-documents/');
      if (urlParts.length < 2) throw new Error('Invalid file URL');
      const filePath = urlParts[1];
      
      const { data, error } = await supabase.storage
        .from('intranet-documents')
        .createSignedUrl(filePath, 60);
      if (error) throw error;
      
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      toast({ title: 'Fel', description: 'Kunde inte ladda ner filen', variant: 'destructive' });
    }
  };

  const removeChart = (chart: string) => {
    setChartNumbers(chartNumbers.filter(c => c !== chart));
  };

  const totalDocuments = existingDocuments.length + documentsToUpload.length;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
            <Home className="h-6 w-6" />
            Startsida
          </h1>
          <p className="text-muted-foreground text-sm">Hantera meddelanden, väder och UFS-inställningar</p>
        </div>

        <Tabs defaultValue="messages">
          <TabsList>
            <TabsTrigger value="messages">
              <FileText className="h-4 w-4 mr-1.5" />
              Meddelanden
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-1.5" />
              Inställningar
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-4 mt-4">
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
                          <span className={cn("text-xs font-medium", dayIsToday && "text-primary")}>
                            {format(day, 'EEE', { locale: sv })}
                          </span>
                          <span className={cn("text-lg font-bold", dayIsToday && "text-primary")}>
                            {format(day, 'd')}
                          </span>
                        </div>
                        
                        {message ? (
                          <div className="flex-1 space-y-1">
                            <p className="text-xs font-medium line-clamp-2">{message.title}</p>
                            {(message.document_name) && (
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
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {settingsLoading ? (
              <div className="h-40 bg-muted animate-pulse rounded-lg" />
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wind className="h-5 w-5" />
                      Väderstation
                    </CardTitle>
                    <CardDescription>
                      Välj vilken väderstation som ska användas för vinddata och väderprognos på startsidan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Station</Label>
                      <Select
                        value={weatherStationId}
                        onValueChange={(val) => {
                          setWeatherStationId(val);
                          const station = WEATHER_STATIONS.find(s => s.id === val);
                          if (station) {
                            setSmhiLon(String(station.lon));
                            setSmhiLat(String(station.lat));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj väderstation" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEATHER_STATIONS.map(station => (
                            <SelectItem key={station.id} value={station.id}>
                              {station.name} (ID: {station.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        SMHI-koordinater uppdateras automatiskt vid stationsbyte. Nuvarande: {smhiLat}, {smhiLon}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5" />
                      UFS Sjökort
                    </CardTitle>
                    <CardDescription>
                      Välj vilka sjökortsnummer som ska visas för UFS-varningar på startsidan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 min-h-[32px]">
                      {chartNumbers.length === 0 && (
                        <p className="text-sm text-muted-foreground">Inga sjökort valda</p>
                      )}
                      {chartNumbers.map(chart => {
                        const chartData = UFS_CHARTS.find(c => c.value === chart);
                        return (
                          <Badge key={chart} variant="secondary" className="text-sm py-1 px-3 gap-1">
                            {chartData ? chartData.label : chart}
                            <button onClick={() => removeChart(chart)} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                    
                    {(() => {
                      const grouped = getUFSChartsByRegion();
                      return (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-md p-3">
                          {Object.entries(grouped).map(([region, charts]) => (
                            <div key={region}>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{region}</p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {charts.map(chart => {
                                  const isSelected = chartNumbers.includes(chart.value);
                                  return (
                                    <label key={chart.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setChartNumbers([...chartNumbers, chart.value]);
                                          } else {
                                            removeChart(chart.value);
                                          }
                                        }}
                                      />
                                      {chart.label}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {saveSettings.isPending ? 'Sparar...' : 'Spara inställningar'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Message Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Redigera meddelande' : 'Nytt meddelande'}</DialogTitle>
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
                      onSelect={(date) => { if (date) { setSelectedDate(date); setCalendarOpen(false); } }}
                      locale={sv}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="T.ex. Dagens rutt" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="content">Meddelande</Label>
                <Textarea id="content" value={content} onChange={e => setContent(e.target.value)} placeholder="Skriv ditt meddelande här..." rows={4} />
              </div>
              
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
                <Button className="flex-1" onClick={() => saveMessage.mutate()} disabled={!title || saveMessage.isPending}>
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
