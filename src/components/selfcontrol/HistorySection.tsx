import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  CheckCircle,
  Download,
  FileText,
  Image,
  Search,
  Filter,
  Paperclip,
  X,
  Calendar,
  User,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from 'sonner';

interface HistorySectionProps {
  selectedVessel: string;
  controlPoints: any[];
  getEngineName: (engine: any) => string;
}

export function HistorySection({ selectedVessel, controlPoints, getEngineName }: HistorySectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterControlPoint, setFilterControlPoint] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch control point records with attachments
  const { data: controlRecords, isLoading } = useQuery({
    queryKey: ['control-point-records-with-attachments', selectedVessel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('control_point_records')
        .select(`
          *,
          control_point:control_points(*),
          engine:vessel_engine_hours(*),
          performer:profiles!control_point_records_performed_by_fkey(full_name),
          attachments:control_point_attachments(*)
        `)
        .eq('vessel_id', selectedVessel)
        .order('performed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedVessel,
  });

  // Filter records based on search and filters
  const filteredRecords = useMemo(() => {
    if (!controlRecords) return [];

    return controlRecords.filter((record: any) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = record.control_point?.name?.toLowerCase().includes(query);
        const matchNotes = record.notes?.toLowerCase().includes(query);
        const matchPerformer = record.performer?.full_name?.toLowerCase().includes(query);
        if (!matchName && !matchNotes && !matchPerformer) return false;
      }

      // Control point filter
      if (filterControlPoint !== 'all' && record.control_point_id !== filterControlPoint) {
        return false;
      }

      // Date range filter
      if (filterDateFrom) {
        const recordDate = new Date(record.performed_at);
        const fromDate = new Date(filterDateFrom);
        if (recordDate < fromDate) return false;
      }

      if (filterDateTo) {
        const recordDate = new Date(record.performed_at);
        const toDate = new Date(filterDateTo);
        toDate.setHours(23, 59, 59, 999);
        if (recordDate > toDate) return false;
      }

      return true;
    });
  }, [controlRecords, searchQuery, filterControlPoint, filterDateFrom, filterDateTo]);

  // Get unique control points from records
  const recordControlPoints = useMemo(() => {
    if (!controlRecords) return [];
    const unique = new Map();
    controlRecords.forEach((record: any) => {
      if (record.control_point && !unique.has(record.control_point.id)) {
        unique.set(record.control_point.id, record.control_point);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }, [controlRecords]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterControlPoint('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = searchQuery || filterControlPoint !== 'all' || filterDateFrom || filterDateTo;

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredRecords.length) return;

    const headers = ['Datum', 'Kontrollpunkt', 'Kategori', 'Utförd av', 'Maskintimmar', 'Maskin', 'Anteckningar', 'Bilagor'];
    const rows = filteredRecords.map((record: any) => [
      format(new Date(record.performed_at), 'yyyy-MM-dd'),
      record.control_point?.name || '',
      record.control_point?.category || '',
      record.performer?.full_name || '',
      record.engine_hours_at_perform || '',
      record.engine ? getEngineName(record.engine) : '',
      record.notes || '',
      record.attachments?.length || 0,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `egenkontroll-historik-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export to JSON
  const exportToJSON = () => {
    if (!filteredRecords.length) return;

    const exportData = filteredRecords.map((record: any) => ({
      datum: format(new Date(record.performed_at), 'yyyy-MM-dd'),
      kontrollpunkt: record.control_point?.name || '',
      kategori: record.control_point?.category || '',
      utford_av: record.performer?.full_name || '',
      maskintimmar: record.engine_hours_at_perform || null,
      maskin: record.engine ? getEngineName(record.engine) : null,
      anteckningar: record.notes || null,
      bilagor: record.attachments?.map((a: any) => ({
        filnamn: a.file_name,
        url: a.file_url,
      })) || [],
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `egenkontroll-historik-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openAttachments = (record: any) => {
    setSelectedRecord(record);
    setAttachmentsDialogOpen(true);
  };

  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      // Delete attachments first, then the record
      const { error: attachError } = await supabase
        .from('control_point_attachments')
        .delete()
        .eq('record_id', recordId);
      if (attachError) throw attachError;

      const { error } = await supabase
        .from('control_point_records')
        .delete()
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['control-point-records-with-attachments', selectedVessel] });
      queryClient.invalidateQueries({ queryKey: ['vessel-control-point-state'] });
      toast.success('Posten har raderats');
      setDeleteRecordId(null);
    },
    onError: () => {
      toast.error('Kunde inte radera posten');
    },
  });

  const isImageFile = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || '');
  };

  if (!controlRecords || controlRecords.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ingen historik ännu</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter and export controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Search and quick filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på kontrollpunkt, anteckning eller utförare..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!filteredRecords.length}>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exportera</span> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToJSON} disabled={!filteredRecords.length}>
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exportera</span> JSON
              </Button>
            </div>
          </div>

          {/* Advanced filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Kontrollpunkt</Label>
              <Select value={filterControlPoint} onValueChange={setFilterControlPoint}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Alla" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kontrollpunkter</SelectItem>
                  {recordControlPoints.map((cp: any) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      {cp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Från datum</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Till datum</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="flex items-end">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                  <X className="h-4 w-4 mr-1" />
                  Rensa filter
                </Button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Visar {filteredRecords.length} av {controlRecords.length} poster
            </span>
            {hasActiveFilters && (
              <Badge variant="secondary">
                <Filter className="h-3 w-3 mr-1" />
                Filtrerad
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records list */}
      {filteredRecords.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Inga poster matchade dina filter</p>
            <Button variant="link" onClick={clearFilters}>Rensa alla filter</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map((record: any) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-medium truncate">{record.control_point?.name || 'Okänd kontrollpunkt'}</span>
                      <Badge variant="secondary" className="shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Utförd
                      </Badge>
                      {record.control_point?.category && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {record.control_point.category}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(record.performed_at), 'yyyy-MM-dd', { locale: sv })}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {record.performer?.full_name || 'Okänd'}
                      </span>
                      {record.engine_hours_at_perform && (
                        <span>
                          {record.engine_hours_at_perform}h
                          {record.engine && ` (${getEngineName(record.engine)})`}
                        </span>
                      )}
                    </div>

                    {record.notes && (
                      <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted/50 rounded line-clamp-2">
                        {record.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {record.attachments && record.attachments.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAttachments(record)}
                      >
                        <Paperclip className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Bilagor</span>
                        <Badge variant="secondary" className="ml-1">
                          {record.attachments.length}
                        </Badge>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteRecordId(record.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Attachments dialog */}
      <Dialog open={attachmentsDialogOpen} onOpenChange={setAttachmentsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Bilagor - {selectedRecord?.control_point?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Utförd {format(new Date(selectedRecord.performed_at), 'yyyy-MM-dd', { locale: sv })} av {selectedRecord.performer?.full_name}
              </div>

              <div className="grid gap-4">
                {selectedRecord.attachments?.map((attachment: any) => (
                  <div
                    key={attachment.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    {isImageFile(attachment.file_name) ? (
                      <div className="bg-muted">
                        <img
                          src={attachment.file_url}
                          alt={attachment.file_name}
                          className="w-full max-h-64 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-4 flex items-center gap-3 bg-muted/50">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <span className="flex-1 font-medium truncate">{attachment.file_name}</span>
                      </div>
                    )}
                    <div className="p-3 flex items-center justify-between border-t">
                      <span className="text-sm text-muted-foreground truncate flex-1">
                        {attachment.file_name}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="h-4 w-4 mr-1" />
                          Ladda ner
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRecordId}
        onOpenChange={(open) => !open && setDeleteRecordId(null)}
        title="Radera underhållspost"
        description="Är du säker på att du vill radera denna post? Eventuella bilagor raderas också. Detta går inte att ångra."
        confirmLabel="Radera"
        onConfirm={() => deleteRecordId && deleteRecordMutation.mutate(deleteRecordId)}
      />
    </div>
  );
}
