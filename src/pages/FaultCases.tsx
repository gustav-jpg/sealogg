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
  FAULT_PRIORITY_LABELS,
  FAULT_STATUS_LABELS,
  FaultPriority,
  FaultStatus,
} from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Wrench, Plus, Filter, Eye, Archive, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrint } from '@/hooks/usePrint';

export default function FaultCases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { printContent } = usePrint();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterVessel, setFilterVessel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archive'>('active');

  // Form state
  const [vesselId, setVesselId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<FaultPriority>('normal');
  const [files, setFiles] = useState<File[]>([]);

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: faultCases, isLoading } = useQuery({
    queryKey: ['fault-cases', filterVessel, filterStatus, filterPriority, searchText, activeTab],
    queryFn: async () => {
      let query = supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(*)`)
        .order('created_at', { ascending: false });

      // Filter by active/archive tab
      if (activeTab === 'active') {
        query = query.neq('status', 'avslutad');
      } else {
        query = query.eq('status', 'avslutad');
      }

      if (filterVessel !== 'all') query = query.eq('vessel_id', filterVessel);
      if (filterStatus !== 'all') query = query.eq('status', filterStatus as FaultStatus);
      if (filterPriority !== 'all') query = query.eq('priority', filterPriority as FaultPriority);
      if (searchText) query = query.or(`title.ilike.%${searchText}%,description.ilike.%${searchText}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createFaultCase = useMutation({
    mutationFn: async () => {
      const { data: faultCase, error } = await supabase
        .from('fault_cases')
        .insert({
          vessel_id: vesselId,
          title,
          description,
          priority,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload files
      for (const file of files) {
        const filePath = `fault-cases/${faultCase.id}/${Date.now()}-${file.name}`;
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

        await supabase.from('fault_attachments').insert({
          fault_case_id: faultCase.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: user?.id,
        });
      }

      return faultCase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fault-cases'] });
      toast({ title: 'Skapat', description: 'Felärendet har skapats.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setVesselId('');
    setTitle('');
    setDescription('');
    setPriority('normal');
    setFiles([]);
  };

  const getPriorityColor = (prio: FaultPriority) => {
    switch (prio) {
      case 'kritisk': return 'destructive';
      case 'hog': return 'default';
      case 'normal': return 'secondary';
      case 'lag': return 'outline';
    }
  };

  const getStatusColor = (status: FaultStatus): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    switch (status) {
      case 'avslutad': return 'secondary';
      case 'atgardad': return 'success';
      case 'arbete_pagar': return 'warning';
      case 'varvsatgard': return 'default';
      case 'ny': return 'destructive';
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Felärenden</h1>
            <p className="text-muted-foreground mt-1">Hantera tekniska och operativa fel</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => printContent('fault-cases-list', { 
                title: 'Felärenden', 
                subtitle: activeTab === 'active' ? 'Aktiva ärenden' : 'Arkiverade ärenden'
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nytt felärende
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Skapa nytt felärende</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createFaultCase.mutate();
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

                <div className="space-y-2">
                  <Label>Rubrik *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Kort beskrivande rubrik" />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivning *</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Beskriv felet..." />
                </div>

                <div className="space-y-2">
                  <Label>Prioritet *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as FaultPriority)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(FAULT_PRIORITY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Button type="submit" disabled={createFaultCase.isPending || !vesselId}>
                    {createFaultCase.isPending ? 'Skapar...' : 'Skapa felärende'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Tabs for active/archive */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'archive')}>
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Aktiva
            </TabsTrigger>
            <TabsTrigger value="archive" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Arkiv
            </TabsTrigger>
          </TabsList>
        </Tabs>

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

              {activeTab === 'active' && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alla statusar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla statusar</SelectItem>
                    {Object.entries(FAULT_STATUS_LABELS)
                      .filter(([key]) => key !== 'avslutad')
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Alla prioriteter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla prioriteter</SelectItem>
                  {Object.entries(FAULT_PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Sök..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <div id="fault-cases-list">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
          ) : faultCases?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Inga felärenden hittades</p>
              </CardContent>
            </Card>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b">Rubrik</th>
                  <th className="text-left p-2 border-b">Fartyg</th>
                  <th className="text-left p-2 border-b">Prioritet</th>
                  <th className="text-left p-2 border-b">Status</th>
                  <th className="text-left p-2 border-b">Datum</th>
                  <th className="text-left p-2 border-b print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {faultCases?.map((faultCase) => (
                  <tr key={faultCase.id} className="hover:bg-muted/50">
                    <td className="p-2 border-b font-medium">{faultCase.title}</td>
                    <td className="p-2 border-b">{(faultCase as any).vessel?.name}</td>
                    <td className="p-2 border-b">
                      <Badge variant={getPriorityColor(faultCase.priority as FaultPriority)}>
                        {FAULT_PRIORITY_LABELS[faultCase.priority as FaultPriority]}
                      </Badge>
                    </td>
                    <td className="p-2 border-b">
                      <Badge variant={getStatusColor(faultCase.status as FaultStatus)}>
                        {FAULT_STATUS_LABELS[faultCase.status as FaultStatus]}
                      </Badge>
                    </td>
                    <td className="p-2 border-b text-muted-foreground text-sm">
                      {format(new Date(faultCase.created_at), 'PPP', { locale: sv })}
                    </td>
                    <td className="p-2 border-b print:hidden">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/portal/fault-cases/${faultCase.id}`}>
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