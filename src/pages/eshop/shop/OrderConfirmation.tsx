import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, ShoppingCart, Receipt } from 'lucide-react';

function fmt(n: number) {
  return Number(n).toLocaleString('sv-SE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function EshopOrderConfirmation() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['order_confirm', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: order, error } = await supabase
        .from('es_orders')
        .select('*, vessels(name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      const { data: items } = await supabase
        .from('es_order_items')
        .select('*')
        .eq('order_id', id!);
      const { data: invoice } = await supabase
        .from('es_invoices')
        .select('*')
        .eq('order_id', id!)
        .maybeSingle();
      return { order, items: items ?? [], invoice };
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-3xl">
        {isLoading || !data?.order ? (
          <p className="text-sm text-muted-foreground">Läser in…</p>
        ) : (
          <>
            <div className="text-center mb-6">
              <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-bold">Tack för din beställning!</h1>
              <p className="text-sm text-muted-foreground">
                Orderbekräftelse {data.order.order_number}
              </p>
            </div>

            <Card className="mb-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Order {data.order.order_number}</CardTitle>
                <Badge variant="secondary">{data.order.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.order.vessels?.name && (
                  <div>Fartyg: <strong>{data.order.vessels.name}</strong></div>
                )}
                {data.order.delivery_address && (
                  <div className="text-muted-foreground">
                    Levereras till: {(data.order.delivery_address as any).street},{' '}
                    {(data.order.delivery_address as any).postal_code}{' '}
                    {(data.order.delivery_address as any).city}
                  </div>
                )}
                <div className="border-t pt-2 mt-2 space-y-1">
                  {data.items.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>
                        {it.qty} × {it.product_name_snapshot}
                      </span>
                      <span>{fmt(it.line_total_excl_vat)} kr</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Delsumma</span>
                    <span>{fmt(data.order.sub_total)} kr</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Moms</span>
                    <span>{fmt(data.order.vat_total)} kr</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Totalt</span>
                    <span>{fmt(data.order.grand_total)} kr</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {data.invoice && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> Faktura {data.invoice.invoice_number}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Status: <Badge variant="outline">{data.invoice.status}</Badge>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild variant="outline">
                <Link to="/portal/eshop/shop">
                  <ShoppingCart className="h-4 w-4 mr-2" /> Fortsätt handla
                </Link>
              </Button>
              <Button asChild>
                <Link to="/portal/eshop/orders">Mina ordrar</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}