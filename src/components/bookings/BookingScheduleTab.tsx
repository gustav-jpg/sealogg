import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Clock, Save } from 'lucide-react';
import { Booking } from '@/lib/booking-types';

interface ScheduleItem {
  id: string;
  time: string;
  description: string;
}

interface BookingScheduleTabProps {
  booking: Booking;
}

export function BookingScheduleTab({ booking }: BookingScheduleTabProps) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from booking data
  useEffect(() => {
    const schedule = (booking as any).schedule;
    if (schedule && Array.isArray(schedule)) {
      setItems(schedule.map((item: any, index: number) => ({
        id: item.id || `item-${index}`,
        time: item.time || '',
        description: item.description || '',
      })));
    }
    setHasChanges(false);
  }, [booking]);

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const scheduleData = items
        .filter(item => item.time && item.description)
        .map(item => ({
          time: item.time,
          description: item.description,
        }));

      const { error } = await supabase
        .from('bookings')
        .update({ schedule: scheduleData })
        .eq('id', booking.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tidsplan sparad!');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const addItem = () => {
    const newItem: ScheduleItem = {
      id: `item-${Date.now()}`,
      time: '',
      description: '',
    };
    setItems([...items, newItem]);
    setHasChanges(true);
  };

  const updateItem = (id: string, field: 'time' | 'description', value: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
    setHasChanges(true);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
    setHasChanges(true);
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
    setHasChanges(true);
  };

  // Sort by time when displaying
  const sortedItems = [...items].sort((a, b) => {
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Tidsplan
        </CardTitle>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addItem}
          >
            <Plus className="h-4 w-4 mr-1" />
            Lägg till
          </Button>
          {hasChanges && (
            <Button
              size="sm"
              onClick={() => saveSchedule.mutate()}
              disabled={saveSchedule.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              Spara
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Ingen tidsplan ännu</p>
            <p className="text-sm">Lägg till aktiviteter för att skapa en tidsplan för evenemanget</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div 
                key={item.id}
                className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg group"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                  >
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === items.length - 1}
                  >
                    <GripVertical className="h-3 w-3 rotate-90" />
                  </Button>
                </div>
                <Input
                  type="time"
                  value={item.time}
                  onChange={(e) => updateItem(item.id, 'time', e.target.value)}
                  className="w-28"
                />
                <Input
                  placeholder="Beskrivning, t.ex. 'Gäster anländer'"
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Förhandsvisning (sorterad)</h4>
            <div className="space-y-1">
              {sortedItems
                .filter(item => item.time && item.description)
                .map(item => (
                  <div key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="font-mono font-medium text-primary">{item.time}</span>
                    <span className="text-muted-foreground">—</span>
                    <span>{item.description}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
