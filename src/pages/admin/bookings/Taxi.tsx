import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Car } from 'lucide-react';
import { format } from 'date-fns';

export default function TaxiAdmin() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);

  const { data: requests } = useQuery({
    queryKey: ['taxi-requests', selectedOrgId, statusFilter], enabled: !!selectedOrgId,
    queryFn: async () => {
      let q = supabase.from('booking_taxi_requests').select('*, vessels(name)').eq('organization_id', selectedOrgId!).order('requested_at', { ascending: true });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
  const { data: vessels } = useQuery({
    queryKey: ['vessels-list', selectedOrgId], enabled: !!selectedOrgId,
    queryFn: async () => (await supabase.from('vessels').select('id, name').eq('organization_id', selectedOrgId!)).data || [],
  });

  const update = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from('booking_taxi_requests').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['taxi-requests'] }); toast({ title: 'Uppdaterad' }); setSelected(null); },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const colors: Record<string, string> = {
    ny: 'bg-blue-500/10 text-blue-700 border-blue-300',
    bekraftad: 'bg-green-500/10 text-green-700 border-green-300',
    avbojd: 'bg-red-500/10 text-red-700 border-red-300',
    genomford: 'bg-gray-500/10 text-gray-700 border-gray-300',
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6" />Taxikö</h1>
            <p className="text-muted-foreground">Hantera inkommande taxibåt-förfrågningar</p>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla</SelectItem>
              <SelectItem value="ny">Nya</SelectItem>
              <SelectItem value="bekraftad">Bekräftade</SelectItem>
              <SelectItem value="avbojd">Avböjda</SelectItem>
              <SelectItem value="genomford">Genomförda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3">
          {requests?.length === 0 && <Card><CardContent className="p-6 text-center text-muted-foreground">Inga förfrågningar</CardContent></Card>}
          {requests?.map((r: any) => (
            <Card key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{r.request_number}</span>
                      <Badge variant="outline" className={colors[r.status]}>{r.status}</Badge>
                    </div>
                    <div className="font-medium mt-1">{r.customer_name} • {r.passenger_count} pers</div>
                    <div className="text-sm">{r.pickup_location} → {r.dropoff_location}</div>
                    <div className="text-xs text-muted-foreground">Önskad: {format(new Date(r.requested_at), 'yyyy-MM-dd HH:mm')}</div>
                    {r.vessels?.name && <div className="text-xs text-muted-foreground">Fartyg: {r.vessels.name}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Taxiförfrågan {selected?.request_number}</DialogTitle></DialogHeader>
            {selected && <TaxiDetail r={selected} vessels={vessels || []} onSave={update.mutate} pending={update.isPending} />}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function TaxiDetail({ r, vessels, onSave, pending }: any) {
  const [status, setStatus] = useState(r.status);
  const [vesselId, setVesselId] = useState(r.assigned_vessel_id || '');
  const [price, setPrice] = useState(r.quoted_price_sek?.toString() || '');
  const [internalNotes, setInternalNotes] = useState(r.internal_notes || '');

  return (
    <div className="space-y-3">
      <div className="text-sm space-y-1">
        <div><b>Kund:</b> {r.customer_name}</div>
        <div><b>E-post:</b> {r.customer_email}</div>
        <div><b>Telefon:</b> {r.customer_phone}</div>
        <div><b>Personer:</b> {r.passenger_count}</div>
        <div><b>Från:</b> {r.pickup_location}</div>
        <div><b>Till:</b> {r.dropoff_location}</div>
        {r.notes && <div><b>Kundens noteringar:</b> {r.notes}</div>}
      </div>
      <div><Label>Status</Label>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ny">Ny</SelectItem>
            <SelectItem value="bekraftad">Bekräftad</SelectItem>
            <SelectItem value="avbojd">Avböjd</SelectItem>
            <SelectItem value="genomford">Genomförd</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Tilldela fartyg</Label>
        <Select value={vesselId || 'none'} onValueChange={(v) => setVesselId(v === 'none' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">– Inget –</SelectItem>
            {vessels.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Offererat pris (kr)</Label><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <div><Label>Interna noteringar</Label><Textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} /></div>
      <Button disabled={pending} onClick={() => onSave({ id: r.id, status, assigned_vessel_id: vesselId || null, quoted_price_sek: price ? Number(price) : null, internal_notes: internalNotes || null })} className="w-full">Spara</Button>
    </div>
  );
}