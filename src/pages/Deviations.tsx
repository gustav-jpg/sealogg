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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEVIATION_TYPE_LABELS,
  DEVIATION_SEVERITY_LABELS,
  DEVIATION_STATUS_LABELS,
  DeviationType,
  DeviationSeverity,
  DeviationStatus,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { AlertTriangle, Plus, Filter, X, Upload, Eye, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePrint } from '@/hooks/usePrint';

export default function Deviations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [type, setType] = useState<DeviationType>('avvikelse');
  const [severity, setSeverity] = useState<DeviationSeverity>('medel');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [logbookId, setLogbookId] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch logbooks for the selected vessel
  const { data: logbooks } = useQuery({
    queryKey: ['logbooks-for-vessel', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const { data, error } = await supabase
        .from('logbooks')
        .select('*')
        .eq('vessel_id', vesselId)
        .order('date', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!vesselId,
  });

  const { data: deviations, isLoading } = useQuery({
    queryKey: ['deviations', filterVessel, filterStatus, filterType, filterSeverity],
    queryFn: async () => {
      let query = supabase
        .from('deviations')
        .select(`*, vessel:vessels(*)`)
        .order('date', { ascending: false });

      if (filterVessel !== 'all') query = query.eq('vessel_id', filterVessel);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus as DeviationStatus);
      if (filterType !== 'all') query = query.eq('type', filterType as DeviationType);
      if (filterSeverity !== 'all') query = query.eq('severity', filterSeverity as DeviationSeverity);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createDeviation = useMutation({
    mutationFn: async () => {
      // Get the profile ID for the current user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) throw new Error('Profil hittades inte');

      const { data: deviation, error } = await supabase
        .from('deviations')
        .insert({
          vessel_id: vesselId,
          date,
          type,
          severity,
          title,
          description,
          created_by: user?.id,
          logbook_id: logbookId || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files
      for (const file of files) {
        const filePath = `deviations/${deviation.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        await supabase.from('deviation_attachments').insert({
          deviation_id: deviation.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user?.id,
        });
      }

      return deviation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deviations'] });
      toast({ title: 'Skapad', description: 'Avvikelsen har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setVesselId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setType('avvikelse');
    setSeverity('medel');
    setTitle('');
    setDescription('');
    setLogbookId('');
    setFiles([]);
  };

  const getSeverityColor = (sev: DeviationSeverity) => {
    switch (sev) {
      case 'hog': return 'destructive';
      case 'medel': return 'default';
      case 'lag': return 'secondary';
    }
  };

  const getStatusColor = (status: DeviationStatus) => {
    switch (status) {
      case 'stangd': return 'secondary';
      case 'aterrapporterad': return 'default';
      case 'under_utredning': return 'outline';
      case 'oppen': return 'destructive';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Avvikelser</h1>
            <p className="text-muted-foreground mt-1">Hantera incidenter, tillbud och avvikelser</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => printContent('deviations-list', { 
                title: 'Avvikelser', 
                subtitle: 'Alla avvikelser'
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ny avvikelse
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Skapa ny avvikelse</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createDeviation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Fartyg *</Label>
                  <Select value={vesselId} onValueChange={setVesselId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fartyg" />
                    </SelectTrigger>
                    <SelectContent>
                      {vessels?.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Datum *</Label>
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Typ *</Label>
                    <Select value={type} onValueChange={(v) => setType(v as DeviationType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEVIATION_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Allvarlighetsgrad *</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as DeviationSeverity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEVIATION_SEVERITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Logbook link - optional */}
                {vesselId && logbooks && logbooks.length > 0 && (
                  <div className="space-y-2">
                    <Label>Koppla till loggbok (valfritt)</Label>
                    <Select value={logbookId || "__none__"} onValueChange={(v) => setLogbookId(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj loggbok..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Ingen loggbok</SelectItem>
                        {logbooks.map((lb) => (
                          <SelectItem key={lb.id} value={lb.id}>
                            {format(new Date(lb.date), 'yyyy-MM-dd')} - {lb.from_location || 'Okänd'} → {lb.to_location || 'Okänd'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Rubrik *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Kort beskrivande rubrik" />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivning *</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Beskriv vad som hände..." />
                </div>

                <div className="space-y-2">
                  <Label>Bilagor</Label>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  {files.length > 0 && (
                    <p className="text-sm text-muted-foreground">{files.length} fil(er) valda</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Avbryt
                  </Button>
                  <Button type="submit" disabled={createDeviation.isPending || !vesselId}>
                    {createDeviation.isPending ? 'Skapar...' : 'Skapa avvikelse'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={filterVessel} onValueChange={setFilterVessel}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla fartyg" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla fartyg</SelectItem>
                  {vessels?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla statusar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  {Object.entries(DEVIATION_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla typer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla typer</SelectItem>
                  {Object.entries(DEVIATION_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla nivåer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla nivåer</SelectItem>
                  {Object.entries(DEVIATION_SEVERITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div id="deviations-list">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          ) : deviations?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Inga avvikelser hittades</p>
              </CardContent>
            </Card>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b">Rubrik</th>
                  <th className="text-left p-2 border-b">Fartyg</th>
                  <th className="text-left p-2 border-b">Typ</th>
                  <th className="text-left p-2 border-b">Allvarlighet</th>
                  <th className="text-left p-2 border-b">Status</th>
                  <th className="text-left p-2 border-b">Datum</th>
                  <th className="text-left p-2 border-b print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {deviations?.map((deviation) => (
                  <tr key={deviation.id} className="hover:bg-muted/50">
                    <td className="p-2 border-b font-medium">{deviation.title}</td>
                    <td className="p-2 border-b">{(deviation as any).vessel?.name}</td>
                    <td className="p-2 border-b">
                      <Badge variant="outline">{DEVIATION_TYPE_LABELS[deviation.type as DeviationType]}</Badge>
                    </td>
                    <td className="p-2 border-b">
                      <Badge variant={getSeverityColor(deviation.severity as DeviationSeverity)}>
                        {DEVIATION_SEVERITY_LABELS[deviation.severity as DeviationSeverity]}
                      </Badge>
                    </td>
                    <td className="p-2 border-b">
                      <Badge variant={getStatusColor(deviation.status as DeviationStatus)}>
                        {DEVIATION_STATUS_LABELS[deviation.status as DeviationStatus]}
                      </Badge>
                    </td>
                    <td className="p-2 border-b text-muted-foreground text-sm">
                      {format(new Date(deviation.date), 'PPP', { locale: sv })}
                    </td>
                    <td className="p-2 border-b print:hidden">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/deviations/${deviation.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Visa
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}