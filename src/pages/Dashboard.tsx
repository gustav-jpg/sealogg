import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Ship, Printer, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { LOGBOOK_STATUS_LABELS } from '@/lib/types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useLogbooksPrint } from '@/hooks/useLogbooksPrint';

type SortField = 'date' | 'vessel' | 'creator';
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const { canEdit } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { printLogbooks } = useLogbooksPrint();
  
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [vesselFilter, setVesselFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: logbooks, isLoading } = useQuery({
    queryKey: ['logbooks', selectedOrgId, monthStart, monthEnd],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data: orgVessels, error: vesselError } = await supabase
        .from('vessels')
        .select('id')
        .eq('organization_id', selectedOrgId);
      if (vesselError) throw vesselError;
      
      const vesselIds = orgVessels?.map(v => v.id) || [];
      if (vesselIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('logbooks')
        .select(`
          *,
          vessel:vessels(*)
        `)
        .in('vessel_id', vesselIds)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (error) throw error;
      
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(l => l.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        
        return data.map(logbook => ({
          ...logbook,
          creator_name: profileMap.get(logbook.created_by) || 'Okänd'
        }));
      }
      
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Get unique vessels and creators for filters
  const vessels = useMemo(() => {
    if (!logbooks) return [];
    const unique = new Map();
    logbooks.forEach(l => {
      const vessel = (l as any).vessel;
      if (vessel) unique.set(vessel.id, vessel.name);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [logbooks]);

  const creators = useMemo(() => {
    if (!logbooks) return [];
    const unique = new Map();
    logbooks.forEach(l => {
      unique.set(l.created_by, (l as any).creator_name);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [logbooks]);

  // Filter and sort logbooks
  const filteredAndSortedLogbooks = useMemo(() => {
    if (!logbooks) return [];
    
    let result = [...logbooks];
    
    // Apply filters
    if (vesselFilter !== 'all') {
      result = result.filter(l => (l as any).vessel?.id === vesselFilter);
    }
    if (creatorFilter !== 'all') {
      result = result.filter(l => l.created_by === creatorFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'vessel':
          comparison = ((a as any).vessel?.name || '').localeCompare((b as any).vessel?.name || '');
          break;
        case 'creator':
          comparison = ((a as any).creator_name || '').localeCompare((b as any).creator_name || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [logbooks, vesselFilter, creatorFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Loggböcker</h1>
            <p className="text-muted-foreground text-sm">Hantera och visa fartygsloggböcker</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => printLogbooks(
                filteredAndSortedLogbooks.map(l => ({
                  id: l.id,
                  date: l.date,
                  status: l.status,
                  vessel: (l as any).vessel,
                  creator_name: (l as any).creator_name
                })),
                { 
                  title: 'Loggböcker', 
                  subtitle: `${filteredAndSortedLogbooks.length} loggböcker`,
                  vesselFilter: vessels.find(v => v.id === vesselFilter)?.name,
                  creatorFilter: creators.find(c => c.id === creatorFilter)?.name
                }
              )}
              disabled={filteredAndSortedLogbooks.length === 0}
            >
              <Printer className="h-4 w-4 mr-1" />
              Skriv ut
            </Button>
            {canEdit && (
              <Button size="sm" asChild>
                <Link to="/portal/logbook/new">
                  <Plus className="h-4 w-4 mr-1" />
                  Ny loggbok
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 px-3 min-w-[140px] justify-center">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium capitalize">
                {format(selectedMonth, 'MMMM yyyy', { locale: sv })}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-3 flex-wrap">
            <Select value={vesselFilter} onValueChange={setVesselFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Alla fartyg" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla fartyg</SelectItem>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="w-[160px] h-8 text-sm">
                <SelectValue placeholder="Alla befäl" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla befäl</SelectItem>
                {creators.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div id="logbooks-list">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredAndSortedLogbooks?.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <Ship className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <h3 className="text-base font-medium mb-1">Inga loggböcker ännu</h3>
                <p className="text-muted-foreground text-sm mb-3">Skapa din första loggbok för att komma igång.</p>
                {canEdit && (
                  <Button size="sm" asChild>
                    <Link to="/portal/logbook/new">
                      <Plus className="h-4 w-4 mr-1" />
                      Skapa loggbok
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead 
                      className="h-9 cursor-pointer select-none"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center">
                        Datum
                        <SortIcon field="date" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="h-9 cursor-pointer select-none"
                      onClick={() => handleSort('vessel')}
                    >
                      <div className="flex items-center">
                        Fartyg
                        <SortIcon field="vessel" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="h-9 cursor-pointer select-none"
                      onClick={() => handleSort('creator')}
                    >
                      <div className="flex items-center">
                        Befäl
                        <SortIcon field="creator" />
                      </div>
                    </TableHead>
                    <TableHead className="h-9">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedLogbooks?.map((logbook) => (
                    <TableRow 
                      key={logbook.id} 
                      className="cursor-pointer"
                      onClick={() => window.location.href = `/portal/logbook/${logbook.id}`}
                    >
                      <TableCell className="py-2 text-muted-foreground text-sm">
                        {format(new Date(logbook.date), 'd MMM yyyy', { locale: sv })}
                      </TableCell>
                      <TableCell className="py-2 font-medium">
                        {(logbook as any).vessel?.name || 'Okänt fartyg'}
                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {(logbook as any).creator_name || 'Okänd'}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge 
                          variant={logbook.status === 'oppen' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
