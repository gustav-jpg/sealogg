import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, MapPin, Route as RouteIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function BookingsHome() {
  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Ticket className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Bokningar</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Bryggor</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link to="/portal/bookings/admin/piers">Hantera</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><RouteIcon className="h-4 w-4" /> Linjer & rutter</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link to="/portal/bookings/admin/lines">Hantera</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Ticket className="h-4 w-4" /> Biljettyper</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link to="/portal/bookings/admin/ticket-types">Hantera</Link></Button>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Nästa fas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Bryggor, linjer, rutter och biljettyper är klara. Nästa fas tillför:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tidtabeller, avgångar och fartygstilldelning</li>
              <li>Prisregler per linje, sträcka och biljettyp</li>
              <li>Publik bokningssida med Stripe</li>
              <li>QR-incheckning för besättning</li>
              <li>Översikt och bokningshantering</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}