import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UtensilsCrossed } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Menu } from '@/lib/booking-types';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CourseItem {
  type: 'forratt' | 'varmratt' | 'dessert' | 'buffe';
  name: string;
  description?: string;
}

export default function MenusAdmin() {
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  const [showDialog, setShowDialog] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');
  const [allergenInfo, setAllergenInfo] = useState('');
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [isActive, setIsActive] = useState(true);

  const { data: menus, isLoading } = useQuery({
    queryKey: ['menus-admin', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data as Menu[];
    },
    enabled: !!selectedOrgId,
  });

  const resetForm = () => {
    setName('');
    setSeason('');
    setDescription('');
    setAllergenInfo('');
    setCourses([]);
    setIsActive(true);
    setEditingMenu(null);
  };

  const openEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setName(menu.name);
    setSeason(menu.season || '');
    setDescription(menu.description || '');
    setAllergenInfo(menu.allergen_info || '');
    setCourses(menu.courses as CourseItem[] || []);
    setIsActive(menu.is_active);
    setShowDialog(true);
  };

  const openNew = () => {
    resetForm();
    setShowDialog(true);
  };

  const saveMenu = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Inget rederi valt');

      if (editingMenu) {
        const { error } = await supabase
          .from('menus')
          .update({
            name,
            season: season || null,
            description: description || null,
            allergen_info: allergenInfo || null,
            courses: courses as unknown as any,
            is_active: isActive,
          })
          .eq('id', editingMenu.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('menus')
          .insert({
            name,
            season: season || null,
            description: description || null,
            allergen_info: allergenInfo || null,
            courses: courses as unknown as any,
            is_active: isActive,
            organization_id: selectedOrgId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingMenu ? 'Meny uppdaterad!' : 'Meny skapad!');
      queryClient.invalidateQueries({ queryKey: ['menus-admin'] });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const deleteMenu = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menus')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Meny raderad');
      queryClient.invalidateQueries({ queryKey: ['menus-admin'] });
      setDeleteMenuId(null);
    },
    onError: (error: any) => {
      toast.error('Kunde inte radera: ' + error.message);
    },
  });

  const addCourse = () => {
    setCourses([...courses, { type: 'varmratt', name: '', description: '' }]);
  };

  const updateCourse = (index: number, field: keyof CourseItem, value: string) => {
    const updated = [...courses];
    updated[index] = { ...updated[index], [field]: value };
    setCourses(updated);
  };

  const removeCourse = (index: number) => {
    setCourses(courses.filter((_, i) => i !== index));
  };

  const courseTypeLabels: Record<string, string> = {
    forratt: 'Förrätt',
    varmratt: 'Varmrätt',
    dessert: 'Dessert',
    buffe: 'Buffé',
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Menyregister</h1>
            <p className="text-muted-foreground">Hantera menyer för bokningar</p>
          </div>
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Ny meny
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Laddar...</div>
        ) : menus && menus.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {menus.map((menu) => (
              <Card key={menu.id} className={!menu.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4" />
                        {menu.name}
                      </CardTitle>
                      {menu.season && (
                        <Badge variant="secondary" className="mt-1">{menu.season}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(menu)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeleteMenuId(menu.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {menu.description && (
                    <p className="text-sm text-muted-foreground mb-2">{menu.description}</p>
                  )}
                  {(menu.courses as CourseItem[])?.length > 0 && (
                    <div className="space-y-1">
                      {(menu.courses as CourseItem[]).map((course, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{courseTypeLabels[course.type]}:</span>{' '}
                          {course.name}
                        </div>
                      ))}
                    </div>
                  )}
                  {!menu.is_active && (
                    <Badge variant="outline" className="mt-2">Inaktiv</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Inga menyer skapade ännu</p>
              <Button className="mt-4" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Skapa första menyn
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMenu ? 'Redigera meny' : 'Ny meny'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Namn *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="T.ex. Sommarmeny 2024"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Säsong</Label>
                  <Input
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="T.ex. Sommar, Vinter, Hela året"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kort beskrivning av menyn..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Allergeninformation</Label>
                <Textarea
                  value={allergenInfo}
                  onChange={(e) => setAllergenInfo(e.target.value)}
                  placeholder="Standard allergeninfo för denna meny..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Rätter</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCourse}>
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till rätt
                  </Button>
                </div>
                {courses.length > 0 ? (
                  <div className="space-y-2">
                    {courses.map((course, index) => (
                      <div key={index} className="flex gap-2 items-start p-2 border rounded">
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={course.type}
                          onChange={(e) => updateCourse(index, 'type', e.target.value)}
                        >
                          <option value="forratt">Förrätt</option>
                          <option value="varmratt">Varmrätt</option>
                          <option value="dessert">Dessert</option>
                          <option value="buffe">Buffé</option>
                        </select>
                        <Input
                          placeholder="Rättens namn"
                          value={course.name}
                          onChange={(e) => updateCourse(index, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCourse(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Inga rätter tillagda</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label>Aktiv (visas som valbar)</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Avbryt
                </Button>
                <Button 
                  onClick={() => saveMenu.mutate()} 
                  disabled={!name || saveMenu.isPending}
                >
                  {saveMenu.isPending ? 'Sparar...' : 'Spara'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteMenuId}
          onOpenChange={() => setDeleteMenuId(null)}
          title="Radera meny?"
          description="Är du säker på att du vill radera denna meny? Befintliga bokningar som använder menyn påverkas inte."
          confirmLabel="Radera"
          variant="destructive"
          onConfirm={() => deleteMenuId && deleteMenu.mutate(deleteMenuId)}
        />
      </div>
    </MainLayout>
  );
}
