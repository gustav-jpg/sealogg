import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Store, ListOrdered } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const shopTiles = [
  { href: '/portal/eshop/shop', label: 'Butik', icon: Store, desc: 'Bläddra och beställ produkter' },
  { href: '/portal/eshop/cart', label: 'Varukorg', icon: ShoppingCart, desc: 'Aktuell beställning' },
  { href: '/portal/eshop/orders', label: 'Mina ordrar', icon: ListOrdered, desc: 'Tidigare beställningar' },
];

export default function EshopHome() {
  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-2">
          <ShoppingCart className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">e-Skeppshandel</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Maritim B2B-handel. Allt faktureras – ingen kortbetalning krävs.
        </p>

        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Köp
        </h2>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          {shopTiles.map((t) => (
            <Card key={t.href} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <t.icon className="h-4 w-4 text-primary" /> {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{t.desc}</p>
                <Button asChild size="sm">
                  <Link to={t.href}>Öppna</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}