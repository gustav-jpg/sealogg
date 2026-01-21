import { Plus, Trash2, Users, Clock, UserPlus, UserMinus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface StopEntry {
  tempId: string;
  stopOrder: number;
  departureTime: string;
  departureLocation: string;
  arrivalTime: string;
  arrivalLocation: string;
  passengerCount: string; // Legacy field, kept for compatibility
  paxOn: string;
  paxOff: string;
  notes: string;
}

interface PassengerSummary {
  firstDeparture: string;
  lastDeparture: string;
  totalPaxOn: number;
  totalPaxOff: number;
  stopCount: number;
  stops: {
    order: number;
    time: string;
    dock: string;
    paxOn: number;
    paxOff: number;
  }[];
}

interface LogbookStopsProps {
  stops: StopEntry[];
  onStopsChange: (stops: StopEntry[]) => void;
  disabled?: boolean;
  passengerSession?: { id: string; is_active: boolean } | null;
  passengerSummary?: PassengerSummary | null;
  onActivatePassengerRegistration?: () => void;
  isActivatingPassenger?: boolean;
  onOpenPassengerSession?: () => void;
}

// Calculate running total of passengers onboard
function calculateOnboard(stops: StopEntry[], currentIndex: number): number {
  let total = 0;
  for (let i = 0; i <= currentIndex; i++) {
    const stop = stops[i];
    total += parseInt(stop.paxOn) || 0;
    total -= parseInt(stop.paxOff) || 0;
  }
  return Math.max(0, total);
}

export function LogbookStops({ 
  stops, 
  onStopsChange, 
  disabled = false,
  passengerSession,
  passengerSummary,
  onActivatePassengerRegistration,
  isActivatingPassenger,
  onOpenPassengerSession,
}: LogbookStopsProps) {
  const sortedStops = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);

  const addStop = () => {
    const newOrder = stops.length > 0 ? Math.max(...stops.map(s => s.stopOrder)) + 1 : 1;
    onStopsChange([
      ...stops,
      {
        tempId: crypto.randomUUID(),
        stopOrder: newOrder,
        departureTime: '',
        departureLocation: '',
        arrivalTime: '',
        arrivalLocation: '',
        passengerCount: '',
        paxOn: '',
        paxOff: '',
        notes: '',
      },
    ]);
  };

  const updateStop = (tempId: string, field: keyof StopEntry, value: string) => {
    onStopsChange(stops.map(s => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  };

  const removeStop = (tempId: string) => {
    const filtered = stops.filter(s => s.tempId !== tempId);
    const reordered = filtered.map((s, index) => ({ ...s, stopOrder: index + 1 }));
    onStopsChange(reordered);
  };

  if (stops.length === 0) {
    // Show passenger summary if session is closed and has data
    if (passengerSession && !passengerSession.is_active && passengerSummary) {
      return (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="font-semibold">Passagerarregistrering avslutad</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="font-mono">{passengerSummary.firstDeparture} – {passengerSummary.lastDeparture}</span>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2 text-primary">
                <UserPlus className="h-4 w-4" />
                <span className="text-sm">Påstigande totalt</span>
              </div>
              <span className="text-xl font-bold text-primary">{passengerSummary.totalPaxOn}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <UserMinus className="h-4 w-4" />
                <span className="text-sm">Avstigande totalt</span>
              </div>
              <span className="text-xl font-bold text-destructive">{passengerSummary.totalPaxOff}</span>
            </div>
          </div>

          {/* Stops table */}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Tid</TableHead>
                <TableHead>Brygga</TableHead>
                <TableHead className="text-center w-20">På</TableHead>
                <TableHead className="text-center w-20">Av</TableHead>
                <TableHead className="text-center w-24">Ombord</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passengerSummary.stops.map((stop, index) => {
                const runningTotal = passengerSummary.stops
                  .slice(0, index + 1)
                  .reduce((sum, s) => sum + s.paxOn - s.paxOff, 0);
                return (
                  <TableRow key={stop.order}>
                    <TableCell className="text-muted-foreground">{stop.order}</TableCell>
                    <TableCell className="font-mono">{stop.time}</TableCell>
                    <TableCell>{stop.dock}</TableCell>
                    <TableCell className="text-center font-semibold text-primary">
                      {stop.paxOn > 0 ? `+${stop.paxOn}` : '-'}
                    </TableCell>
                    <TableCell className="text-center font-semibold text-destructive">
                      {stop.paxOff > 0 ? `-${stop.paxOff}` : '-'}
                    </TableCell>
                    <TableCell className="text-center font-bold">{runningTotal}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    }

    // Show different message if passenger registration is active
    if (passengerSession?.is_active) {
      return (
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 text-primary mb-2">
            <Users className="h-5 w-5" />
            <span className="font-semibold">Passagerarregistrering aktiv</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Stopp registreras via passagerarregistreringen
          </p>
          {!disabled && onOpenPassengerSession && (
            <Button variant="default" onClick={onOpenPassengerSession}>
              <Users className="h-4 w-4 mr-2" />
              Öppna passagerarregistrering
            </Button>
          )}
        </div>
      );
    }

    const showPassengerOption = passengerSession || onActivatePassengerRegistration;

    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground mb-4">
          {showPassengerOption ? 'Inga stopp tillagda ännu. Välj ett alternativ:' : 'Inga stopp tillagda ännu.'}
        </p>
        {!disabled && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button variant="outline" onClick={addStop}>
              <Plus className="h-4 w-4 mr-2" />
              Lägg till första stoppet
            </Button>
            {showPassengerOption && (
              <>
                <span className="text-muted-foreground text-sm">eller</span>
                {passengerSession ? (
                  <Button variant="default" onClick={onOpenPassengerSession}>
                    <Users className="h-4 w-4 mr-2" />
                    Öppna passagerarregistrering
                  </Button>
                ) : onActivatePassengerRegistration && (
                  <Button 
                    variant="default" 
                    onClick={onActivatePassengerRegistration}
                    disabled={isActivatingPassenger}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {isActivatingPassenger ? 'Aktiverar...' : 'Aktivera passagerarregistrering'}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Calculate final passenger count
  const finalOnboard = calculateOnboard(sortedStops, sortedStops.length - 1);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="min-w-20">Tid</TableHead>
              <TableHead className="min-w-28">Position</TableHead>
              <TableHead className="w-16 text-center">Pax på</TableHead>
              <TableHead className="w-16 text-center">Pax av</TableHead>
              <TableHead className="w-20 text-center">Ombord</TableHead>
              {!disabled && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStops.map((stop, index) => {
              const onboard = calculateOnboard(sortedStops, index);
              return (
                <TableRow key={stop.tempId}>
                  <TableCell className="font-medium text-muted-foreground">
                    {stop.stopOrder}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="time"
                      value={stop.departureTime}
                      onChange={e => updateStop(stop.tempId, 'departureTime', e.target.value)}
                      disabled={disabled}
                      className="h-8 w-20 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={stop.departureLocation || stop.arrivalLocation}
                      onChange={e => {
                        updateStop(stop.tempId, 'departureLocation', e.target.value);
                        updateStop(stop.tempId, 'arrivalLocation', e.target.value);
                      }}
                      disabled={disabled}
                      placeholder="Hamn/plats"
                      className="h-8 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={stop.paxOn}
                      onChange={e => updateStop(stop.tempId, 'paxOn', e.target.value)}
                      disabled={disabled}
                      placeholder="0"
                      className="h-8 w-14 text-sm px-2 text-center"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={stop.paxOff}
                      onChange={e => updateStop(stop.tempId, 'paxOff', e.target.value)}
                      disabled={disabled}
                      placeholder="0"
                      className="h-8 w-14 text-sm px-2 text-center"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={onboard > 0 ? "default" : "secondary"}
                      className="font-mono min-w-10 justify-center"
                    >
                      {onboard}
                    </Badge>
                  </TableCell>
                  {!disabled && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeStop(stop.tempId)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        {!disabled && (
          <Button variant="outline" size="sm" onClick={addStop}>
            <Plus className="h-4 w-4 mr-2" />
            Lägg till stopp
          </Button>
        )}
        <div className="flex items-center gap-2 text-sm ml-auto">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Slutligt antal ombord:</span>
          <Badge variant="outline" className="font-mono">{finalOnboard}</Badge>
        </div>
      </div>
    </div>
  );
}

// Read-only display version for closed logbooks
interface LogbookStopsDisplayProps {
  stops: Array<{
    id: string;
    stop_order: number;
    departure_time: string | null;
    departure_location: string | null;
    arrival_time: string | null;
    arrival_location: string | null;
    passenger_count: number | null;
    pax_on: number | null;
    pax_off: number | null;
  }>;
}

function calculateOnboardFromDb(
  stops: LogbookStopsDisplayProps['stops'],
  currentIndex: number
): number {
  let total = 0;
  for (let i = 0; i <= currentIndex; i++) {
    const stop = stops[i];
    // Support both new pax_on/pax_off and legacy passenger_count
    if (stop.pax_on !== null || stop.pax_off !== null) {
      total += stop.pax_on || 0;
      total -= stop.pax_off || 0;
    } else if (stop.passenger_count !== null) {
      total += stop.passenger_count;
    }
  }
  return Math.max(0, total);
}

export function LogbookStopsDisplay({ stops }: LogbookStopsDisplayProps) {
  if (stops.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Inga stopp registrerade.</p>;
  }

  const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const finalOnboard = calculateOnboardFromDb(sortedStops, sortedStops.length - 1);

  // Check if using new format (pax_on/pax_off) or legacy (passenger_count)
  const usesNewFormat = sortedStops.some(s => s.pax_on !== null || s.pax_off !== null);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Tid</TableHead>
              <TableHead>Position</TableHead>
              {usesNewFormat ? (
                <>
                  <TableHead className="text-center">Pax på</TableHead>
                  <TableHead className="text-center">Pax av</TableHead>
                </>
              ) : (
                <TableHead className="text-center">Pax</TableHead>
              )}
              <TableHead className="text-center">Ombord</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStops.map((stop, index) => {
              const onboard = calculateOnboardFromDb(sortedStops, index);
              const position = stop.departure_location || stop.arrival_location || '-';
              
              return (
                <TableRow key={stop.id}>
                  <TableCell className="font-medium text-muted-foreground">
                    {stop.stop_order}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {stop.departure_time || '-'}
                  </TableCell>
                  <TableCell>{position}</TableCell>
                  {usesNewFormat ? (
                    <>
                      <TableCell className="text-center font-mono">
                        {stop.pax_on !== null && stop.pax_on > 0 ? `+${stop.pax_on}` : '-'}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {stop.pax_off !== null && stop.pax_off > 0 ? `-${stop.pax_off}` : '-'}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="text-center font-mono">
                      {stop.passenger_count !== null ? stop.passenger_count : '-'}
                    </TableCell>
                  )}
                  <TableCell className="text-center">
                    <Badge 
                      variant={onboard > 0 ? "default" : "secondary"}
                      className="font-mono min-w-10 justify-center"
                    >
                      {onboard}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex items-center justify-end gap-2 text-sm">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">Slutligt antal ombord:</span>
        <Badge variant="outline" className="font-mono">{finalOnboard}</Badge>
      </div>
    </div>
  );
}
