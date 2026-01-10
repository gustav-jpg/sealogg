import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { 
  FileText, 
  Printer, 
  RefreshCw, 
  ChefHat, 
  UtensilsCrossed, 
  Users, 
  History 
} from 'lucide-react';
import { 
  PmType, 
  PM_TYPE_LABELS, 
  BOOKING_CREW_ROLE_LABELS,
  EVENT_TYPE_LABELS,
  EVENT_LAYOUT_LABELS,
  Booking,
  BookingPm
} from '@/lib/booking-types';

interface BookingPMTabProps {
  booking: Booking;
}

interface ScheduleItem {
  time: string;
  description: string;
}

interface PMContent {
  generatedAt: string;
  booking: {
    date: string;
    vessel: string;
    startTime: string;
    endTime: string;
    guestCount?: number;
    eventType?: string;
    eventLayout?: string;
    contactName?: string;
    contactCompany?: string;
    departureHarbor?: string;
    arrivalHarbor?: string;
    routeNotes?: string;
    safetyNotes?: string;
  };
  schedule?: ScheduleItem[];
  menu?: {
    name: string;
    portions?: number;
    dietaryTags?: string[];
    dietaryNotes?: string;
    kitchenNotes?: string;
    courses?: any[];
  };
  drinks?: {
    packageName?: string;
    isALaCarte: boolean;
    extras?: string[];
    notes?: string;
  };
  crew?: {
    role: string;
    name: string;
  }[];
}

