import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useOrganization } from '@/contexts/OrganizationContext';
import { GraduationCap, Ship, Calendar, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function ExercisesAdmin() {
  const { selectedOrgId } = useOrganization();
  const [selectedVessel, setSelectedVessel] = useState<string>('all');

  // Fetch exercise categories
  const { data: categories } = useQuery({
    queryKey: ['exercise-categories', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('exercise_categories')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
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

  // Fetch all exercises with logbook info
  const { data: exerciseData } = useQuery({
    queryKey: ['exercise-overview', selectedOrgId, selectedVessel],
    queryFn: async () => {
      if (!selectedOrgId) return [];

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

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const getCategoryLabel = (value: string) => {
    const category = categories?.find(c => c.name.toLowerCase().replace(/\s+/g, '_').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a') === value);
    return category?.name || value;
  };

  // Build vessel → category → dates matrix
  const vesselCategoryMatrix = (() => {
    if (!exerciseData || !vessels) return [];

    const filteredVessels = selectedVessel === 'all' ? vessels : vessels.filter(v => v.id === selectedVessel);

    // All unique category keys from exercises
    const allCategoryKeys = [...new Set(exerciseData.map((ex: any) => ex.exercise_type))];
    // Also include categories from admin settings that may not have been exercised
    const adminCategoryKeys = (categories || []).map(c => c.name.toLowerCase().replace(/\s+/g, '_').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a'));
    const mergedKeys = [...new Set([...allCategoryKeys, ...adminCategoryKeys])];

    return filteredVessels.map(vessel => {
      const vesselExercises = exerciseData.filter((ex: any) => ex.logbook?.vessel_id === vessel.id);

      const categoryDetails = mergedKeys.map(catKey => {
        const matching = vesselExercises.filter((ex: any) => ex.exercise_type === catKey);
        const dates = matching.map((ex: any) => ex.logbook?.date).filter(Boolean).sort().reverse();
        const lastDate = dates[0] || null;
        const count = matching.length;
        const monthsSinceLast = lastDate ? differenceInMonths(new Date(), new Date(lastDate)) : null;

        return {
          key: catKey,
          label: getCategoryLabel(catKey),
          count,
          lastDate,
          monthsSinceLast,
        };
      });

      const totalExercises = vesselExercises.length;

      return {
        vessel,
        categoryDetails,
        totalExercises,
      };
    });
  })();

  // Collect all category labels for table headers
  const allCategoryLabels = (() => {
    const allCategoryKeys = [...new Set([
      ...(exerciseData || []).map((ex: any) => ex.exercise_type),
      ...(categories || []).map(c => c.name.toLowerCase().replace(/\s+/g, '_').replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/å/g, 'a')),
    ])];
    return allCategoryKeys.map(key => ({
      key,
      label: getCategoryLabel(key),
    }));
  })();

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <GraduationCap className="h-8 w-8" />
              Övningar
            </h1>
            <p className="text-muted-foreground mt-1">Översikt över genomförda övningar per fartyg</p>
          </div>
        </div>

        {/* Filter */}
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
              <div className="flex gap-4 text-sm text-muted-foreground ml-auto items-center">
                <span>Totalt: <strong className="text-foreground">{exerciseData?.length || 0}</strong> övningar</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview matrix: one card per vessel */}
        {vesselCategoryMatrix.length > 0 ? (
          vesselCategoryMatrix.map(({ vessel, categoryDetails, totalExercises }) => (
            <Collapsible key={vessel.id} defaultOpen={selectedVessel !== 'all'}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-base">
                        <Ship className="h-4 w-4" />
                        {vessel.name}
                      </span>
                      <span className="flex items-center gap-2">
                        {categoryDetails.some(c => c.count === 0) && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {categoryDetails.filter(c => c.count === 0).length} saknas
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {totalExercises} övningar
                        </Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                      </span>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="w-[200px]">Övning</TableHead>
                            <TableHead className="w-[60px] text-center">Antal</TableHead>
                            <TableHead className="w-[130px]">Senast genomförd</TableHead>
                            <TableHead className="w-[130px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryDetails.map(cat => (
                            <TableRow key={cat.key} className="text-sm">
                              <TableCell className="font-medium py-2.5">{cat.label}</TableCell>
                              <TableCell className="text-center py-2.5">
                                {cat.count > 0 ? (
                                  <span className="font-semibold">{cat.count}</span>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5">
                                {cat.lastDate ? (
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {format(new Date(cat.lastDate), 'd MMM yyyy', { locale: sv })}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Aldrig</span>
                                )}
                              </TableCell>
                              <TableCell className="py-2.5">
                                {cat.count === 0 ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    Ej genomförd
                                  </Badge>
                                ) : cat.monthsSinceLast !== null && cat.monthsSinceLast >= 12 ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {'>'} 12 mån sedan
                                  </Badge>
                                ) : cat.monthsSinceLast !== null && cat.monthsSinceLast >= 6 ? (
                                  <Badge variant="outline" className="text-xs gap-1 border-yellow-500 text-yellow-700">
                                    <AlertTriangle className="h-3 w-3" />
                                    {cat.monthsSinceLast} mån sedan
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs gap-1 text-green-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Inga övningar registrerade ännu.
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
