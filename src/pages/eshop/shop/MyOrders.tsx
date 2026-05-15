import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function fmt(n: number) {
  return Number(n).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EshopMyOrders() {
  const { selectedOrgId } = useOrganization();
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my_orders', selectedOrgId, userId],
    enabled: !!selectedOrgId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_orders')
        .select('*, vessels(name)')
        .eq('organization_id', selectedOrgId!)
        .eq('ordered_by', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <h1 className="text-2xl font-bold mb-4">Mina ordrar</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beställningar</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Läser in…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Inga beställningar ännu.{' '}
                <Link to="/portal/eshop/shop" className="underline">
                  Gå till butiken
                </Link>
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Fartyg</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Belopp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer">
                      <TableCell>
                        <Link to={`/portal/eshop/order/${o.id}`} className="font-medium hover:underline">
                          {o.order_number}
                        </Link>
                      </TableCell>
                      <TableCell>{new Date(o.created_at).toLocaleDateString('sv-SE')}</TableCell>
                      <TableCell>{o.vessels?.name ?? '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(o.grand_total)} kr</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}