import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useEshopCart } from '@/hooks/useEshopCart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShoppingCart, Plus, Minus, Package } from 'lucide-react';
import { useState } from 'react';

export default function EshopProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cart = useEshopCart();
  const [qty, setQty] = useState(1);

  const { data: product, isLoading } = useQuery({
    queryKey: ['shop_product', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_products')
        .select('*, es_categories(name), es_suppliers(name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka
        </Button>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Läser in…</p>
        ) : !product ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              Produkten hittades inte
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 grid gap-6 md:grid-cols-[1fr,1.4fr]">
              <div className="bg-muted rounded-lg flex items-center justify-center aspect-square overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-20 w-20 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {product.brand && <Badge variant="outline">{product.brand}</Badge>}
                    {product.es_categories?.name && (
                      <Badge variant="secondary">{product.es_categories.name}</Badge>
                    )}
                  </div>
                  <h1 className="text-2xl font-bold">{product.name}</h1>
                  <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
                </div>

                {product.description && (
                  <p className="text-sm whitespace-pre-wrap">{product.description}</p>
                )}

                <div className="border-t pt-3">
                  <div className="text-3xl font-bold">
                    {Number(product.price_excl_vat).toLocaleString('sv-SE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kr
                  </div>
                  <p className="text-xs text-muted-foreground">
                    exkl. moms ({product.vat_rate}%)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 text-center"
                  />
                  <Button variant="outline" size="icon" onClick={() => setQty(qty + 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    className="ml-auto"
                    onClick={() => cart.addItem.mutate({ productId: product.id, qty })}
                    disabled={cart.addItem.isPending}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" /> Lägg i varukorg
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground border-t pt-3 grid gap-1">
                  {product.es_suppliers?.name && (
                    <div>Leverantör: {product.es_suppliers.name}</div>
                  )}
                  {product.lead_time_days != null && (
                    <div>Leveranstid: ca {product.lead_time_days} dagar</div>
                  )}
                  {product.weight_g && <div>Vikt: {product.weight_g} g</div>}
                </div>

                <div className="mt-2">
                  <Button asChild variant="link" size="sm" className="px-0">
                    <Link to="/portal/eshop/cart">Gå till varukorgen →</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}