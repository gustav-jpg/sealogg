import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Save, CalendarIcon, AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIETARY_TAGS, BookingFood, Menu } from '@/lib/booking-types';

interface BookingFoodTabProps {
  bookingId: string;
  guestCount?: number;
}

export function BookingFoodTab({ bookingId, guestCount }: BookingFoodTabProps) {
  const queryClient = useQueryClient();

  const [menuId, setMenuId] = useState<string>('');
  const [portions, setPortions] = useState<number | ''>(guestCount || '');
  const [dietaryTags, setDietaryTags] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [menuDeadline, setMenuDeadline] = useState<Date | undefined>();
  const [kitchenNotes, setKitchenNotes] = useState('');

  // Fetch existing booking food data
  const { data: bookingFood, isLoading } = useQuery({
    queryKey: ['booking-food', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_food')
        .select('*, menus(*)')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (error) throw error;
      return data as BookingFood | null;
    },
  });

  // Fetch available menus
  const { data: menus } = useQuery({
    queryKey: ['menus-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Menu[];
    },
  });

  // Initialize form from existing data
  useEffect(() => {
    if (bookingFood) {
      setMenuId(bookingFood.menu_id || '');
      setPortions(bookingFood.portions || guestCount || '');
      setDietaryTags(bookingFood.dietary_tags || []);
      setDietaryNotes(bookingFood.dietary_notes || '');
      setMenuDeadline(bookingFood.menu_deadline ? new Date(bookingFood.menu_deadline) : undefined);
      setKitchenNotes(bookingFood.kitchen_notes || '');
    } else if (guestCount) {
      setPortions(guestCount);
    }
  }, [bookingFood, guestCount]);

  const saveFood = useMutation({
    mutationFn: async () => {
      const selectedMenu = menus?.find(m => m.id === menuId);
      const foodData = {
        booking_id: bookingId,
        menu_id: menuId || null,
        menu_name_snapshot: selectedMenu?.name || null,
        portions: portions || null,
        dietary_tags: dietaryTags,
        dietary_notes: dietaryNotes || null,
        menu_deadline: menuDeadline ? format(menuDeadline, 'yyyy-MM-dd') : null,
        kitchen_notes: kitchenNotes || null,
      };

      if (bookingFood) {
        const { error } = await supabase
          .from('booking_food')
          .update(foodData)
          .eq('id', bookingFood.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booking_food')
          .insert(foodData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Matinfo sparad!');
      queryClient.invalidateQueries({ queryKey: ['booking-food', bookingId] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const toggleDietaryTag = (tag: string) => {
    setDietaryTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const selectedMenu = menus?.find(m => m.id === menuId);
  const isDeadlinePassed = menuDeadline && menuDeadline < new Date();

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laddar...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Menyval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Meny</Label>
              <Select value={menuId || 'none'} onValueChange={(v) => setMenuId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Välj meny" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen meny vald</SelectItem>
                  {menus?.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name} {menu.season && `(${menu.season})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Antal portioner</Label>
              <Input
                type="number"
                value={portions}
                onChange={(e) => setPortions(parseInt(e.target.value) || '')}
                placeholder={guestCount ? `${guestCount} (från gästantal)` : 'Ange antal'}
              />
            </div>
          </div>

          {selectedMenu && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">{selectedMenu.name}</h4>
              {selectedMenu.description && (
                <p className="text-sm text-muted-foreground mb-2">{selectedMenu.description}</p>
              )}
              {(selectedMenu.courses as any[])?.length > 0 && (
                <div className="space-y-1">
                  {(selectedMenu.courses as any[]).map((course, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-medium capitalize">{course.type}:</span> {course.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Meny-deadline (intern)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full md:w-[240px] justify-start text-left font-normal',
                    !menuDeadline && 'text-muted-foreground',
                    isDeadlinePassed && 'border-destructive'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {menuDeadline ? format(menuDeadline, 'yyyy-MM-dd') : 'Välj deadline'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={menuDeadline}
                  onSelect={setMenuDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {isDeadlinePassed && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Deadline har passerat!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Specialkost & Allergier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vanliga tags</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_TAGS.map((tag) => (
                <Badge
                  key={tag}
                  variant={dietaryTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleDietaryTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Detaljerad specialkostinfo</Label>
            <Textarea
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="T.ex. '2x glutenfri, 1x utan lök, 3x vegetarisk (en vegan)'"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Noteringar till köket</Label>
            <Textarea
              value={kitchenNotes}
              onChange={(e) => setKitchenNotes(e.target.value)}
              placeholder="Extra info för köket..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveFood.mutate()} disabled={saveFood.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveFood.isPending ? 'Sparar...' : 'Spara matinfo'}
        </Button>
      </div>
    </div>
  );
}
