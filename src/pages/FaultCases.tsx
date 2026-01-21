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
  FaultPriority,
  FaultStatus,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wrench, Plus, Filter, Archive, Printer, Pencil, X, ImageIcon } from 'lucide-react';
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

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FaultPriority>('normal');
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
    ],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      if (!selectedOrgId) return [];
      if (vesselIds.length === 0) return [];

      // Always scope fault cases to the currently selected organization
      // (otherwise users with multiple org memberships will see mixed data)
      let query = supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(*)`)
        .in('vessel_id', vesselIds)
        .order('created_at', { ascending: false });

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

  const createFaultCase = useMutation({
    mutationFn: async () => {
      const { data: faultCase, error } = await supabase
        .from('fault_cases')
        .insert({
          vessel_id: vesselId,
          title,
          description,
          priority,
          created_by: user?.id,
        })
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
    setFiles([]);
    setFilePreviews([]);
    setFileToAnnotateId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Create file items with unique IDs
    const newFileItems = selectedFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
    }));
    
    // Find first image to auto-open annotation
    const firstImageItem = newFileItems.find(item => item.file.type.startsWith('image/'));
    
    // Create previews for images
    const newPreviews = newFileItems
      .filter(item => item.file.type.startsWith('image/'))
      .map(item => ({
        id: item.id,
        file: item.file,
        preview: URL.createObjectURL(item.file),
      }));
    
    setFiles(prev => [...prev, ...newFileItems]);
    setFilePreviews(prev => [...prev, ...newPreviews]);
    
    // Auto-open annotation dialog for the first image
    if (firstImageItem) {
      setFileToAnnotateId(firstImageItem.id);
    }
    
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Felärenden</h1>
            <p className="text-muted-foreground mt-1">Hantera tekniska och operativa fel</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => printContent('fault-cases-list', { 
                title: 'Felärenden', 
                subtitle: activeTab === 'active' ? 'Aktiva ärenden' : 'Arkiverade ärenden'
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
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

                <div className="space-y-3">
                  <Label>Bilagor (bilder & dokument)</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
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
                  {files.filter(f => !f.file.type.startsWith('image/')).length > 0 && (
                    <div className="space-y-1 mt-2">
                      {files.filter(f => !f.file.type.startsWith('image/')).map((fileItem) => (
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archive')}>
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
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={filterVessel} onValueChange={setFilterVessel}>
                <SelectTrigger>
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
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

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
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
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div id="fault-cases-list">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
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
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b">Rubrik</th>
                  <th className="text-left p-2 border-b">Fartyg</th>
                  <th className="text-left p-2 border-b">Prioritet</th>
                  <th className="text-left p-2 border-b">Status</th>
                  <th className="text-left p-2 border-b">Datum</th>
                </tr>
              </thead>
              <tbody>
                {faultCases?.map((faultCase) => (
                  <tr 
                    key={faultCase.id} 
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/portal/fault-cases/${faultCase.id}`)}
                  >
                    <td className="p-2 border-b font-medium">{faultCase.title}</td>
                    <td className="p-2 border-b">{(faultCase as any).vessel?.name}</td>
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
                    <td className="p-2 border-b text-muted-foreground text-sm">
                      {format(new Date(faultCase.created_at), 'PPP', { locale: sv })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}