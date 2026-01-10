import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowLeft, CalendarIcon, Save, Trash2, FileText, Clock, UtensilsCrossed, Wine, Ship } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BookingFoodTab } from '@/components/bookings/BookingFoodTab';
import { BookingDrinksTab } from '@/components/bookings/BookingDrinksTab';
import { BookingCrewTab } from '@/components/bookings/BookingCrewTab';
import { BookingPMTab } from '@/components/bookings/BookingPMTab';
import { 
  Booking,
  BookingStatus,
  EventType,
  EventLayout,
  BlockingReason,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
  EVENT_TYPE_LABELS,
  EVENT_LAYOUT_LABELS,
  BLOCKING_REASON_LABELS
} from '@/lib/booking-types';

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [vesselId, setVesselId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [bufferBefore, setBufferBefore] = useState(60);
  const [bufferAfter, setBufferAfter] = useState(60);
  const [status, setStatus] = useState<BookingStatus>('forfragen');
  const [blockingReason, setBlockingReason] = useState<BlockingReason | ''>('');
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [eventLayout, setEventLayout] = useState<EventLayout | ''>('');
  const [guestCount, setGuestCount] = useState<number | ''>('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [departureHarbor, setDepartureHarbor] = useState('');
  const [arrivalHarbor, setArrivalHarbor] = useState('');
  const [routeNotes, setRouteNotes] = useState('');
  const [safetyNotes, setSafetyNotes] = useState('');

  // Fetch booking
  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, vessels(id, name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Booking;
    },
    enabled: !!id,
  });

  // Fetch vessels
  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessels')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Initialize form from booking data
  useEffect(() => {
    if (booking) {
      setVesselId(booking.vessel_id);
      setBookingDate(parseISO(booking.booking_date));
      setStartTime(booking.start_time || '');
      setEndTime(booking.end_time || '');
      setBufferBefore(booking.buffer_before_minutes || 60);
      setBufferAfter(booking.buffer_after_minutes || 60);
      setStatus(booking.status);
      setBlockingReason(booking.blocking_reason || '');
      setEventType(booking.event_type || '');
      setEventLayout(booking.event_layout || '');
      setGuestCount(booking.guest_count || '');
      setContactName(booking.contact_name || '');
      setContactPhone(booking.contact_phone || '');
      setContactCompany(booking.contact_company || '');
      setInternalNotes(booking.internal_notes || '');
      setDepartureHarbor(booking.departure_harbor || '');
      setArrivalHarbor(booking.arrival_harbor || '');
      setRouteNotes(booking.route_notes || '');
      setSafetyNotes(booking.safety_notes || '');
    }
  }, [booking]);

  const updateBooking = useMutation({
    mutationFn: async () => {
      if (!id || !bookingDate) return;

      const { error } = await supabase
        .from('bookings')
        .update({
          vessel_id: vesselId,
          booking_date: format(bookingDate, 'yyyy-MM-dd'),
          start_time: startTime,
          end_time: endTime,
          buffer_before_minutes: bufferBefore,
          buffer_after_minutes: bufferAfter,
          status,
          blocking_reason: status === 'blockerad' && blockingReason ? blockingReason : null,
          event_type: eventType || null,
          event_layout: eventLayout || null,
          guest_count: guestCount || null,
          contact_name: contactName || null,
          contact_phone: contactPhone || null,
          contact_company: contactCompany || null,
          internal_notes: internalNotes || null,
          departure_harbor: departureHarbor || null,
          arrival_harbor: arrivalHarbor || null,
          route_notes: routeNotes || null,
          safety_notes: safetyNotes || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bokning uppdaterad!');
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-audit', id] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte uppdatera: ' + error.message);
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Bokning raderad');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate('/bookings');
    },
    onError: (error: any) => {
      toast.error('Kunde inte radera: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 max-w-4xl space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[400px]" />
        </div>
      </MainLayout>
    );
  }

  if (!booking) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 text-center">
          <h1 className="text-2xl font-bold">Bokning hittades inte</h1>
          <Button className="mt-4" onClick={() => navigate('/bookings')}>
            Tillbaka till kalender
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tillbaka till kalender
          </Button>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn('text-sm', BOOKING_STATUS_COLORS[booking.status])}
            >
              {BOOKING_STATUS_LABELS[booking.status]}
            </Badge>
            {isAdmin && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h1 className="text-2xl font-bold">
            {booking.vessels?.name} - {format(parseISO(booking.booking_date), 'd MMMM yyyy', { locale: sv })}
          </h1>
          <p className="text-muted-foreground">
            {booking.contact_name || 'Ingen kontakt'} 
            {booking.contact_company && ` • ${booking.contact_company}`}
            {booking.guest_count && ` • ${booking.guest_count} gäster`}
          </p>
        </div>

        <Tabs defaultValue="grund" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="grund" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Grund</span>
            </TabsTrigger>
            <TabsTrigger value="mat" className="flex items-center gap-1">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Mat</span>
            </TabsTrigger>
            <TabsTrigger value="dryck" className="flex items-center gap-1">
              <Wine className="h-4 w-4" />
              <span className="hidden sm:inline">Dryck</span>
            </TabsTrigger>
            <TabsTrigger value="drift" className="flex items-center gap-1">
              <Ship className="h-4 w-4" />
              <span className="hidden sm:inline">Drift</span>
            </TabsTrigger>
            <TabsTrigger value="pm" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PM</span>
            </TabsTrigger>
          </TabsList>

          {/* Grund Tab */}
          <TabsContent value="grund" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Grunduppgifter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fartyg</Label>
                    <Select value={vesselId} onValueChange={setVesselId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Välj fartyg" />
                      </SelectTrigger>
                      <SelectContent>
                        {vessels?.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Datum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !bookingDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bookingDate ? format(bookingDate, 'PPP', { locale: sv }) : 'Välj datum'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={bookingDate}
                          onSelect={setBookingDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Starttid</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sluttid</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buffert före (min)</Label>
                    <Input
                      type="number"
                      value={bufferBefore}
                      onChange={(e) => setBufferBefore(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buffert efter (min)</Label>
                    <Input
                      type="number"
                      value={bufferAfter}
                      onChange={(e) => setBufferAfter(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {status === 'blockerad' && (
                    <div className="space-y-2">
                      <Label>Blockeringsorsak</Label>
                      <Select 
                        value={blockingReason} 
                        onValueChange={(v) => setBlockingReason(v as BlockingReason)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Välj orsak" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(BLOCKING_REASON_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Eventtyp</Label>
                    <Select 
                      value={eventType} 
                      onValueChange={(v) => setEventType(v as EventType)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj typ" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Upplägg</Label>
                    <Select 
                      value={eventLayout} 
                      onValueChange={(v) => setEventLayout(v as EventLayout)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj upplägg" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_LAYOUT_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Antal gäster</Label>
                    <Input
                      type="number"
                      value={guestCount}
                      onChange={(e) => setGuestCount(parseInt(e.target.value) || '')}
                    />
                    {typeof guestCount === 'number' && guestCount > 150 && (
                      <p className="text-xs text-destructive">⚠️ Över maxkapacitet</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kontaktperson</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Namn</Label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefon</Label>
                    <Input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Företag</Label>
                    <Input
                      value={contactCompany}
                      onChange={(e) => setContactCompany(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Interna anteckningar</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => updateBooking.mutate()} disabled={updateBooking.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateBooking.isPending ? 'Sparar...' : 'Spara ändringar'}
              </Button>
            </div>
          </TabsContent>

          {/* Mat Tab */}
          <TabsContent value="mat">
            <BookingFoodTab bookingId={id!} guestCount={booking.guest_count || undefined} />
          </TabsContent>

          {/* Dryck Tab */}
          <TabsContent value="dryck">
            <BookingDrinksTab bookingId={id!} />
          </TabsContent>

          {/* Drift Tab */}
          <TabsContent value="drift" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Rutt & Drift
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Avgångshamn</Label>
                    <Input
                      value={departureHarbor}
                      onChange={(e) => setDepartureHarbor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ankomsthamn</Label>
                    <Input
                      value={arrivalHarbor}
                      onChange={(e) => setArrivalHarbor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ruttnoteringar</Label>
                  <Textarea
                    value={routeNotes}
                    onChange={(e) => setRouteNotes(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Säkerhetsnotiser</Label>
                  <Textarea
                    value={safetyNotes}
                    onChange={(e) => setSafetyNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => updateBooking.mutate()} disabled={updateBooking.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateBooking.isPending ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <BookingCrewTab bookingId={id!} />
          </TabsContent>

          {/* PM Tab */}
          <TabsContent value="pm" className="space-y-4">
            <BookingPMTab booking={booking} />
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title="Radera bokning?"
          description="Är du säker på att du vill radera denna bokning? Detta kan inte ångras."
          confirmLabel="Radera"
          variant="destructive"
          onConfirm={() => deleteBooking.mutate()}
        />
      </div>
    </MainLayout>
  );
}
