import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { History, Plus, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Link } from 'react-router-dom';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string | null;
  published_at: string;
  is_published: boolean;
  created_at: string;
}

export default function BackofficeChangelog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);

  const [formData, setFormData] = useState({
    version: '',
    title: '',
    description: '',
    is_published: false,
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['changelog-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('changelog')
        .select('*')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data as ChangelogEntry[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('changelog').insert({
        version: data.version,
        title: data.title,
        description: data.description || null,
        is_published: data.is_published,
        published_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelog-admin'] });
      toast({ title: 'Uppdatering skapad' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Något gick fel', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('changelog')
        .update({
          version: data.version,
          title: data.title,
          description: data.description || null,
          is_published: data.is_published,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelog-admin'] });
      toast({ title: 'Uppdatering sparad' });
      resetForm();
    },
    onError: () => {
      toast({ title: 'Något gick fel', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('changelog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelog-admin'] });
      toast({ title: 'Uppdatering raderad' });
    },
    onError: () => {
      toast({ title: 'Något gick fel', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ version: '', title: '', description: '', is_published: false });
    setEditingEntry(null);
    setDialogOpen(false);
  };

  const handleEdit = (entry: ChangelogEntry) => {
    setEditingEntry(entry);
    setFormData({
      version: entry.version,
      title: entry.title,
      description: entry.description || '',
      is_published: entry.is_published,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Uppdateringshistorik
          </h1>
          <p className="text-muted-foreground mt-1">
            Hantera changelog och uppdateringar
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/changelog" target="_blank">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visa publik sida
            </Link>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny uppdatering
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Redigera uppdatering' : 'Ny uppdatering'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    placeholder="v1.2.3"
                    value={formData.version}
                    onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    placeholder="Ny funktion: Passagerarregistrering"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beskrivning</Label>
                  <Textarea
                    id="description"
                    placeholder="Detaljerad beskrivning av ändringarna..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="is_published">Publicerad</Label>
                  <Switch
                    id="is_published"
                    checked={formData.is_published}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingEntry ? 'Spara' : 'Skapa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="font-mono">
                      {entry.version}
                    </Badge>
                    <CardTitle className="text-lg">{entry.title}</CardTitle>
                    {!entry.is_published && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Utkast
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(entry.published_at), 'd MMM yyyy', { locale: sv })}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Radera uppdatering?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Detta kommer permanent radera "{entry.title}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Avbryt</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(entry.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Radera
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              {entry.description && (
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {entry.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Inga uppdateringar ännu. Skapa din första!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}