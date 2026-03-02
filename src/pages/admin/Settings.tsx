import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgCertificateTypes } from '@/hooks/useOrgCertificateTypes';
import { useQuery } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Plus, Trash2, Award, GraduationCap, Settings, Building2 } from 'lucide-react';

export default function SettingsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();

  // Certificate types state
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  // Exercise categories state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: { id: string; name: string; type: 'cert' | 'exercise' } | null }>({ open: false, item: null });

  const { data: certificateTypes } = useOrgCertificateTypes(selectedOrgId);

  const { data: organization } = useQuery({
    queryKey: ['organization-detail', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', selectedOrgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: exerciseCategories } = useQuery({
    queryKey: ['exercise-categories', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('exercise_categories')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Certificate type mutations
  const createCertType = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No organization found');
      const { error } = await supabase.from('certificate_types').insert({
        name: typeName,
        description: typeDescription || null,
        organization_id: selectedOrgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp skapad' });
      setTypeDialogOpen(false);
      setTypeName('');
      setTypeDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certificate_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp borttagen' });
      setDeleteConfirm({ open: false, item: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  // Exercise category mutations
  const createCategory = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const { error } = await supabase
        .from('exercise_categories')
        .insert({ name: catName, description: catDescription || null, organization_id: selectedOrgId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Kategori skapad' });
      setCatDialogOpen(false);
      setCatName('');
      setCatDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Kategori borttagen' });
      setDeleteConfirm({ open: false, item: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const handleDeleteConfirm = () => {
    if (!deleteConfirm.item) return;
    if (deleteConfirm.item.type === 'cert') {
      deleteCertType.mutate(deleteConfirm.item.id);
    } else {
      deleteCategory.mutate(deleteConfirm.item.id);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Inställningar
          </h1>
          <p className="text-muted-foreground mt-1">Hantera certifikatstyper och övningskategorier</p>
        </div>

        <Tabs defaultValue="organization" className="space-y-4">
          <TabsList>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="certificate-types" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Certifikatstyper
            </TabsTrigger>
            <TabsTrigger value="exercise-categories" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Övningskategorier
            </TabsTrigger>
          </TabsList>

          {/* Organization Info Tab */}
          <TabsContent value="organization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Rederiinformation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Namn</Label>
                    <p className="font-medium">{organization?.name || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Org.nummer</Label>
                    <p className="font-medium">{organization?.org_number || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Kontakt e-post</Label>
                    <p className="font-medium">{organization?.contact_email || '–'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Kontakt telefon</Label>
                    <p className="font-medium">{organization?.contact_phone || '–'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificate Types Tab */}
          <TabsContent value="certificate-types" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Ny certifikattyp
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Skapa certifikattyp</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cert-name">Namn *</Label>
                      <Input
                        id="cert-name"
                        value={typeName}
                        onChange={(e) => setTypeName(e.target.value)}
                        placeholder="T.ex. Befäls Behörighet klass 6"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cert-desc">Beskrivning</Label>
                      <Textarea
                        id="cert-desc"
                        value={typeDescription}
                        onChange={(e) => setTypeDescription(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => createCertType.mutate()}
                      disabled={!typeName || createCertType.isPending}
                      className="w-full"
                    >
                      {createCertType.isPending ? 'Skapar...' : 'Skapa'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {certificateTypes?.map((ct) => (
                <Card key={ct.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Award className="h-5 w-5" />
                        {ct.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm({ open: true, item: { id: ct.id, name: ct.name, type: 'cert' } })}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  {ct.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{ct.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
              {(!certificateTypes || certificateTypes.length === 0) && (
                <p className="text-muted-foreground col-span-full text-center py-8">
                  Inga certifikattyper skapade ännu
                </p>
              )}
            </div>
          </TabsContent>

          {/* Exercise Categories Tab */}
          <TabsContent value="exercise-categories" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Ny kategori
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ny övningskategori</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Namn *</Label>
                      <Input
                        id="cat-name"
                        value={catName}
                        onChange={e => setCatName(e.target.value)}
                        placeholder="T.ex. MOB-övning"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-desc">Beskrivning</Label>
                      <Textarea
                        id="cat-desc"
                        value={catDescription}
                        onChange={e => setCatDescription(e.target.value)}
                        placeholder="Valfri beskrivning av övningen"
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createCategory.mutate()}
                      disabled={createCategory.isPending || !catName.trim()}
                    >
                      {createCategory.isPending ? 'Skapar...' : 'Skapa kategori'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {exerciseCategories && exerciseCategories.length > 0 ? (
                exerciseCategories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm({ open: true, item: { id: category.id, name: category.name, type: 'exercise' } })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">Inga övningskategorier skapade</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title={deleteConfirm.item?.type === 'cert' ? 'Ta bort certifikattyp' : 'Ta bort övningskategori'}
        description={`Är du säker på att du vill ta bort "${deleteConfirm.item?.name}"?`}
        confirmLabel="Ta bort"
        onConfirm={handleDeleteConfirm}
      />
    </MainLayout>
  );
}
