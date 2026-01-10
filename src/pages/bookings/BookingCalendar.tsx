import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { sv } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { 
  Booking, 
  BookingStatus,
  BOOKING_STATUS_LABELS, 
  BOOKING_STATUS_COLORS,
  EVENT_TYPE_LABELS 
} from '@/lib/booking-types';

export default function BookingCalendar() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedVessel, setSelectedVessel] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  // Fetch bookings for the current week
  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', weekStart.toISOString(), weekEnd.toISOString(), selectedVessel],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select('*, vessels(id, name)')
        .gte('booking_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('booking_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('booking_date')
        .order('start_time');

      if (selectedVessel !== 'all') {
        query = query.eq('vessel_id', selectedVessel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Booking[];
    },
  });

  const getBookingsForDay = (day: Date) => {
    if (!bookings) return [];
    return bookings.filter(b => isSameDay(parseISO(b.booking_date), day));
  };

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bokningskalender</h1>
            <p className="text-muted-foreground">
              Hantera bokningar för hyr hela båten
            </p>
          </div>
          <Button onClick={() => navigate('/bookings/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Ny bokning
          </Button>
        </div>

        {/* Filters and Navigation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={goToToday}>
                  Idag
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="ml-2 font-medium">
                  {format(weekStart, 'd MMM', { locale: sv })} - {format(weekEnd, 'd MMM yyyy', { locale: sv })}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Välj fartyg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla fartyg</SelectItem>
                    {vessels?.map((vessel) => (
                      <SelectItem key={vessel.id} value={vessel.id}>
                        {vessel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'day')}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Vecka</SelectItem>
                    <SelectItem value="day">Dag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(BOOKING_STATUS_LABELS).map(([status, label]) => (
            <Badge 
              key={status} 
              variant="outline" 
              className={BOOKING_STATUS_COLORS[status as BookingStatus]}
            >
              {label}
            </Badge>
          ))}
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Laddar bokningar...
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x">
                {daysInWeek.map((day) => {
                  const dayBookings = getBookingsForDay(day);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div key={day.toISOString()} className="min-h-[200px]">
                      {/* Day Header */}
                      <div 
                        className={`p-2 text-center border-b ${
                          isToday ? 'bg-primary/10' : 'bg-muted/50'
                        }`}
                      >
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(day, 'EEE', { locale: sv })}
                        </div>
                        <div className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                          {format(day, 'd')}
                        </div>
                      </div>

                      {/* Day Content */}
                      <div className="p-1 space-y-1">
                        {dayBookings.length === 0 ? (
                          <div 
                            className="h-16 flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 rounded"
                            onClick={() => navigate(`/bookings/new?date=${format(day, 'yyyy-MM-dd')}`)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Lägg till
                          </div>
                        ) : (
                          dayBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className={`p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                                BOOKING_STATUS_COLORS[booking.status]
                              }`}
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              <div className="text-xs font-medium truncate">
                                {booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}
                              </div>
                              <div className="text-xs truncate">
                                {booking.vessels?.name}
                              </div>
                              {booking.event_type && (
                                <div className="text-xs truncate opacity-75">
                                  {EVENT_TYPE_LABELS[booking.event_type]}
                                </div>
                              )}
                              {booking.contact_name && (
                                <div className="text-xs truncate font-medium mt-1">
                                  {booking.contact_name}
                                </div>
                              )}
                              {booking.guest_count && (
                                <div className="text-xs">
                                  {booking.guest_count} gäster
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming bookings list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Kommande bokningar denna vecka</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings && bookings.length > 0 ? (
              <div className="space-y-2">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(booking.booking_date), 'EEE', { locale: sv })}
                        </div>
                        <div className="text-lg font-bold">
                          {format(parseISO(booking.booking_date), 'd')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(booking.booking_date), 'MMM', { locale: sv })}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {booking.contact_name || 'Ingen kontakt'}
                          {booking.contact_company && (
                            <span className="text-muted-foreground ml-2">
                              ({booking.contact_company})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {booking.vessels?.name} • {booking.start_time?.slice(0, 5)} - {booking.end_time?.slice(0, 5)}
                          {booking.guest_count && ` • ${booking.guest_count} gäster`}
                        </div>
                        {booking.event_type && (
                          <div className="text-sm text-muted-foreground">
                            {EVENT_TYPE_LABELS[booking.event_type]}
                            {booking.event_layout && ` (${booking.event_layout})`}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={BOOKING_STATUS_COLORS[booking.status]}
                    >
                      {BOOKING_STATUS_LABELS[booking.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Inga bokningar denna vecka</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/bookings/new')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Skapa första bokningen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
