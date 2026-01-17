import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Plus, Trash2, GraduationCap, Ship, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function ExercisesAdmin() {
  const { toast } = useToast();
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; category: { id: string; name: string } | null }>({ open: false, category: null });
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Fetch exercise categories
  const { data: categories } = useQuery({
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

  // Fetch vessels
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

  // Fetch profiles
  const { data: profiles } = useQuery({
    queryKey: ['profiles', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Fetch exercise statistics with more detailed data
  const { data: exerciseStats } = useQuery({
    queryKey: ['exercise-stats', selectedOrgId, selectedVessel, selectedUser],
    queryFn: async () => {
      if (!selectedOrgId) return { byVessel: [], byUser: [], byCategory: [], exercises: [] };
      
      // Get exercises with logbook and crew info
      let query = supabase
        .from('logbook_exercises')
        .select(`
          id,
          exercise_type,
          notes,
          created_at,
          logbook:logbooks!inner(
            id,
            vessel_id,
            date,
            vessel:vessels!inner(id, name, organization_id)
          )
        `)
        .eq('logbook.vessel.organization_id', selectedOrgId)
        .order('created_at', { ascending: false });

      if (selectedVessel !== 'all') {
        query = query.eq('logbook.vessel_id', selectedVessel);
      }

      const { data: exercises, error } = await query;
      if (error) throw error;

      // Get crew for filtered logbooks
      const logbookIds = [...new Set((exercises || []).map((e: any) => e.logbook?.id).filter(Boolean))];
      let crewData: any[] = [];
      if (logbookIds.length > 0) {
        const { data: crew, error: crewError } = await supabase
          .from('logbook_crew')
          .select(`
            logbook_id,
            profile:profiles!logbook_crew_profile_id_fkey(id, full_name)
          `)
          .in('logbook_id', logbookIds);
        if (!crewError) crewData = crew || [];
      }

      // Calculate stats by vessel with category breakdown
      const vesselMap = new Map<string, { name: string; categoryCount: Record<string, number>; lastDate: string }>();
      (exercises || []).forEach((ex: any) => {
        const vesselId = ex.logbook?.vessel_id;
        const vesselName = ex.logbook?.vessel?.name;
        const date = ex.logbook?.date;
        if (vesselId && vesselName) {
          const existing = vesselMap.get(vesselId) || { name: vesselName, categoryCount: {}, lastDate: '' };
          existing.categoryCount[ex.exercise_type] = (existing.categoryCount[ex.exercise_type] || 0) + 1;
          if (!existing.lastDate || date > existing.lastDate) {
            existing.lastDate = date;
          }
          vesselMap.set(vesselId, existing);
        }
      });

      // Calculate stats by user with category breakdown
      const userMap = new Map<string, { name: string; categoryCount: Record<string, number>; lastDate: string }>();
      (exercises || []).forEach((ex: any) => {
        const logbookId = ex.logbook?.id;
        const date = ex.logbook?.date;
        const logbookCrew = crewData.filter(c => c.logbook_id === logbookId);
        logbookCrew.forEach((crew: any) => {
          const userId = crew.profile?.id;
          const userName = crew.profile?.full_name;
          if (userId && userName) {
            if (selectedUser !== 'all' && userId !== selectedUser) return;
            const existing = userMap.get(userId) || { name: userName, categoryCount: {}, lastDate: '' };
            existing.categoryCount[ex.exercise_type] = (existing.categoryCount[ex.exercise_type] || 0) + 1;
            if (!existing.lastDate || date > existing.lastDate) {
              existing.lastDate = date;
            }
            userMap.set(userId, existing);
          }
        });
      });

      // Calculate stats by category
      const categoryMap = new Map<string, number>();
      (exercises || []).forEach((ex: any) => {
        const current = categoryMap.get(ex.exercise_type) || 0;
        categoryMap.set(ex.exercise_type, current + 1);
      });

      // Get unique categories for table headers
      const allCategories = [...new Set((exercises || []).map((ex: any) => ex.exercise_type))];

      return {
        byVessel: Array.from(vesselMap.entries()).map(([id, data]) => ({ id, ...data })),
        byUser: Array.from(userMap.entries()).map(([id, data]) => ({ id, ...data })),
        byCategory: Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count })),
        allCategories,
        total: exercises?.length || 0,
      };
    },
    enabled: !!selectedOrgId,
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('Ingen organisation vald');
      const { error } = await supabase
        .from('exercise_categories')
        .insert({ name, description: description || null, organization_id: selectedOrgId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Kategori skapad', description: 'Övningskategorin har lagts till.' });
      setDialogOpen(false);
      setName('');
      setDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (categoryId: string) => {
      const { error } = await supabase
        .from('exercise_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-categories'] });
      toast({ title: 'Raderad', description: 'Övningskategorin har tagits bort.' });
      setDeleteConfirm({ open: false, category: null });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const getCategoryLabel = (value: string) => {
    const category = categories?.find(c => c.name.toLowerCase().replace(/\s+/g, '_').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a') === value);
    return category?.name || value;
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <GraduationCap className="h-8 w-8" />
              Övningar
            </h1>
            <p className="text-muted-foreground mt-1">Hantera övningskategorier och se statistik</p>
          </div>
        </div>

        <Tabs defaultValue="statistics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="statistics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistik
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Kategorier
            </TabsTrigger>
          </TabsList>

          <TabsContent value="statistics" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Fartyg</Label>
                    <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla fartyg</SelectItem>
                        {vessels?.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[180px]">
                    <Label className="text-xs">Besättningsmedlem</Label>
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alla</SelectItem>
                        {profiles?.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground ml-auto">
                    <span>Totalt: <strong className="text-foreground">{exerciseStats?.total || 0}</strong> övningar</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary per category - compact */}
            <div className="flex flex-wrap gap-2">
              {exerciseStats?.byCategory?.map((stat: any) => (
                <Badge key={stat.name} variant="secondary" className="text-xs py-1 px-2">
                  {getCategoryLabel(stat.name)}: {stat.count}
                </Badge>
              ))}
            </div>

            {/* By Vessel - compact table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Ship className="h-4 w-4" />
                  Per fartyg
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {exerciseStats?.byVessel && exerciseStats.byVessel.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[150px]">Fartyg</TableHead>
                          <TableHead className="w-[100px]">Senast</TableHead>
                          {exerciseStats.allCategories?.map((cat: string) => (
                            <TableHead key={cat} className="text-center w-[80px]">
                              <span className="text-xs truncate block max-w-[70px]" title={getCategoryLabel(cat)}>
                                {getCategoryLabel(cat).substring(0, 10)}
                              </span>
                            </TableHead>
                          ))}
                          <TableHead className="text-right w-[60px]">Totalt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exerciseStats.byVessel.map((stat: any) => {
                          const total = Object.values(stat.categoryCount as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
                          return (
                            <TableRow key={stat.id} className="text-sm">
                              <TableCell className="font-medium py-2">{stat.name}</TableCell>
                              <TableCell className="text-muted-foreground py-2 text-xs">
                                {stat.lastDate ? format(new Date(stat.lastDate), 'd MMM yy', { locale: sv }) : '-'}
                              </TableCell>
                              {exerciseStats.allCategories?.map((cat: string) => (
                                <TableCell key={cat} className="text-center py-2">
                                  {stat.categoryCount[cat] || <span className="text-muted-foreground/50">-</span>}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-semibold py-2">{total}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-6 text-sm">Inga övningar registrerade</p>
                )}
              </CardContent>
            </Card>

            {/* By User - compact table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Per besättningsmedlem
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {exerciseStats?.byUser && exerciseStats.byUser.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs">
                          <TableHead className="w-[150px]">Namn</TableHead>
                          <TableHead className="w-[100px]">Senast</TableHead>
                          {exerciseStats.allCategories?.map((cat: string) => (
                            <TableHead key={cat} className="text-center w-[80px]">
                              <span className="text-xs truncate block max-w-[70px]" title={getCategoryLabel(cat)}>
                                {getCategoryLabel(cat).substring(0, 10)}
                              </span>
                            </TableHead>
                          ))}
                          <TableHead className="text-right w-[60px]">Totalt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exerciseStats.byUser.map((stat: any) => {
                          const total = Object.values(stat.categoryCount as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
                          return (
                            <TableRow key={stat.id} className="text-sm">
                              <TableCell className="font-medium py-2">{stat.name}</TableCell>
                              <TableCell className="text-muted-foreground py-2 text-xs">
                                {stat.lastDate ? format(new Date(stat.lastDate), 'd MMM yy', { locale: sv }) : '-'}
                              </TableCell>
                              {exerciseStats.allCategories?.map((cat: string) => (
                                <TableCell key={cat} className="text-center py-2">
                                  {stat.categoryCount[cat] || <span className="text-muted-foreground/50">-</span>}
                                </TableCell>
                              ))}
                              <TableCell className="text-right font-semibold py-2">{total}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-6 text-sm">Inga övningar registrerade</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Övningskategorier</span>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Lägg till
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Ny övningskategori</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Namn *</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="T.ex. MOB-övning"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Beskrivning</Label>
                          <Textarea
                            id="description"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Valfri beskrivning av övningen"
                            rows={3}
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => createCategory.mutate()}
                          disabled={createCategory.isPending || !name.trim()}
                        >
                          {createCategory.isPending ? 'Skapar...' : 'Skapa kategori'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categories && categories.length > 0 ? (
                  <div className="space-y-2">
                    {categories.map(category => (
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
                          onClick={() => setDeleteConfirm({ open: true, category })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Inga övningskategorier skapade</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Ta bort övningskategori"
        description={`Är du säker på att du vill ta bort "${deleteConfirm.category?.name}"? Detta påverkar inte redan registrerade övningar.`}
        confirmLabel="Ta bort"
        onConfirm={() => deleteConfirm.category && deleteCategory.mutate(deleteConfirm.category.id)}
      />
    </MainLayout>
  );
}
