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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  FAULT_PRIORITY_LABELS,
  FAULT_STATUS_LABELS,
  FAULT_CATEGORY_LABELS,
  FaultPriority,
  FaultStatus,
  FaultCategory,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wrench, Plus, Filter, Archive, Printer, Pencil, X, ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrint } from '@/hooks/usePrint';
import { ImageAnnotator } from '@/components/ImageAnnotator';
import { sanitizeStorageFileName } from '@/lib/storage';
export default function FaultCases() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FaultPriority>('normal');
  const [category, setCategory] = useState<FaultCategory | ''>('');
  const [files, setFiles] = useState<{ id: string; file: File }[]>([]);
  const [fileToAnnotateId, setFileToAnnotateId] = useState<string | null>(null);
  const [filePreviews, setFilePreviews] = useState<{ id: string; file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const vesselIds = vessels?.map((v) => v.id) || [];

  const { data: faultCases, isLoading } = useQuery({
    queryKey: [
      'fault-cases',
      selectedOrgId,
      vesselIds,
      filterVessel,
      filterStatus,
      filterPriority,
      searchText,
      activeTab,
      page,
    ],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      if (!selectedOrgId) return [];
      if (vesselIds.length === 0) return [];

      // Always scope fault cases to the currently selected organization
      // (otherwise users with multiple org memberships will see mixed data)
      let query = supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(*), assigned_profile:profiles!fault_cases_assigned_to_fkey(id, full_name)`)
        .in('vessel_id', vesselIds)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      // Filter by active/archive tab
      if (activeTab === 'active') {
        query = query.neq('status', 'avslutad');
      } else {
        query = query.eq('status', 'avslutad');
      }

      if (filterVessel !== 'all') query = query.eq('vessel_id', filterVessel);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus as FaultStatus);
      if (filterPriority !== 'all') query = query.eq('priority', filterPriority as FaultPriority);
      if (searchText) query = query.or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Get total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: [
      'fault-cases-count',
      selectedOrgId,
      vesselIds,
      filterVessel,
      filterStatus,
      filterPriority,
      searchText,
      activeTab,
    ],
    enabled: !!selectedOrgId && vesselIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('fault_cases')
        .select('id', { count: 'exact', head: true })
        .in('vessel_id', vesselIds);

      if (activeTab === 'active') {
        query = query.neq('status', 'avslutad');
      } else {
        query = query.eq('status', 'avslutad');
      }

      if (filterVessel !== 'all') query = query.eq('vessel_id', filterVessel);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus as FaultStatus);
      if (filterPriority !== 'all') query = query.eq('priority', filterPriority as FaultPriority);
      if (searchText) query = query.or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`);

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Reset page when filters change
  const handleTabChange = (v: string) => {
    setActiveTab(v as 'active' | 'archive');
    setPage(0);
  };

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPage(0);
  };

  const createFaultCase = useMutation({
    mutationFn: async () => {
      const { data: faultCase, error } = await supabase
        .from('fault_cases')
        .insert({
          vessel_id: vesselId,
          title,
          description,
          priority,
          category: category || null,
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Upload files
      for (const fileItem of files) {
        const safeName = sanitizeStorageFileName(fileItem.file.name);
        const filePath = `fault-cases/${faultCase.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, fileItem.file);
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        await supabase.from('fault_attachments').insert({
          fault_case_id: faultCase.id,
          file_url: urlData.publicUrl,
          file_name: fileItem.file.name,
          uploaded_by: user?.id,
        });
      }

      return faultCase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      toast({ title: 'Skapat', description: 'Felärendet har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setVesselId('');
    setTitle('');
    setDescription('');
    setPriority('normal');
    setCategory('');
    setFiles([]);
    setFilePreviews([]);
    setFileToAnnotateId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      // Keep preview/annotation only for broadly supported browser formats.
      // iOS camera often returns HEIC, which should be uploaded but not force-previewed.
      const previewableTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

      const newFileItems = selectedFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
      }));

      const newPreviews = newFileItems
        .filter(item => previewableTypes.has(item.file.type))
        .map(item => ({
          id: item.id,
          file: item.file,
          preview: URL.createObjectURL(item.file),
        }));

      setFiles(prev => [...prev, ...newFileItems]);
      setFilePreviews(prev => [...prev, ...newPreviews]);

      const skippedPreviews = newFileItems.filter(item => item.file.type.startsWith('image/') && !previewableTypes.has(item.file.type)).length;
      if (skippedPreviews > 0) {
        toast({
          title: 'Bild tillagd',
          description: 'Vissa bildformat (t.ex. HEIC) laddas upp utan förhandsvisning/markering.',
        });
      }
    } catch (error) {
      console.error('Error handling file selection:', error);
      toast({ title: 'Fel', description: 'Kunde inte hantera filen. Försök igen.', variant: 'destructive' });
    } finally {
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setFilePreviews(prev => {
      const previewToRemove = prev.find(p => p.id === fileId);
      if (previewToRemove) {
        URL.revokeObjectURL(previewToRemove.preview);
      }
      return prev.filter(p => p.id !== fileId);
    });
  };

  const handleAnnotationSave = (annotatedFile: File) => {
    if (!fileToAnnotateId) return;

    // Replace the original file with the annotated version
    setFiles(prev => prev.map(f => 
      f.id === fileToAnnotateId ? { ...f, file: annotatedFile } : f
    ));
    
    // Update preview
    setFilePreviews(prev => {
      const oldPreview = prev.find(p => p.id === fileToAnnotateId);
      if (oldPreview) {
        URL.revokeObjectURL(oldPreview.preview);
      }
      return prev.map(p => 
        p.id === fileToAnnotateId 
          ? { ...p, file: annotatedFile, preview: URL.createObjectURL(annotatedFile) }
          : p
      );
    });
    
    setFileToAnnotateId(null);
  };

  // Get file from the files array (not filePreviews) to ensure we use the latest version
  const fileToAnnotate = fileToAnnotateId 
    ? files.find(f => f.id === fileToAnnotateId)?.file 
    : null;

  const getPriorityColor = (prio: FaultPriority) => {
    switch (prio) {
      case 'kritisk': return 'destructive';
      case 'hog': return 'default';
      case 'normal': return 'secondary';
      case 'lag': return 'outline';
    }
  };

  const getStatusColor = (status: FaultStatus): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (status) {
      case 'avslutad': return 'secondary';
      case 'atgardad': return 'success';
      case 'arbete_pagar': return 'warning';
      case 'varvsatgard': return 'default';
      case 'ny': return 'destructive';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-display font-bold">Felärenden</h1>
            <p className="text-muted-foreground text-sm mt-1">Hantera tekniska och operativa fel</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial"
              onClick={() => printContent('fault-cases-list', { 
                title: 'Felärenden', 
                subtitle: activeTab === 'active' ? 'Aktiva ärenden' : 'Arkiverade ärenden'
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Skriv ut</span>
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 sm:flex-initial">
                  <Plus className="h-4 w-4 mr-2" />
                  Nytt felärende
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Skapa nytt felärende</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createFaultCase.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Fartyg *</Label>
                  <Select value={vesselId} onValueChange={setVesselId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fartyg" />
                    </SelectTrigger>
                    <SelectContent>
                      {vessels?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rubrik *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Kort beskrivande rubrik" />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivning *</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Beskriv felet..." />
                </div>

                <div className="space-y-2">
                  <Label>Prioritet *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as FaultPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FAULT_PRIORITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                   </Select>
                </div>

                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as FaultCategory)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FAULT_CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Bilagor (bilder & dokument)</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileSelect}
                      className={`flex-1 ${filePreviews.length > 0 ? 'file:mr-2' : ''}`}
                    />
                    {filePreviews.length > 0 && (
                      <span className="text-sm text-muted-foreground self-center">
                        {filePreviews.length} fil(er) valda
                      </span>
                    )}
                  </div>
                  
                  {/* File previews with annotation option */}
                  {filePreviews.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                      {filePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview.preview}
                            alt={preview.file.name}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setFileToAnnotateId(preview.id)}
                              title="Markera på bilden"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRemoveFile(preview.id)}
                              title="Ta bort"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">{preview.file.name}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Non-image files list */}
                  {files.filter(f => !filePreviews.some(p => p.id === f.id)).length > 0 && (
                    <div className="space-y-1 mt-2">
                      {files.filter(f => !filePreviews.some(p => p.id === f.id)).map((fileItem) => (
                        <div key={fileItem.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                          <span className="truncate">{fileItem.file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveFile(fileItem.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Tips: Klicka på pennan för att markera läckage eller skador på bilden
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createFaultCase.isPending || !vesselId}>
                    {createFaultCase.isPending ? 'Skapar...' : 'Skapa felärende'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Image Annotator Dialog */}
          {fileToAnnotate && (
            <ImageAnnotator
              file={fileToAnnotate}
              open={!!fileToAnnotate}
              onSave={handleAnnotationSave}
              onCancel={() => setFileToAnnotateId(null)}
            />
          )}
          </div>
        </div>

        {/* Tabs for active/archive */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Aktiva
            </TabsTrigger>
            <TabsTrigger value="archive" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Arkiv
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <Card>
          <CardHeader className="py-3 md:py-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 md:gap-4 grid-cols-2 lg:grid-cols-4">
              <Select value={filterVessel} onValueChange={handleFilterChange(setFilterVessel)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alla fartyg" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla fartyg</SelectItem>
                  {vessels?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeTab === 'active' && (
                <Select value={filterStatus} onValueChange={handleFilterChange(setFilterStatus)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Alla statusar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla statusar</SelectItem>
                    {Object.entries(FAULT_STATUS_LABELS)
                      .filter(([key]) => key !== 'avslutad')
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterPriority} onValueChange={handleFilterChange(setFilterPriority)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alla prioriteter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla prioriteter</SelectItem>
                  {Object.entries(FAULT_PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Sök..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div id="fault-cases-list">
          {isLoading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          ) : faultCases?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Inga felärenden hittades</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-2 md:hidden">
                {faultCases?.map((faultCase) => (
                  <Card 
                    key={faultCase.id}
                    className="cursor-pointer active:bg-accent/50 transition-colors"
                    onClick={() => navigate(`/portal/fault-cases/${faultCase.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-medium text-sm line-clamp-1">{faultCase.title}</span>
                        <Badge variant={getPriorityColor(faultCase.priority as FaultPriority)} className="text-xs flex-shrink-0">
                          {FAULT_PRIORITY_LABELS[faultCase.priority as FaultPriority]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>{(faultCase as any).vessel?.name}</span>
                          <span>•</span>
                          <span>{format(new Date(faultCase.created_at), 'd MMM', { locale: sv })}</span>
                          {(faultCase as any).category && (
                            <>
                              <span>•</span>
                              <span>{FAULT_CATEGORY_LABELS[(faultCase as any).category as FaultCategory] || (faultCase as any).category}</span>
                            </>
                          )}
                          {(faultCase as any).assigned_profile?.full_name && (
                            <>
                              <span>•</span>
                              <span>{(faultCase as any).assigned_profile.full_name}</span>
                            </>
                          )}
                        </div>
                        <Badge variant={getStatusColor(faultCase.status as FaultStatus)} className="text-xs">
                          {FAULT_STATUS_LABELS[faultCase.status as FaultStatus]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table view */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b">Rubrik</th>
                    <th className="text-left p-2 border-b">Fartyg</th>
                    <th className="text-left p-2 border-b">Kategori</th>
                    <th className="text-left p-2 border-b">Prioritet</th>
                    <th className="text-left p-2 border-b">Status</th>
                    <th className="text-left p-2 border-b">Ansvarig</th>
                    <th className="text-left p-2 border-b">Deadline</th>
                    <th className="text-left p-2 border-b">Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {faultCases?.map((faultCase) => {
                    const deadline = (faultCase as any).deadline;
                    const isOverdue = deadline && new Date(deadline + 'T00:00:00') < new Date() && faultCase.status !== 'avslutad';
                    return (
                      <tr 
                        key={faultCase.id} 
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => navigate(`/portal/fault-cases/${faultCase.id}`)}
                      >
                        <td className="p-2 border-b font-medium">{faultCase.title}</td>
                        <td className="p-2 border-b">{(faultCase as any).vessel?.name}</td>
                        <td className="p-2 border-b text-sm text-muted-foreground">
                          {(faultCase as any).category ? FAULT_CATEGORY_LABELS[(faultCase as any).category as FaultCategory] || (faultCase as any).category : '–'}
                        </td>
                        <td className="p-2 border-b">
                          <Badge variant={getPriorityColor(faultCase.priority as FaultPriority)}>
                            {FAULT_PRIORITY_LABELS[faultCase.priority as FaultPriority]}
                          </Badge>
                        </td>
                        <td className="p-2 border-b">
                          <Badge variant={getStatusColor(faultCase.status as FaultStatus)}>
                            {FAULT_STATUS_LABELS[faultCase.status as FaultStatus]}
                          </Badge>
                        </td>
                        <td className="p-2 border-b text-sm text-muted-foreground">
                          {(faultCase as any).assigned_profile?.full_name || '–'}
                        </td>
                        <td className={`p-2 border-b text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {deadline ? format(new Date(deadline + 'T00:00:00'), 'd MMM yyyy', { locale: sv }) : '–'}
                        </td>
                        <td className="p-2 border-b text-muted-foreground text-sm">
                          {format(new Date(faultCase.created_at), 'PPP', { locale: sv })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Visar {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount || 0)} av {totalCount} ärenden
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Föregående</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      <span className="hidden sm:inline">Nästa</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}