export function BookingPMTab({ booking }: BookingPMTabProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedPmType, setSelectedPmType] = useState<PmType>('kok');

  // Fetch existing PMs
  const { data: pms, isLoading: pmsLoading } = useQuery({
    queryKey: ['booking-pms', booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_pms')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BookingPm[];
    },
  });

  // Fetch booking food data
  const { data: foodData } = useQuery({
    queryKey: ['booking-food', booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_food')
        .select('*, menus(*)')
        .eq('booking_id', booking.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch booking drinks data
  const { data: drinksData } = useQuery({
    queryKey: ['booking-drinks', booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_drinks')
        .select('*, drink_packages(*)')
        .eq('booking_id', booking.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch drink extras names
  const { data: drinkExtras } = useQuery({
    queryKey: ['drink-extras-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_extras')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch booking crew data
  const { data: crewData } = useQuery({
    queryKey: ['booking-crew', booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_crew')
        .select('*, profiles(id, full_name)')
        .eq('booking_id', booking.id);
      if (error) throw error;
      return data;
    },
  });

  // Fetch audit logs
  const { data: auditLogs } = useQuery({
    queryKey: ['booking-audit', booking.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_audit_logs')
        .select('*')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const generatePM = useMutation({
    mutationFn: async (pmType: PmType) => {
      if (!user) throw new Error('Inte inloggad');

      // Build PM content based on type
      const content: PMContent = {
        generatedAt: new Date().toISOString(),
        booking: {
          date: booking.booking_date,
          vessel: booking.vessels?.name || '',
          startTime: booking.start_time,
          endTime: booking.end_time,
          guestCount: booking.guest_count || undefined,
          eventType: booking.event_type ? EVENT_TYPE_LABELS[booking.event_type] : undefined,
          eventLayout: booking.event_layout ? EVENT_LAYOUT_LABELS[booking.event_layout] : undefined,
          contactName: booking.contact_name || undefined,
          contactCompany: booking.contact_company || undefined,
          departureHarbor: booking.departure_harbor || undefined,
          arrivalHarbor: booking.arrival_harbor || undefined,
          routeNotes: booking.route_notes || undefined,
          safetyNotes: booking.safety_notes || undefined,
        },
      };

      // Add schedule data for all PM types
      const scheduleData = (booking as any).schedule;
      if (scheduleData && Array.isArray(scheduleData) && scheduleData.length > 0) {
        content.schedule = scheduleData
          .filter((item: any) => item.time && item.description)
          .sort((a: any, b: any) => a.time.localeCompare(b.time));
      }

      // Add menu data for kitchen PM
      if (pmType === 'kok' && foodData) {
        content.menu = {
          name: foodData.menu_name_snapshot || foodData.menus?.name || 'Ingen meny vald',
          portions: foodData.portions || undefined,
          dietaryTags: foodData.dietary_tags || undefined,
          dietaryNotes: foodData.dietary_notes || undefined,
          kitchenNotes: foodData.kitchen_notes || undefined,
          courses: (foodData.menus as any)?.courses || undefined,
        };
      }

      // Add drinks data for bar PM
      if (pmType === 'bar' && drinksData) {
        const extraNames = drinksData.extras?.map((extraId: string) => 
          drinkExtras?.find(e => e.id === extraId)?.name || extraId
        );
        content.drinks = {
          packageName: drinksData.package_name_snapshot || (drinksData.drink_packages as any)?.name,
          isALaCarte: drinksData.is_a_la_carte || false,
          extras: extraNames,
          notes: drinksData.notes || undefined,
        };
      }

      // Add crew data for besättning and servering PM
      if ((pmType === 'besattning' || pmType === 'servering') && crewData) {
        content.crew = crewData.map((c: any) => ({
          role: BOOKING_CREW_ROLE_LABELS[c.role_type as keyof typeof BOOKING_CREW_ROLE_LABELS],
          name: c.profiles?.full_name || 'Okänd',
        }));
      }

      // Get current version number for this PM type
      const { data: latestPm } = await supabase
        .from('booking_pms')
        .select('version')
        .eq('booking_id', booking.id)
        .eq('pm_type', pmType)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newVersion = (latestPm?.version || 0) + 1;

      // Mark previous versions as not latest
      await supabase
        .from('booking_pms')
        .update({ is_latest: false })
        .eq('booking_id', booking.id)
        .eq('pm_type', pmType);

      // Insert new PM
      const { error } = await supabase
        .from('booking_pms')
        .insert({
          booking_id: booking.id,
          pm_type: pmType,
          version: newVersion,
          content: content as any,
          is_latest: true,
          created_by: user.id,
        });

      if (error) throw error;
      return { pmType, version: newVersion };
    },
    onSuccess: (data) => {
      toast.success(`PM ${PM_TYPE_LABELS[data.pmType]} v${data.version} skapad!`);
      queryClient.invalidateQueries({ queryKey: ['booking-pms', booking.id] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte skapa PM: ' + error.message);
    },
  });

  const printPM = (pm: BookingPm) => {
    const content = pm.content as unknown as PMContent;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const pmTitle = PM_TYPE_LABELS[pm.pm_type];
    const bookingDate = format(parseISO(content.booking.date), 'd MMMM yyyy', { locale: sv });

    let html = `
      <!DOCTYPE html>
      <html lang="sv">
      <head>
        <meta charset="UTF-8">
        <title>PM ${pmTitle} - ${content.booking.vessel} ${bookingDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #555; margin-top: 30px; }
          .header { display: flex; justify-content: space-between; align-items: center; }
          .meta { color: #666; font-size: 0.9em; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
          .info-item { padding: 8px; background: #f5f5f5; border-radius: 4px; }
          .label { font-weight: bold; color: #555; }
          .crew-list { margin: 10px 0; }
          .crew-item { padding: 5px 10px; margin: 5px 0; background: #f0f0f0; border-radius: 4px; }
          .courses { margin: 15px 0; }
          .course { padding: 8px; margin: 5px 0; background: #fafafa; border-left: 3px solid #007bff; }
          .notes { background: #fffde7; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .schedule { margin: 15px 0; }
          .schedule-item { display: flex; align-items: center; gap: 15px; padding: 8px 0; border-bottom: 1px solid #eee; }
          .schedule-item .time { font-weight: bold; font-family: monospace; font-size: 1.1em; color: #007bff; min-width: 50px; }
          .schedule-item .desc { color: #333; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PM ${pmTitle}</h1>
          <span class="meta">Version ${pm.version}</span>
        </div>
        <p class="meta">Genererad: ${format(parseISO(content.generatedAt), 'yyyy-MM-dd HH:mm')}</p>

        <h2>Bokningsinfo</h2>
        <div class="info-grid">
          <div class="info-item"><span class="label">Fartyg:</span> ${content.booking.vessel}</div>
          <div class="info-item"><span class="label">Datum:</span> ${bookingDate}</div>
          <div class="info-item"><span class="label">Tid:</span> ${content.booking.startTime} - ${content.booking.endTime}</div>
          ${content.booking.guestCount ? `<div class="info-item"><span class="label">Gäster:</span> ${content.booking.guestCount}</div>` : ''}
          ${content.booking.eventType ? `<div class="info-item"><span class="label">Eventtyp:</span> ${content.booking.eventType}</div>` : ''}
          ${content.booking.eventLayout ? `<div class="info-item"><span class="label">Upplägg:</span> ${content.booking.eventLayout}</div>` : ''}
          ${content.booking.contactName ? `<div class="info-item"><span class="label">Kontakt:</span> ${content.booking.contactName}${content.booking.contactCompany ? ` (${content.booking.contactCompany})` : ''}</div>` : ''}
        </div>
        
        ${content.schedule && content.schedule.length > 0 ? `
          <h2>Tidsplan</h2>
          <div class="schedule">
            ${content.schedule.map(item => `<div class="schedule-item"><span class="time">${item.time}</span><span class="desc">${item.description}</span></div>`).join('')}
          </div>
        ` : ''}
    `;

    // Route info for crew PM
    if (pm.pm_type === 'besattning') {
      html += `
        <h2>Rutt & Drift</h2>
        <div class="info-grid">
          ${content.booking.departureHarbor ? `<div class="info-item"><span class="label">Avgång:</span> ${content.booking.departureHarbor}</div>` : ''}
          ${content.booking.arrivalHarbor ? `<div class="info-item"><span class="label">Ankomst:</span> ${content.booking.arrivalHarbor}</div>` : ''}
        </div>
        ${content.booking.routeNotes ? `<div class="notes"><span class="label">Ruttnoteringar:</span><br>${content.booking.routeNotes}</div>` : ''}
        ${content.booking.safetyNotes ? `<div class="notes"><span class="label">Säkerhetsnotiser:</span><br>${content.booking.safetyNotes}</div>` : ''}
      `;
    }

    // Menu info for kitchen PM
    if (pm.pm_type === 'kok' && content.menu) {
      html += `
        <h2>Meny</h2>
        <div class="info-grid">
          <div class="info-item"><span class="label">Meny:</span> ${content.menu.name}</div>
          ${content.menu.portions ? `<div class="info-item"><span class="label">Portioner:</span> ${content.menu.portions}</div>` : ''}
        </div>
        ${content.menu.courses && content.menu.courses.length > 0 ? `
          <div class="courses">
            <span class="label">Rätter:</span>
            ${content.menu.courses.map((c: any) => `<div class="course"><strong>${c.type}:</strong> ${c.name}${c.description ? ` - ${c.description}` : ''}</div>`).join('')}
          </div>
        ` : ''}
        ${content.menu.dietaryTags && content.menu.dietaryTags.length > 0 ? `<div class="notes"><span class="label">Specialkost:</span> ${content.menu.dietaryTags.join(', ')}</div>` : ''}
        ${content.menu.dietaryNotes ? `<div class="notes"><span class="label">Dietinfo:</span><br>${content.menu.dietaryNotes}</div>` : ''}
        ${content.menu.kitchenNotes ? `<div class="notes"><span class="label">Köksnoteringar:</span><br>${content.menu.kitchenNotes}</div>` : ''}
      `;
    }

    // Drinks info for bar PM
    if (pm.pm_type === 'bar' && content.drinks) {
      html += `
        <h2>Dryck</h2>
        ${content.drinks.isALaCarte ? `<div class="info-item"><span class="label">À la carte</span> (bar på faktura)</div>` : `<div class="info-item"><span class="label">Paket:</span> ${content.drinks.packageName || 'Inget valt'}</div>`}
        ${content.drinks.extras && content.drinks.extras.length > 0 ? `<div class="notes"><span class="label">Tillval:</span> ${content.drinks.extras.join(', ')}</div>` : ''}
        ${content.drinks.notes ? `<div class="notes"><span class="label">Noteringar:</span><br>${content.drinks.notes}</div>` : ''}
      `;
    }

    // Crew list for crew and serving PM
    if ((pm.pm_type === 'besattning' || pm.pm_type === 'servering') && content.crew && content.crew.length > 0) {
      html += `
        <h2>Besättning</h2>
        <div class="crew-list">
          ${content.crew.map(c => `<div class="crew-item"><strong>${c.role}:</strong> ${c.name}</div>`).join('')}
        </div>
      `;
    }

    html += `
        <button class="no-print" onclick="window.print()" style="margin-top: 30px; padding: 10px 20px; cursor: pointer;">Skriv ut</button>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const latestPms = pms?.filter(pm => pm.is_latest) || [];
  const pmHistory = pms?.filter(pm => !pm.is_latest) || [];

  const pmTypes: PmType[] = ['kok', 'servering', 'besattning'];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generera PM
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Välj vilken typ av PM du vill generera. PM:et samlar ihop all relevant information 
            från bokningen och skapar ett utskrivbart dokument.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {pmTypes.map((pmType) => {
              const latestPm = latestPms.find(p => p.pm_type === pmType);
              const icon = pmType === 'kok' ? ChefHat : pmType === 'servering' ? UtensilsCrossed : Users;
              const Icon = icon;

              return (
                <div key={pmType} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{PM_TYPE_LABELS[pmType]}</span>
                  </div>

                  {latestPm && (
                    <div className="text-xs text-muted-foreground">
                      Version {latestPm.version} • {format(parseISO(latestPm.created_at), 'yyyy-MM-dd HH:mm')}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={latestPm ? 'outline' : 'default'}
                      onClick={() => generatePM.mutate(pmType)}
                      disabled={generatePM.isPending}
                    >
                      {latestPm ? <RefreshCw className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      <span className="ml-1">{latestPm ? 'Uppdatera' : 'Skapa'}</span>
                    </Button>

                    {latestPm && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => printPM(latestPm)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {pmHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              PM-historik
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {pmHistory.map((pm) => (
                <div 
                  key={pm.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{PM_TYPE_LABELS[pm.pm_type]}</Badge>
                    <span>v{pm.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {format(parseISO(pm.created_at), 'yyyy-MM-dd HH:mm')}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => printPM(pm)}>
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {auditLogs && auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Ändringslogg
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {auditLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="text-sm p-2 bg-muted/50 rounded flex justify-between"
                >
                  <div>
                    <span className="font-medium">{log.action}</span>
                    {log.field_changed && (
                      <span className="text-muted-foreground ml-2">({log.field_changed})</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {format(parseISO(log.created_at), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
