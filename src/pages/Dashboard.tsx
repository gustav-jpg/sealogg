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
import { Plus, Ship, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Calendar, Fuel, Droplets, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { LOGBOOK_STATUS_LABELS } from '@/lib/types';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { sv } from 'date-fns/locale';


type SortField = 'date' | 'vessel' | 'commander';
type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const { canEdit } = useAuth();
  const { selectedOrgId } = useOrganization();
  
  
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [vesselFilter, setVesselFilter] = useState<string>('all');
  const [commanderFilter, setCommanderFilter] = useState<string>('all');
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
          vessel:vessels(*),
          logbook_crew(
            role,
            profile:profiles(id, full_name)
          )
        `)
        .in('vessel_id', vesselIds)
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (error) throw error;
      
      // Extract commander names from crew
      return (data || []).map(logbook => {
        const commanders = (logbook.logbook_crew || [])
          .filter((c: any) => c.role === 'befalhavare')
          .map((c: any) => c.profile?.full_name)
          .filter(Boolean);
        
        return {
          ...logbook,
          commander_names: commanders.length > 0 ? commanders.join(', ') : null,
          commander_ids: (logbook.logbook_crew || [])
            .filter((c: any) => c.role === 'befalhavare')
            .map((c: any) => c.profile?.id)
        };
      });
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

  const commanders = useMemo(() => {
    if (!logbooks) return [];
    const unique = new Map<string, string>();
    logbooks.forEach(l => {
      const ids = (l as any).commander_ids || [];
      const names = ((l as any).commander_names || '').split(', ').filter(Boolean);
      ids.forEach((id: string, idx: number) => {
        if (id && names[idx]) unique.set(id, names[idx]);
      });
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
    if (commanderFilter !== 'all') {
      result = result.filter(l => (l as any).commander_ids?.includes(commanderFilter));
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
        case 'commander':
          comparison = ((a as any).commander_names || '').localeCompare((b as any).commander_names || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [logbooks, vesselFilter, commanderFilter, sortField, sortDirection]);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Loggböcker</h1>
            <p className="text-muted-foreground text-sm">Hantera och visa fartygsloggböcker</p>
          </div>
          {canEdit && (
            <Button size="sm" asChild className="w-full sm:w-auto">
              <Link to="/portal/logbook/new">
                <Plus className="h-4 w-4 mr-1" />
                Ny Dagsrapport
              </Link>
            </Button>
          )}
        </div>

        {/* Month selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 w-full sm:w-auto justify-center sm:justify-start">
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
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={vesselFilter} onValueChange={setVesselFilter}>
              <SelectTrigger className="flex-1 sm:w-[140px] h-8 text-sm">
                <SelectValue placeholder="Alla fartyg" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla fartyg</SelectItem>
                {vessels.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={commanderFilter} onValueChange={setCommanderFilter}>
              <SelectTrigger className="flex-1 sm:w-[140px] h-8 text-sm">
                <SelectValue placeholder="Alla befäl" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla befäl</SelectItem>
                {commanders.map(c => (
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
                <div key={i} className="h-16 md:h-10 bg-muted animate-pulse rounded" />
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
                      Ny Dagsrapport
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-2 md:hidden">
                {filteredAndSortedLogbooks?.map((logbook) => (
                  <Card 
                    key={logbook.id} 
                    className="cursor-pointer active:bg-accent/50 transition-colors"
                    onClick={() => window.location.href = `/portal/logbook/${logbook.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Ship className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium truncate">{(logbook as any).vessel?.name || 'Okänt fartyg'}</span>
                            <div className="flex items-center gap-1 ml-1">
                              {logbook.bunker_liters && logbook.bunker_liters > 0 && (
                                <Fuel className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              {(logbook as any).water_filled && (
                                <Droplets className="h-3.5 w-3.5 text-blue-500" />
                              )}
                              {(logbook as any).septic_emptied && (
                                <Trash2 className="h-3.5 w-3.5 text-green-600" />
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(logbook.date), 'd MMM yyyy', { locale: sv })}
                          </div>
                          {(logbook as any).commander_names && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Befäl: {(logbook as any).commander_names}
                            </div>
                          )}
                        </div>
                        <Badge 
                          variant={logbook.status === 'oppen' ? 'default' : 'secondary'}
                          className="text-xs flex-shrink-0"
                        >
                          {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="border rounded-lg hidden md:block">
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
                        onClick={() => handleSort('commander')}
                      >
                        <div className="flex items-center">
                          Befäl
                          <SortIcon field="commander" />
                        </div>
                      </TableHead>
                      <TableHead className="h-9 text-center w-[80px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs">B</span>
                          <span className="text-xs">V</span>
                          <span className="text-xs">S</span>
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
                          {(logbook as any).commander_names || <span className="text-muted-foreground italic">Ingen befälhavare</span>}
                        </TableCell>
                        <TableCell className="py-2">
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center justify-center gap-1.5">
                              <Tooltip>
                                <TooltipTrigger>
                                  <Fuel className={`h-3.5 w-3.5 ${logbook.bunker_liters && logbook.bunker_liters > 0 ? 'text-amber-500' : 'text-muted-foreground/20'}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Bunker</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Droplets className={`h-3.5 w-3.5 ${(logbook as any).water_filled ? 'text-blue-500' : 'text-muted-foreground/20'}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Vatten</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Trash2 className={`h-3.5 w-3.5 ${(logbook as any).septic_emptied ? 'text-green-600' : 'text-muted-foreground/20'}`} />
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Septic</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
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
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
