import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function BookingsAdmin() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['admin-bookings', selectedOrgId, statusFilter],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      let q = supabase
        .from('bookings')
        .select('*, booking_departures(departure_at, booking_routes(name))')
        .eq('organization_id', selectedOrgId!)
        .order('created_at', { ascending: false })
        .limit(200);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      const { error } = await supabase.from('bookings').update({ [field]: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast({ title: 'Uppdaterat' });
    },
    onError: (e: any) => toast({ title: 'Fel', description: e.message, variant: 'destructive' }),
  });

  const filtered = (bookings || []).filter((b: any) => {
    const s = search.toLowerCase();
    return !s ||
      b.booking_number?.toLowerCase().includes(s) ||
      b.customer_name?.toLowerCase().includes(s) ||
      b.customer_email?.toLowerCase().includes(s);
  });

  const statusColor: Record<string, string> = {
    avvaktar: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
    bekraftad: 'bg-green-500/10 text-green-700 border-green-300',
    avbokad: 'bg-red-500/10 text-red-700 border-red-300',
    no_show: 'bg-gray-500/10 text-gray-700 border-gray-300',
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="h-6 w-6" />Bokningar</h1>
            <p className="text-muted-foreground">Översikt över alla kundbokningar</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Filter</CardTitle></CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Sök bokningsnr, namn, e-post..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla statusar</SelectItem>
                <SelectItem value="avvaktar">Avvaktar</SelectItem>
                <SelectItem value="bekraftad">Bekräftad</SelectItem>
                <SelectItem value="avbokad">Avbokad</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Laddar...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Inga bokningar hittades</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bokningsnr</TableHead>
                    <TableHead>Kund</TableHead>
                    <TableHead>Avgång</TableHead>
                    <TableHead>Rutt</TableHead>
                    <TableHead>Pers</TableHead>
                    <TableHead>Pris</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Betalning</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b: any) => (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelectedBooking(b)}>
                      <TableCell className="font-mono text-xs">{b.booking_number}</TableCell>
                      <TableCell>
                        <div className="font-medium">{b.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{b.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.booking_departures?.departure_at ? format(new Date(b.booking_departures.departure_at), 'yyyy-MM-dd HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{b.booking_departures?.booking_routes?.name || '-'}</TableCell>
                      <TableCell>{b.total_passengers}</TableCell>
                      <TableCell>{Number(b.total_price_sek).toFixed(0)} kr</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor[b.status]}>{b.status}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{b.payment_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedBooking} onOpenChange={(o) => !o && setSelectedBooking(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Bokning {selectedBooking?.booking_number}</DialogTitle></DialogHeader>
            {selectedBooking && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-muted-foreground">Kund</div><div>{selectedBooking.customer_name}</div></div>
                  <div><div className="text-muted-foreground">E-post</div><div>{selectedBooking.customer_email}</div></div>
                  <div><div className="text-muted-foreground">Telefon</div><div>{selectedBooking.customer_phone || '-'}</div></div>
                  <div><div className="text-muted-foreground">Antal pers</div><div>{selectedBooking.total_passengers}</div></div>
                  <div><div className="text-muted-foreground">Totalpris</div><div>{Number(selectedBooking.total_price_sek).toFixed(0)} kr</div></div>
                </div>
                {selectedBooking.customer_notes && (
                  <div className="text-sm"><div className="text-muted-foreground">Kundens noteringar</div><div className="bg-muted p-2 rounded">{selectedBooking.customer_notes}</div></div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={selectedBooking.status} onValueChange={(v) => updateStatus.mutate({ id: selectedBooking.id, field: 'status', value: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avvaktar">Avvaktar</SelectItem>
                        <SelectItem value="bekraftad">Bekräftad</SelectItem>
                        <SelectItem value="avbokad">Avbokad</SelectItem>
                        <SelectItem value="no_show">No-show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Betalning</label>
                    <Select value={selectedBooking.payment_status} onValueChange={(v) => updateStatus.mutate({ id: selectedBooking.id, field: 'payment_status', value: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="obetald">Obetald</SelectItem>
                        <SelectItem value="betald">Betald</SelectItem>
                        <SelectItem value="aterbetald">Återbetald</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setSelectedBooking(null)}>Stäng</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}