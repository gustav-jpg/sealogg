import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useEshopCart } from '@/hooks/useEshopCart';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Search, Package, Plus, ListOrdered } from 'lucide-react';

export default function EshopShop() {
  const { selectedOrgId } = useOrganization();
  const cart = useEshopCart();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['shop_categories', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_categories')
        .select('id,name,slug')
        .eq('organization_id', selectedOrgId!)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['shop_products', selectedOrgId, categoryId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      let q = supabase
        .from('es_products')
        .select('id,sku,name,description,brand,price_excl_vat,vat_rate,category_id,es_categories(name)')
        .eq('organization_id', selectedOrgId!)
        .eq('is_active', true)
        .order('name');
      if (categoryId) q = q.eq('category_id', categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p: any) =>
        p.name?.toLowerCase().includes(s) ||
        p.sku?.toLowerCase().includes(s) ||
        p.brand?.toLowerCase().includes(s)
    );
  }, [products, search]);

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Butik</h1>
              <p className="text-sm text-muted-foreground">
                Beställ produkter – allt faktureras
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/portal/eshop/cart">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Varukorg
                {cart.totals.count > 0 && (
                  <Badge className="ml-2" variant="secondary">
                    {cart.totals.count}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/portal/eshop/orders">
                <ListOrdered className="h-4 w-4 mr-2" />
                Tidigare beställningar
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <aside className="md:w-56 shrink-0">
            <Card>
              <CardContent className="p-3 space-y-1">
                <button
                  onClick={() => setCategoryId(null)}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted ${!categoryId ? 'bg-muted font-medium' : ''}`}
                >
                  Alla produkter
                </button>
                {categories.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted ${categoryId === c.id ? 'bg-muted font-medium' : ''}`}
                  >
                    {c.name}
                  </button>
                ))}
                {categories.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">Inga kategorier</p>
                )}
              </CardContent>
            </Card>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök produkt, SKU eller varumärke…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Läser in…</p>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Inga produkter hittades
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p: any) => (
                  <Card key={p.id} className="flex flex-col">
                    <CardContent className="p-4 flex-1 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            to={`/portal/eshop/product/${p.id}`}
                            className="font-medium hover:underline line-clamp-2"
                          >
                            {p.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                        {p.brand && (
                          <Badge variant="outline" className="shrink-0">
                            {p.brand}
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {p.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div>
                          <div className="text-lg font-semibold">
                            {Number(p.price_excl_vat).toLocaleString('sv-SE', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            kr
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            exkl. moms ({p.vat_rate}%)
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => cart.addItem.mutate({ productId: p.id })}
                          disabled={cart.addItem.isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Köp
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}