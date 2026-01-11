import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { ArrowLeft, CalendarIcon, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  BookingStatus,
  EventType,
  EventLayout,
  BlockingReason,
  BOOKING_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  EVENT_LAYOUT_LABELS,
  BLOCKING_REASON_LABELS
} from '@/lib/booking-types';

export default function NewBooking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { selectedOrgId } = useOrganization();

  // Redirect non-admins
  if (!isAdmin) {
    navigate('/bookings');
    return null;
  }

  const initialDate = searchParams.get('date');

  // Form state
  const [vesselId, setVesselId] = useState<string>('');
  const [bookingDate, setBookingDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate) : new Date()
  );
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('23:00');
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

  // Fetch vessels
  const { data: vessels } = useQuery({
    queryKey: ['vessels', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('vessels')
        .select('id, name')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!vesselId || !bookingDate || !user) {
        throw new Error('Fyll i alla obligatoriska fält');
      }

      const { data, error } = await supabase
        .from('bookings')
        .insert({
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
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success('Bokning skapad!');
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/bookings/${data.id}`);
    },
    onError: (error: any) => {
      toast.error('Kunde inte skapa bokning: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createBooking.mutate();
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Tillbaka till kalender
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ny bokning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Vessel and Date */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fartyg *</Label>
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
                  <Label>Datum *</Label>
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
                        {bookingDate ? format(bookingDate, 'PPP') : 'Välj datum'}
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

              {/* Times */}
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Starttid *</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sluttid *</Label>
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

              {/* Status */}
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

              {/* Event Type and Layout */}
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
                    placeholder="0"
                  />
                  {typeof guestCount === 'number' && guestCount > 150 && (
                    <p className="text-xs text-destructive">⚠️ Över maxkapacitet (150)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
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
                    placeholder="Kontaktpersonens namn"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="070-123 45 67"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Företag</Label>
                  <Input
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                    placeholder="Företagsnamn (valfritt)"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Route Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rutt & Drift</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Avgångshamn</Label>
                  <Input
                    value={departureHarbor}
                    onChange={(e) => setDepartureHarbor(e.target.value)}
                    placeholder="T.ex. Strandvägen"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ankomsthamn</Label>
                  <Input
                    value={arrivalHarbor}
                    onChange={(e) => setArrivalHarbor(e.target.value)}
                    placeholder="T.ex. Strandvägen"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ruttnoteringar</Label>
                <Textarea
                  value={routeNotes}
                  onChange={(e) => setRouteNotes(e.target.value)}
                  placeholder="Speciell rutt, stopp, etc."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Säkerhetsnotiser</Label>
                <Textarea
                  value={safetyNotes}
                  onChange={(e) => setSafetyNotes(e.target.value)}
                  placeholder="Barn, rullstol, hund, etc."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Internal Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Interna anteckningar</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Interna noteringar som inte visas för kund..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/bookings')}>
              Avbryt
            </Button>
            <Button type="submit" disabled={createBooking.isPending || !vesselId || !bookingDate}>
              <Save className="mr-2 h-4 w-4" />
              {createBooking.isPending ? 'Sparar...' : 'Skapa bokning'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
