import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket } from 'lucide-react';

export default function BookingsHome() {
  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Ticket className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Bokningar</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bokningsmodulen är aktiverad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Bokningsmodulen är under uppbyggnad. Datamodellen är klar och kommande faser tillför:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bryggor, linjer, rutter och biljettyper</li>
              <li>Tidtabeller, avgångar och fartygstilldelning</li>
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