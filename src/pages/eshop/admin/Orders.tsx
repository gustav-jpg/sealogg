import { useQuery } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EshopOrders() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_orders_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_orders').select('*, vessels(name), organizations(name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Order – alla organisationer</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Inkomna order</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga order ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Datum</TableHead><TableHead>Kund</TableHead><TableHead>Fartyg</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Summa</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono">
                        <Link to={`/backoffice/eshop/orders/${r.id}`} className="text-primary hover:underline">{r.order_number}</Link>
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString('sv-SE')}</TableCell>
                      <TableCell>{r.organizations?.name || '–'}</TableCell>
                      <TableCell>{r.vessels?.name || '–'}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell className="text-right">{Number(r.grand_total).toFixed(2)} kr</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </BackofficeLayout>
  );
}