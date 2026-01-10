import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Wine, GlassWater } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DrinkPackage } from '@/lib/booking-types';
import { useOrganization } from '@/contexts/OrganizationContext';

interface DrinkExtra {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface DrinkItem {
  name: string;
  quantity?: string;
}

export default function DrinksAdmin() {
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  const [activeTab, setActiveTab] = useState('packages');
  
  // Package state
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<DrinkPackage | null>(null);
  const [deletePackageId, setDeletePackageId] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packageContents, setPackageContents] = useState<DrinkItem[]>([]);
  const [packageIsActive, setPackageIsActive] = useState(true);

  // Extra state
  const [showExtraDialog, setShowExtraDialog] = useState(false);
  const [editingExtra, setEditingExtra] = useState<DrinkExtra | null>(null);
  const [deleteExtraId, setDeleteExtraId] = useState<string | null>(null);
  const [extraName, setExtraName] = useState('');
  const [extraDescription, setExtraDescription] = useState('');
  const [extraIsActive, setExtraIsActive] = useState(true);

  // Fetch packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['drink-packages-admin', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('drink_packages')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data as DrinkPackage[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch extras
  const { data: extras, isLoading: extrasLoading } = useQuery({
    queryKey: ['drink-extras-admin', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('drink_extras')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data as DrinkExtra[];
    },
    enabled: !!selectedOrgId,
  });

  // Package functions
  const resetPackageForm = () => {
    setPackageName('');
    setPackageDescription('');
    setPackageContents([]);
    setPackageIsActive(true);
    setEditingPackage(null);
  };

  const openEditPackage = (pkg: DrinkPackage) => {
    setEditingPackage(pkg);
    setPackageName(pkg.name);
    setPackageDescription(pkg.description || '');
    setPackageContents(pkg.contents as DrinkItem[] || []);
    setPackageIsActive(pkg.is_active);
    setShowPackageDialog(true);
  };

  const openNewPackage = () => {
    resetPackageForm();
    setShowPackageDialog(true);
  };

  const savePackage = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Inget rederi valt');

      const data = {
        name: packageName,
        description: packageDescription || null,
        contents: packageContents as unknown as any,
        is_active: packageIsActive,
        organization_id: selectedOrgId,
      };

