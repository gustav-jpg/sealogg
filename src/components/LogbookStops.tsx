import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  passengerCount: string;
  notes: string;
}

interface LogbookStopsProps {
  stops: StopEntry[];
  onStopsChange: (stops: StopEntry[]) => void;
  disabled?: boolean;
}

export function LogbookStops({ stops, onStopsChange, disabled = false }: LogbookStopsProps) {
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
        notes: '',
      },
    ]);
  };

  const updateStop = (tempId: string, field: keyof StopEntry, value: string) => {
    onStopsChange(stops.map(s => (s.tempId === tempId ? { ...s, [field]: value } : s)));
  };

  const removeStop = (tempId: string) => {
    const filtered = stops.filter(s => s.tempId !== tempId);
    // Re-order remaining stops
    const reordered = filtered.map((s, index) => ({ ...s, stopOrder: index + 1 }));
    onStopsChange(reordered);
  };

  if (stops.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground mb-4">Inga stopp tillagda ännu.</p>
        {!disabled && (
          <Button variant="outline" onClick={addStop}>
            <Plus className="h-4 w-4 mr-2" />
            Lägg till första stoppet
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="min-w-24">Avg. tid</TableHead>
              <TableHead className="min-w-32">Från</TableHead>
              <TableHead className="min-w-24">Ank. tid</TableHead>
              <TableHead className="min-w-32">Till</TableHead>
              <TableHead className="w-20">Pax</TableHead>
              {!disabled && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stops
              .sort((a, b) => a.stopOrder - b.stopOrder)
              .map((stop) => (
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
                      className="h-8 w-24 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={stop.departureLocation}
                      onChange={e => updateStop(stop.tempId, 'departureLocation', e.target.value)}
                      disabled={disabled}
                      placeholder="Hamn/plats"
                      className="h-8 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="time"
                      value={stop.arrivalTime}
                      onChange={e => updateStop(stop.tempId, 'arrivalTime', e.target.value)}
                      disabled={disabled}
                      className="h-8 w-24 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      value={stop.arrivalLocation}
                      onChange={e => updateStop(stop.tempId, 'arrivalLocation', e.target.value)}
                      disabled={disabled}
                      placeholder="Hamn/plats"
                      className="h-8 text-sm px-2"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      min={0}
                      value={stop.passengerCount}
                      onChange={e => updateStop(stop.tempId, 'passengerCount', e.target.value)}
                      disabled={disabled}
                      placeholder="0"
                      className="h-8 w-14 text-sm px-2"
                    />
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
              ))}
          </TableBody>
        </Table>
      </div>
      
      {!disabled && (
        <Button variant="outline" size="sm" onClick={addStop} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Lägg till stopp
        </Button>
      )}
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
  }>;
}

export function LogbookStopsDisplay({ stops }: LogbookStopsDisplayProps) {
  if (stops.length === 0) {
    return <p className="text-muted-foreground text-center py-4">Inga stopp registrerade.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Avg. tid</TableHead>
            <TableHead>Från</TableHead>
            <TableHead>Ank. tid</TableHead>
            <TableHead>Till</TableHead>
            <TableHead className="text-right">Pax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stops
            .sort((a, b) => a.stop_order - b.stop_order)
            .map((stop) => (
              <TableRow key={stop.id}>
                <TableCell className="font-medium text-muted-foreground">
                  {stop.stop_order}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {stop.departure_time || '-'}
                </TableCell>
                <TableCell>{stop.departure_location || '-'}</TableCell>
                <TableCell className="font-mono text-sm">
                  {stop.arrival_time || '-'}
                </TableCell>
                <TableCell>{stop.arrival_location || '-'}</TableCell>
                <TableCell className="text-right">
                  {stop.passenger_count !== null ? stop.passenger_count : '-'}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      
      {/* Summary row */}
      <div className="flex justify-end mt-2 text-sm text-muted-foreground">
        Totalt passagerare: {stops.reduce((sum, s) => sum + (s.passenger_count || 0), 0)}
      </div>
    </div>
  );
}
