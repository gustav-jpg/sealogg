import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Truck } from 'lucide-react';
import { toast } from 'sonner';

const STATUSES = ['mottagen','bekraftad','packas','skickad','delvis_skickad','levererad','restnoterad','avslutad','avbruten'];

export default function EshopOrderDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['es_order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_orders')
        .select('*, vessels(name), organizations(name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['es_order_items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_order_items')
        .select('*')
        .eq('order_id', id!)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('es_orders').update({ status }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_order', id] }); qc.invalidateQueries({ queryKey: ['es_orders_all'] }); toast.success('Status uppdaterad'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/backoffice/eshop/orders"><ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka</Link></Button>
        </div>
        {isLoading || !order ? (
          <p className="text-sm text-muted-foreground">Laddar...</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Truck className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold font-mono">{order.order_number}</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status</span>
                <Select value={order.status} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Kund</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Organisation: </span>{order.organizations?.name || '–'}</div>
                  <div><span className="text-muted-foreground">Fartyg: </span>{order.vessels?.name || '–'}</div>
                  <div><span className="text-muted-foreground">Datum: </span>{new Date(order.created_at).toLocaleString('sv-SE')}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Leveransadress</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  {order.delivery_address ? (
                    <div className="space-y-0.5">
                      {order.delivery_address.name && <div>{order.delivery_address.name}</div>}
                      {order.delivery_address.street && <div>{order.delivery_address.street}</div>}
                      {(order.delivery_address.zip || order.delivery_address.city) && <div>{order.delivery_address.zip} {order.delivery_address.city}</div>}
                      {order.delivery_address.country && <div>{order.delivery_address.country}</div>}
                      {order.delivery_address.phone && <div className="text-muted-foreground">Tel: {order.delivery_address.phone}</div>}
                    </div>
                  ) : <span className="text-muted-foreground">Ingen adress</span>}
                </CardContent>
              </Card>
            </div>

            {order.customer_note && (
              <Card>
                <CardHeader><CardTitle className="text-base">Kundens meddelande</CardTitle></CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap">{order.customer_note}</CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Orderrader</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Produkt</TableHead><TableHead className="text-right">Antal</TableHead><TableHead className="text-right">À-pris</TableHead><TableHead className="text-right">Moms</TableHead><TableHead className="text-right">Summa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map((it: any) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{it.sku_snapshot}</TableCell>
                        <TableCell>{it.product_name_snapshot}</TableCell>
                        <TableCell className="text-right">{it.qty}</TableCell>
                        <TableCell className="text-right">{Number(it.unit_price_excl_vat).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(it.vat_rate).toFixed(0)}%</TableCell>
                        <TableCell className="text-right">{Number(it.line_total_excl_vat).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Delsumma</span><span>{Number(order.sub_total).toFixed(2)} kr</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Frakt</span><span>{Number(order.freight_total).toFixed(2)} kr</span></div>
                  {Number(order.handling_total) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Hantering</span><span>{Number(order.handling_total).toFixed(2)} kr</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Moms</span><span>{Number(order.vat_total).toFixed(2)} kr</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Totalt</span><span>{Number(order.grand_total).toFixed(2)} kr</span></div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BackofficeLayout>
  );
}