      if (editingPackage) {
        const { error } = await supabase
          .from('drink_packages')
          .update({
            name: packageName,
            description: packageDescription || null,
            contents: packageContents as unknown as any,
            is_active: packageIsActive,
          })
          .eq('id', editingPackage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('drink_packages')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingPackage ? 'Dryckespaket uppdaterat!' : 'Dryckespaket skapat!');
      queryClient.invalidateQueries({ queryKey: ['drink-packages-admin'] });
      setShowPackageDialog(false);
      resetPackageForm();
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('drink_packages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dryckespaket raderat');
      queryClient.invalidateQueries({ queryKey: ['drink-packages-admin'] });
      setDeletePackageId(null);
    },
    onError: (error: any) => {
      toast.error('Kunde inte radera: ' + error.message);
    },
  });

  const addDrinkItem = () => {
    setPackageContents([...packageContents, { name: '', quantity: '' }]);
  };

  const updateDrinkItem = (index: number, field: keyof DrinkItem, value: string) => {
    const updated = [...packageContents];
    updated[index] = { ...updated[index], [field]: value };
    setPackageContents(updated);
  };

  const removeDrinkItem = (index: number) => {
    setPackageContents(packageContents.filter((_, i) => i !== index));
  };

  // Extra functions
  const resetExtraForm = () => {
    setExtraName('');
    setExtraDescription('');
    setExtraIsActive(true);
    setEditingExtra(null);
  };

  const openEditExtra = (extra: DrinkExtra) => {
    setEditingExtra(extra);
    setExtraName(extra.name);
    setExtraDescription(extra.description || '');
    setExtraIsActive(extra.is_active);
    setShowExtraDialog(true);
  };

  const openNewExtra = () => {
    resetExtraForm();
    setShowExtraDialog(true);
  };

  const saveExtra = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Inget rederi valt');

      if (editingExtra) {
        const { error } = await supabase
          .from('drink_extras')
          .update({
            name: extraName,
            description: extraDescription || null,
            is_active: extraIsActive,
          })
          .eq('id', editingExtra.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('drink_extras')
          .insert({
            name: extraName,
            description: extraDescription || null,
            is_active: extraIsActive,
            organization_id: selectedOrgId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingExtra ? 'Tillval uppdaterat!' : 'Tillval skapat!');
      queryClient.invalidateQueries({ queryKey: ['drink-extras-admin'] });
      setShowExtraDialog(false);
      resetExtraForm();
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const deleteExtra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('drink_extras')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tillval raderat');
      queryClient.invalidateQueries({ queryKey: ['drink-extras-admin'] });
      setDeleteExtraId(null);
    },
    onError: (error: any) => {
      toast.error('Kunde inte radera: ' + error.message);
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dryckeshantering</h1>
          <p className="text-muted-foreground">Hantera dryckespaket och tillval för bokningar</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="packages" className="flex items-center gap-2">
              <Wine className="h-4 w-4" />
              Dryckespaket
            </TabsTrigger>
            <TabsTrigger value="extras" className="flex items-center gap-2">
              <GlassWater className="h-4 w-4" />
              Tillval
            </TabsTrigger>
          </TabsList>

          {/* Packages Tab */}
          <TabsContent value="packages" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewPackage}>
                <Plus className="mr-2 h-4 w-4" />
                Nytt dryckespaket
              </Button>
            </div>

            {packagesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Laddar...</div>
            ) : packages && packages.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages.map((pkg) => (
                  <Card key={pkg.id} className={!pkg.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Wine className="h-4 w-4" />
                          {pkg.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditPackage(pkg)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeletePackageId(pkg.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {pkg.description && (
                        <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>
                      )}
                      {(pkg.contents as DrinkItem[])?.length > 0 && (
                        <div className="space-y-1">
                          {(pkg.contents as DrinkItem[]).map((item, i) => (
                            <div key={i} className="text-sm">
                              {item.quantity && <span className="font-medium">{item.quantity} </span>}
                              {item.name}
                            </div>
                          ))}
                        </div>
                      )}
                      {!pkg.is_active && (
                        <Badge variant="outline" className="mt-2">Inaktiv</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Wine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Inga dryckespaket skapade ännu</p>
                  <Button className="mt-4" onClick={openNewPackage}>
                    <Plus className="mr-2 h-4 w-4" />
                    Skapa första paketet
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Extras Tab */}
          <TabsContent value="extras" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openNewExtra}>
                <Plus className="mr-2 h-4 w-4" />
                Nytt tillval
              </Button>
            </div>

            {extrasLoading ? (
              <div className="text-center py-8 text-muted-foreground">Laddar...</div>
            ) : extras && extras.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {extras.map((extra) => (
                  <Card key={extra.id} className={!extra.is_active ? 'opacity-60' : ''}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <GlassWater className="h-4 w-4" />
                          {extra.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditExtra(extra)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteExtraId(extra.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {extra.description && (
                        <p className="text-sm text-muted-foreground">{extra.description}</p>
                      )}
                      {!extra.is_active && (
                        <Badge variant="outline" className="mt-2">Inaktiv</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <GlassWater className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Inga tillval skapade ännu</p>
                  <Button className="mt-4" onClick={openNewExtra}>
                    <Plus className="mr-2 h-4 w-4" />
                    Skapa första tillvalet
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Package Dialog */}
        <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPackage ? 'Redigera dryckespaket' : 'Nytt dryckespaket'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn *</Label>
                <Input
                  value={packageName}
                  onChange={(e) => setPackageName(e.target.value)}
                  placeholder="T.ex. Standardpaket, Premiumpaket"
                />
              </div>

              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Textarea
                  value={packageDescription}
                  onChange={(e) => setPackageDescription(e.target.value)}
                  placeholder="Beskrivning av paketet..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Innehåll</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addDrinkItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till
                  </Button>
                </div>
                {packageContents.length > 0 ? (
                  <div className="space-y-2">
                    {packageContents.map((item, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Antal/mängd"
                          value={item.quantity || ''}
                          onChange={(e) => updateDrinkItem(index, 'quantity', e.target.value)}
                          className="w-24"
                        />
                        <Input
                          placeholder="Dryck"
                          value={item.name}
                          onChange={(e) => updateDrinkItem(index, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDrinkItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Inget innehåll tillagt</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={packageIsActive}
                  onCheckedChange={setPackageIsActive}
                />
                <Label>Aktiv (visas som valbar)</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowPackageDialog(false)}>
                  Avbryt
                </Button>
                <Button 
                  onClick={() => savePackage.mutate()} 
                  disabled={!packageName || savePackage.isPending}
                >
                  {savePackage.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Extra Dialog */}
        <Dialog open={showExtraDialog} onOpenChange={setShowExtraDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingExtra ? 'Redigera tillval' : 'Nytt tillval'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Namn *</Label>
                <Input
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="T.ex. Välkomstdrink, Avec, Kaffe/Te"
                />
              </div>

              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Textarea
                  value={extraDescription}
                  onChange={(e) => setExtraDescription(e.target.value)}
                  placeholder="Beskrivning..."
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={extraIsActive}
                  onCheckedChange={setExtraIsActive}
                />
                <Label>Aktiv</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowExtraDialog(false)}>
                  Avbryt
                </Button>
                <Button 
                  onClick={() => saveExtra.mutate()} 
                  disabled={!extraName || saveExtra.isPending}
                >
                  {saveExtra.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmations */}
        <ConfirmDialog
          open={!!deletePackageId}
          onOpenChange={() => setDeletePackageId(null)}
          title="Radera dryckespaket?"
          description="Är du säker? Befintliga bokningar påverkas inte."
          confirmLabel="Radera"
          variant="destructive"
          onConfirm={() => deletePackageId && deletePackage.mutate(deletePackageId)}
        />

        <ConfirmDialog
          open={!!deleteExtraId}
          onOpenChange={() => setDeleteExtraId(null)}
          title="Radera tillval?"
          description="Är du säker? Befintliga bokningar påverkas inte."
          confirmLabel="Radera"
          variant="destructive"
          onConfirm={() => deleteExtraId && deleteExtra.mutate(deleteExtraId)}
        />
      </div>
    </MainLayout>
  );
}
