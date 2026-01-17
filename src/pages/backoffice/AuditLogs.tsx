import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const TABLE_NAMES: Record<string, string> = {
  logbooks: 'Loggböcker',
  deviations: 'Avvikelser',
  fault_cases: 'Felärenden',
  vessels: 'Fartyg',
  profiles: 'Profiler',
  organizations: 'Organisationer',
  bookings: 'Bokningar',
  control_points: 'Kontrollpunkter',
  checklist_templates: 'Checklistmallar',
  checklist_executions: 'Checklistkörningar',
};

const ACTION_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  INSERT: { label: 'Skapad', variant: 'default' },
  UPDATE: { label: 'Uppdaterad', variant: 'secondary' },
  DELETE: { label: 'Borttagen', variant: 'destructive' },
};

const PAGE_SIZE = 25;

export default function AuditLogs() {
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', page, tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const { data: userProfiles } = useQuery({
    queryKey: ['user-profiles-for-audit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ['audit-logs-count', tableFilter, actionFilter],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true });

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return 'System';
    const profile = userProfiles?.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || userId.substring(0, 8) + '...';
  };

  const getTableLabel = (tableName: string) => TABLE_NAMES[tableName] || tableName;

  const filteredLogs = logs?.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(search) ||
      log.action.toLowerCase().includes(search) ||
      getUserName(log.user_id).toLowerCase().includes(search) ||
      log.record_id.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  const getChangedFields = (oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null) => {
    if (!oldData || !newData) return [];
    const changes: { field: string; old: unknown; new: unknown }[] = [];
    
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    allKeys.forEach(key => {
      if (key === 'updated_at' || key === 'created_at') return;
      const oldVal = JSON.stringify(oldData[key]);
      const newVal = JSON.stringify(newData[key]);
      if (oldVal !== newVal) {
        changes.push({ field: key, old: oldData[key], new: newData[key] });
      }
    });
    
    return changes;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Laddar loggar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Systemloggar
        </h1>
        <p className="text-muted-foreground">Spårning av alla ändringar i systemet</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Totalt loggar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visade loggar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Sida {page + 1} av {totalPages || 1}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Sök i loggar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alla tabeller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla tabeller</SelectItem>
                {Object.entries(TABLE_NAMES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Alla åtgärder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla åtgärder</SelectItem>
                <SelectItem value="INSERT">Skapad</SelectItem>
                <SelectItem value="UPDATE">Uppdaterad</SelectItem>
                <SelectItem value="DELETE">Borttagen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Logghistorik</CardTitle>
          <CardDescription>Klicka på en rad för att se detaljer</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tidpunkt</TableHead>
                <TableHead>Tabell</TableHead>
                <TableHead>Åtgärd</TableHead>
                <TableHead>Användare</TableHead>
                <TableHead>Post-ID</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs?.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, variant: 'outline' as const };
                return (
                  <TableRow 
                    key={log.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-sm">
                      {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: sv })}
                    </TableCell>
                    <TableCell>{getTableLabel(log.table_name)}</TableCell>
                    <TableCell>
                      <Badge variant={actionInfo.variant}>{actionInfo.label}</Badge>
                    </TableCell>
                    <TableCell>{getUserName(log.user_id)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.record_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!filteredLogs || filteredLogs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Inga loggar hittades
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Visar {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount || 0)} av {totalCount} loggar
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Föregående
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Nästa
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Loggdetaljer
              {selectedLog && (
                <Badge variant={ACTION_LABELS[selectedLog.action]?.variant || 'outline'}>
                  {ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Tidpunkt</p>
                    <p className="font-medium">{format(new Date(selectedLog.created_at), 'PPP HH:mm:ss', { locale: sv })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Användare</p>
                    <p className="font-medium">{getUserName(selectedLog.user_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tabell</p>
                    <p className="font-medium">{getTableLabel(selectedLog.table_name)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Post-ID</p>
                    <p className="font-mono text-xs">{selectedLog.record_id}</p>
                  </div>
                </div>

                {selectedLog.action === 'UPDATE' && (
                  <div>
                    <p className="text-muted-foreground mb-2">Ändrade fält</p>
                    <div className="space-y-2">
                      {getChangedFields(selectedLog.old_data, selectedLog.new_data).map((change, i) => (
                        <div key={i} className="p-3 rounded-lg bg-muted/50 text-sm">
                          <p className="font-medium mb-1">{change.field}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Före: </span>
                              <code className="bg-destructive/10 px-1 rounded">
                                {JSON.stringify(change.old) ?? 'null'}
                              </code>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Efter: </span>
                              <code className="bg-green-500/10 px-1 rounded">
                                {JSON.stringify(change.new) ?? 'null'}
                              </code>
                            </div>
                          </div>
                        </div>
                      ))}
                      {getChangedFields(selectedLog.old_data, selectedLog.new_data).length === 0 && (
                        <p className="text-muted-foreground text-sm">Inga synliga fältändringar</p>
                      )}
                    </div>
                  </div>
                )}

                {selectedLog.action === 'INSERT' && selectedLog.new_data && (
                  <div>
                    <p className="text-muted-foreground mb-2">Skapad data</p>
                    <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.action === 'DELETE' && selectedLog.old_data && (
                  <div>
                    <p className="text-muted-foreground mb-2">Borttagen data</p>
                    <pre className="p-3 rounded-lg bg-destructive/10 text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
