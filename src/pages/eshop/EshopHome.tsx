import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart, Package, Truck, Tag, Warehouse, Users, FileText, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const tiles = [
  { href: '/portal/eshop/admin/products', label: 'Produkter', icon: Package },
  { href: '/portal/eshop/admin/categories', label: 'Kategorier', icon: Tag },
  { href: '/portal/eshop/admin/suppliers', label: 'Leverantörer', icon: Users },
  { href: '/portal/eshop/admin/warehouses', label: 'Lager', icon: Warehouse },
  { href: '/portal/eshop/admin/orders', label: 'Order', icon: Truck },
  { href: '/portal/eshop/admin/invoices', label: 'Fakturor', icon: Receipt },
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

        <div className="grid gap-4 md:grid-cols-3">
          {tiles.map(t => (
            <Card key={t.href}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <t.icon className="h-4 w-4" /> {t.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline">
                  <Link to={t.href}>Öppna</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Nästa fas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Kommande funktioner:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publik butik på <code>/portal/eshop</code> med varukorg</li>
              <li>Lagerflöden, plock & frakt per leverans</li>
              <li>Automatisk inköpsorder till leverantör (PO via e-post)</li>
              <li>PDF-faktura och statistik / dashboard</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}