import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Wine, GlassWater } from 'lucide-react';
import { BookingDrinks, DrinkPackage } from '@/lib/booking-types';

interface DrinkExtra {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface BookingDrinksTabProps {
  bookingId: string;
}

export function BookingDrinksTab({ bookingId }: BookingDrinksTabProps) {
  const queryClient = useQueryClient();

  const [packageId, setPackageId] = useState<string>('');
  const [isALaCarte, setIsALaCarte] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Fetch existing booking drinks data
  const { data: bookingDrinks, isLoading } = useQuery({
    queryKey: ['booking-drinks', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_drinks')
        .select('*, drink_packages(*)')
        .eq('booking_id', bookingId)
        .maybeSingle();
      if (error) throw error;
      return data as BookingDrinks | null;
    },
  });

  // Fetch available packages
  const { data: packages } = useQuery({
    queryKey: ['drink-packages-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_packages')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as DrinkPackage[];
    },
  });

  // Fetch available extras
  const { data: extras } = useQuery({
    queryKey: ['drink-extras-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drink_extras')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as DrinkExtra[];
    },
  });

  // Initialize form from existing data
  useEffect(() => {
    if (bookingDrinks) {
      setPackageId(bookingDrinks.drink_package_id || '');
      setIsALaCarte(bookingDrinks.is_a_la_carte || false);
      setSelectedExtras(bookingDrinks.extras || []);
      setNotes(bookingDrinks.notes || '');
    }
  }, [bookingDrinks]);

  const saveDrinks = useMutation({
    mutationFn: async () => {
      const selectedPackage = packages?.find(p => p.id === packageId);
      const drinksData = {
        booking_id: bookingId,
        drink_package_id: packageId || null,
        package_name_snapshot: selectedPackage?.name || null,
        is_a_la_carte: isALaCarte,
        extras: selectedExtras,
        notes: notes || null,
      };

      if (bookingDrinks) {
        const { error } = await supabase
          .from('booking_drinks')
          .update(drinksData)
          .eq('id', bookingDrinks.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('booking_drinks')
          .insert(drinksData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Dryckesinfo sparad!');
      queryClient.invalidateQueries({ queryKey: ['booking-drinks', bookingId] });
    },
    onError: (error: any) => {
      toast.error('Kunde inte spara: ' + error.message);
    },
  });

  const toggleExtra = (extraId: string) => {
    setSelectedExtras(prev =>
      prev.includes(extraId)
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const selectedPackage = packages?.find(p => p.id === packageId);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Laddar...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wine className="h-5 w-5" />
            Dryckespaket
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              checked={isALaCarte}
              onCheckedChange={(checked) => {
                setIsALaCarte(checked);
                if (checked) setPackageId('');
              }}
            />
            <Label>À la carte / bar på faktura (inget paket)</Label>
          </div>

          {!isALaCarte && (
            <>
              <div className="space-y-2">
                <Label>Välj dryckespaket</Label>
                <Select value={packageId} onValueChange={setPackageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Välj paket" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Inget paket valt</SelectItem>
                    {packages?.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPackage && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">{selectedPackage.name}</h4>
                  {selectedPackage.description && (
                    <p className="text-sm text-muted-foreground mb-2">{selectedPackage.description}</p>
                  )}
                  {(selectedPackage.contents as any[])?.length > 0 && (
                    <div className="space-y-1">
                      {(selectedPackage.contents as any[]).map((item, i) => (
                        <div key={i} className="text-sm">
                          {item.quantity && <span className="font-medium">{item.quantity} </span>}
                          {item.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GlassWater className="h-5 w-5" />
            Tillval
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {extras && extras.length > 0 ? (
            <div className="space-y-3">
              {extras.map((extra) => (
                <div key={extra.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={extra.id}
                    checked={selectedExtras.includes(extra.id)}
                    onCheckedChange={() => toggleExtra(extra.id)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={extra.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {extra.name}
                    </label>
                    {extra.description && (
                      <p className="text-xs text-muted-foreground">{extra.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Inga tillval konfigurerade. Admin kan lägga till under Dryckespaket → Tillval.
            </p>
          )}

          <div className="space-y-2 pt-4">
            <Label>Övriga dryckesnoteringar</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="T.ex. 'champagne vid avgång', 'extra alkoholfritt'..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveDrinks.mutate()} disabled={saveDrinks.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveDrinks.isPending ? 'Sparar...' : 'Spara dryckesinfo'}
        </Button>
      </div>
    </div>
  );
}
