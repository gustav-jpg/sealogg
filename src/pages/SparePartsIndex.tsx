import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useSharedVessel } from '@/hooks/useSharedVessel';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Trash2, Edit2, Package, FolderOpen, ChevronDown, ChevronRight, Ship } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function SparePartsIndex() {
  const { user, isAdmin, isSkeppare } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { data: vessels } = useOrgVessels(selectedOrgId ?? null);
  const { selectedVessel, setSelectedVessel } = useSharedVessel();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: '',
    part_number: '',
    location: '',
    quantity: 0,
    min_quantity: 0,
    notes: '',
  });

  const canManage = isAdmin || isSkeppare;

  const { data: spareParts, isLoading } = useQuery({
    queryKey: ['spare-parts', selectedOrgId, selectedVessel],
    queryFn: async () => {
      if (!selectedOrgId || !selectedVessel) return [];
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*, vessels(name)')
        .eq('organization_id', selectedOrgId)
        .eq('vessel_id', selectedVessel)
        .order('category')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId && !!selectedVessel,
  });

  const createMutation = useMutation({
    mutationFn: async (partData: typeof form) => {
      const { error } = await supabase.from('spare_parts').insert({
        ...partData,
        vessel_id: selectedVessel,
        quantity: partData.quantity || 0,
        min_quantity: partData.min_quantity || 0,
        organization_id: selectedOrgId!,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      toast.success('Reservdel tillagd');
      resetForm();
      setDialogOpen(false);
    },
    onError: () => toast.error('Kunde inte lägga till reservdel'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...partData }: any) => {
      const { error } = await supabase.from('spare_parts').update(partData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      toast.success('Reservdel uppdaterad');
      resetForm();
      setDialogOpen(false);
      setEditingPart(null);
    },
    onError: () => toast.error('Kunde inte uppdatera reservdel'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spare_parts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      toast.success('Reservdel borttagen');
    },
    onError: () => toast.error('Kunde inte ta bort reservdel'),
  });

  const resetForm = () => {
    setForm({ name: '', category: '', part_number: '', location: '', quantity: 0, min_quantity: 0, notes: '' });
  };

  const handleEdit = (part: any) => {
    setEditingPart(part);
    setForm({
      name: part.name,
      category: part.category,
      part_number: part.part_number || '',
      location: part.location || '',
      quantity: part.quantity || 0,
      min_quantity: part.min_quantity || 0,
      notes: part.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.category.trim()) {
      toast.error('Fyll i namn och kategori');
      return;
    }
    if (editingPart) {
      updateMutation.mutate({ id: editingPart.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filteredParts = spareParts?.filter(part => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      part.name.toLowerCase().includes(term) ||
      part.category.toLowerCase().includes(term) ||
      (part.part_number && part.part_number.toLowerCase().includes(term)) ||
      (part.location && part.location.toLowerCase().includes(term))
    );
  });

  // Group by category
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const groupedParts = (filteredParts || []).reduce<Record<string, typeof filteredParts>>((acc, part) => {
    const cat = part.category || 'Övrigt';
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(part);
    return acc;
  }, {});
  const sortedCategories = Object.keys(groupedParts).sort();

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const expandAll = () => setExpandedCategories(new Set(sortedCategories));
  const collapseAll = () => setExpandedCategories(new Set());

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Reservdelsindex</h1>
            <p className="text-muted-foreground text-sm">Hantera reservdelar per fartyg</p>
          </div>
          {canManage && selectedVessel && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) { resetForm(); setEditingPart(null); }
            }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Lägg till reservdel</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingPart ? 'Redigera reservdel' : 'Ny reservdel'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Namn *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="t.ex. Impeller" />
                  </div>
                  <div>
                    <Label>Kategori *</Label>
                    <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="t.ex. Huvudmaskin SB" />
                  </div>
                  <div>
                    <Label>Artikelnummer</Label>
                    <Input value={form.part_number} onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))} placeholder="t.ex. VP29012-12939" />
                  </div>
                  <div>
                    <Label>Förvaringsplats</Label>
                    <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="t.ex. Maskinrum, Hylla 3" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Antal i lager</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <Label>Minsta antal</Label>
                      <Input type="number" min={0} value={form.min_quantity} onChange={e => setForm(f => ({ ...f, min_quantity: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Anteckningar</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Valfria anteckningar..." />
                  </div>
                  <Button onClick={handleSubmit} className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingPart ? 'Spara ändringar' : 'Lägg till'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Vessel selector */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Välj fartyg..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels?.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedVessel && (
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Sök namn, kategori, artikelnummer..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!selectedVessel ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Ship className="h-8 w-8" />
            <p>Välj ett fartyg för att se reservdelar</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Laddar...</div>
        ) : !filteredParts?.length ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Package className="h-8 w-8" />
            <p>Inga reservdelar hittades</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={expandAll} className="text-xs">Expandera alla</Button>
                <Button variant="outline" size="sm" onClick={collapseAll} className="text-xs">Minimera</Button>
              </div>
              <span className="text-xs text-muted-foreground">
                {sortedCategories.length} kategorier, {filteredParts.length} delar
              </span>
            </div>

            {sortedCategories.map((category) => {
              const parts = groupedParts[category] || [];
              const isExpanded = expandedCategories.has(category);
              const lowStock = parts.filter(p => p.quantity <= p.min_quantity && p.min_quantity > 0).length;

              return (
                <Card key={category} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-3 md:p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <FolderOpen className="h-4 w-4 md:h-5 md:w-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm md:text-base">{category}</span>
                      <Badge variant="secondary" className="text-xs">{parts.length}</Badge>
                      {lowStock > 0 && (
                        <Badge variant="destructive" className="text-xs">{lowStock} lågt lager</Badge>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Namn</TableHead>
                            <TableHead>Artikelnr</TableHead>
                            <TableHead>Plats</TableHead>
                            <TableHead className="text-right">Antal</TableHead>
                            {canManage && <TableHead className="w-20" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parts.map(part => (
                            <TableRow key={part.id}>
                              <TableCell className="font-medium">{part.name}</TableCell>
                              <TableCell className="font-mono text-sm">{part.part_number || '–'}</TableCell>
                              <TableCell>{part.location || '–'}</TableCell>
                              <TableCell className="text-right">
                                <span className={part.quantity <= part.min_quantity && part.min_quantity > 0 ? 'text-destructive font-semibold' : ''}>
                                  {part.quantity}
                                </span>
                                {part.min_quantity > 0 && (
                                  <span className="text-muted-foreground text-xs ml-1">/ min {part.min_quantity}</span>
                                )}
                              </TableCell>
                              {canManage && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(part)}>
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => {
                                        if (confirm('Ta bort denna reservdel?')) {
                                          deleteMutation.mutate(part.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
