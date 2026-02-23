import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Checkbox } from '@/components/ui/checkbox';

import { sanitizeStorageFileName } from '@/lib/storage';
import {
  FolderOpen,
  FolderPlus,
  FileUp,
  FileText,
  Trash2,
  Download,
  ChevronRight,
  Home,
  Users,
  ArrowLeft,
  Pencil,
  Loader2,
  HardDrive,
} from 'lucide-react';

interface Folder {
  id: string;
  organization_id: string;
  parent_folder_id: string | null;
  name: string;
  created_by: string;
  created_at: string;
}

interface DocFile {
  id: string;
  organization_id: string;
  folder_id: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
}

interface FolderAccess {
  id: string;
  folder_id: string;
  role: string;
  granted_by: string;
}

const ROLE_LABELS: Record<string, string> = {
  skeppare: 'Skeppare',
  deckhand: 'Däcksman',
  readonly: 'Läsbehörighet',
};

export default function Documents() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessFolder, setAccessFolder] = useState<Folder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Breadcrumb path
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Dokument' },
  ]);

  // Fetch folders for current level
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['doc-folders', selectedOrgId, currentFolderId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      let query = supabase
        .from('document_folders')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');

      if (currentFolderId) {
        query = query.eq('parent_folder_id', currentFolderId);
      } else {
        query = query.is('parent_folder_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Folder[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch files for current folder
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['doc-files', currentFolderId],
    queryFn: async () => {
      if (!currentFolderId) return [];
      const { data, error } = await supabase
        .from('document_files')
        .select('*')
        .eq('folder_id', currentFolderId)
        .order('file_name');
      if (error) throw error;
      return (data || []) as DocFile[];
    },
    enabled: !!currentFolderId,
  });

  // Available roles for access (admin always has access, no need to list)

  // Fetch folder access for selected folder
  const { data: folderAccessList = [] } = useQuery({
    queryKey: ['doc-folder-access', accessFolder?.id],
    queryFn: async () => {
      if (!accessFolder?.id) return [];
      const { data, error } = await supabase
        .from('document_folder_access')
        .select('*')
        .eq('folder_id', accessFolder.id);
      if (error) throw error;
      return (data || []) as FolderAccess[];
    },
    enabled: !!accessFolder?.id,
  });

  // Storage usage
  const { data: storageUsage } = useQuery({
    queryKey: ['doc-storage-usage', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return { used: 0, quota: 500 };
      const { data: files, error } = await supabase
        .from('document_files')
        .select('file_size_bytes')
        .eq('organization_id', selectedOrgId);
      if (error) throw error;
      const used = (files || []).reduce((sum, f) => sum + (f.file_size_bytes || 0), 0);
      
      const { data: settings } = await supabase
        .from('organization_settings')
        .select('storage_quota_mb')
        .eq('organization_id', selectedOrgId)
        .maybeSingle();
      
      return { used, quota: (settings as any)?.storage_quota_mb || 500 };
    },
    enabled: !!selectedOrgId,
  });

  const usedMB = (storageUsage?.used || 0) / (1024 * 1024);
  const quotaMB = storageUsage?.quota || 500;
  const usagePercent = Math.min((usedMB / quotaMB) * 100, 100);

  // Navigate into folder
  const openFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  // Create/edit folder
  const folderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId || !user) throw new Error('Ingen organisation vald');
      if (!folderName.trim()) throw new Error('Ange ett mappnamn');
      
      if (editingFolder) {
        const { error } = await supabase
          .from('document_folders')
          .update({ name: folderName.trim() })
          .eq('id', editingFolder.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_folders')
          .insert({
            organization_id: selectedOrgId,
            parent_folder_id: currentFolderId,
            name: folderName.trim(),
            created_by: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-folders'] });
      toast({ title: editingFolder ? 'Mapp uppdaterad' : 'Mapp skapad' });
      setFolderDialogOpen(false);
      setFolderName('');
      setEditingFolder(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // Delete folder or file
  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'folder' | 'file'; id: string }) => {
      if (type === 'folder') {
        const { error } = await supabase.from('document_folders').delete().eq('id', id);
        if (error) throw error;
      } else {
        // Get file URL to delete from storage too
        const { data: file } = await supabase.from('document_files').select('file_url').eq('id', id).single();
        if (file?.file_url) {
          const path = file.file_url.split('/org-documents/')[1];
          if (path) {
            await supabase.storage.from('org-documents').remove([path]);
          }
        }
        const { error } = await supabase.from('document_files').delete().eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-folders'] });
      queryClient.invalidateQueries({ queryKey: ['doc-files'] });
      queryClient.invalidateQueries({ queryKey: ['doc-storage-usage'] });
      toast({ title: 'Borttaget' });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // Upload files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !currentFolderId || !selectedOrgId || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        // Check quota
        const newUsed = usedMB + file.size / (1024 * 1024);
        if (newUsed > quotaMB) {
          toast({ title: 'Lagringskvot överskriden', description: `Max ${quotaMB} MB tillåtet.`, variant: 'destructive' });
          break;
        }

        const safeName = sanitizeStorageFileName(file.name);
        const storagePath = `${selectedOrgId}/${currentFolderId}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('org-documents')
          .upload(storagePath, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('org-documents')
          .getPublicUrl(storagePath);

        const { error: insertError } = await supabase
          .from('document_files')
          .insert({
            organization_id: selectedOrgId,
            folder_id: currentFolderId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size_bytes: file.size,
            mime_type: file.type || null,
            uploaded_by: user.id,
          });
        if (insertError) throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ['doc-files'] });
      queryClient.invalidateQueries({ queryKey: ['doc-storage-usage'] });
      toast({ title: 'Filer uppladdade' });
    } catch (error: any) {
      toast({ title: 'Uppladdning misslyckades', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Download file
  const downloadFile = async (file: DocFile) => {
    try {
      const path = file.file_url.split('/org-documents/')[1];
      if (!path) throw new Error('Ogiltig filsökväg');

      const { data, error } = await supabase.storage
        .from('org-documents')
        .createSignedUrl(path, 60);
      if (error) throw error;

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({ title: 'Kunde inte ladda ner', description: error.message, variant: 'destructive' });
    }
  };

  // Toggle folder access by role
  const toggleAccess = useMutation({
    mutationFn: async ({ role, hasAccess }: { role: string; hasAccess: boolean }) => {
      if (!accessFolder || !user) throw new Error('Ingen mapp vald');
      if (hasAccess) {
        const { error } = await supabase.from('document_folder_access').delete()
          .eq('folder_id', accessFolder.id)
          .eq('role', role as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('document_folder_access').insert({
          folder_id: accessFolder.id,
          role: role as any,
          granted_by: user.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-folder-access'] });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isLoading = foldersLoading || filesLoading;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Dokument
            </h1>
            <p className="text-muted-foreground text-sm">Organisationens dokumentportal</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              <span>{usedMB.toFixed(1)} / {quotaMB} MB</span>
            </div>
          )}
        </div>

        {/* Storage bar for admin */}
        {isAdmin && (
          <Progress value={usagePercent} className="h-1.5" />
        )}

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:underline ${i === breadcrumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
              >
                {i === 0 ? <Home className="h-3.5 w-3.5 inline mr-1" /> : null}
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Actions (admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingFolder(null);
                setFolderName('');
                setFolderDialogOpen(true);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-1.5" />
              Ny mapp
            </Button>
            {currentFolderId && (
              <>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileUp className="h-4 w-4 mr-1.5" />}
                  Ladda upp
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </>
            )}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Folders */}
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openFolder(folder)}
              >
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-primary" />
                    <span className="font-medium">{folder.name}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setAccessFolder(folder);
                          setAccessDialogOpen(true);
                        }}
                        title="Hantera åtkomst"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingFolder(folder);
                          setFolderName(folder.name);
                          setFolderDialogOpen(true);
                        }}
                        title="Byt namn"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteConfirm({ open: true, type: 'folder', id: folder.id, name: folder.name })}
                        title="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Files */}
            {files.map((file) => (
              <Card key={file.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size_bytes)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => downloadFile(file)}
                      title="Ladda ner"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteConfirm({ open: true, type: 'file', id: file.id, name: file.file_name })}
                        title="Ta bort"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state */}
            {folders.length === 0 && files.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {currentFolderId ? 'Mappen är tom' : 'Inga mappar ännu'}
                </p>
                <p className="text-sm mt-1">
                  {isAdmin
                    ? currentFolderId
                      ? 'Ladda upp filer eller skapa en undermapp.'
                      : 'Skapa en mapp för att komma igång.'
                    : 'Inga dokument tillgängliga.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Folder create/edit dialog */}
        <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFolder ? 'Byt namn på mapp' : 'Skapa ny mapp'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Mappnamn</Label>
              <Input
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="T.ex. ISM-manualer"
                onKeyDown={(e) => e.key === 'Enter' && folderMutation.mutate()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Avbryt</Button>
              <Button onClick={() => folderMutation.mutate()} disabled={folderMutation.isPending}>
                {editingFolder ? 'Spara' : 'Skapa'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Access management dialog */}
        <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Åtkomst – {accessFolder?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Välj vilka roller som ska ha tillgång till denna mapp och dess undermappar. Administratörer har alltid åtkomst.
            </p>
            <div className="space-y-2 py-2">
              {Object.entries(ROLE_LABELS).map(([role, label]) => {
                const hasAccess = folderAccessList.some(a => a.role === role);
                return (
                  <label
                    key={role}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={hasAccess}
                      onCheckedChange={() =>
                        toggleAccess.mutate({ role, hasAccess })
                      }
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setAccessDialogOpen(false)}>Stäng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <ConfirmDialog
            open={deleteConfirm.open}
            onOpenChange={(open) => !open && setDeleteConfirm(null)}
            title={`Ta bort ${deleteConfirm.type === 'folder' ? 'mapp' : 'fil'}`}
            description={`Är du säker på att du vill ta bort "${deleteConfirm.name}"?${deleteConfirm.type === 'folder' ? ' Alla undermappar och filer tas också bort.' : ''}`}
            confirmLabel="Ta bort"
            variant="destructive"
            onConfirm={() => deleteMutation.mutate({ type: deleteConfirm.type, id: deleteConfirm.id })}
          />
        )}
      </div>
    </MainLayout>
  );
}
