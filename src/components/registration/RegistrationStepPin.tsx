import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  onVerified: (organizationId: string, organizationName: string) => void;
}

export function RegistrationStepPin({ onVerified }: Props) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-registration-code', {
        body: { code: pin },
      });

      if (error || data?.error) {
        toast({
          variant: 'destructive',
          title: 'Felaktig kod',
          description: data?.error || 'Kontrollera koden och försök igen.',
        });
        setIsLoading(false);
        return;
      }

      onVerified(data.organization_id, data.organization_name);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Fel',
        description: 'Kunde inte verifiera koden. Försök igen.',
      });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pin">Organisationskod</Label>
          <Input
            id="pin"
            type="text"
            inputMode="numeric"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
            maxLength={4}
            className="text-center text-2xl tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Fråga din arbetsgivare om organisationskoden.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" disabled={isLoading || pin.length !== 4}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Fortsätt
        </Button>
        <p className="text-sm text-muted-foreground">
          Har du redan ett konto?{' '}
          <Link to="/portal/login" className="text-primary hover:underline">
            Logga in
          </Link>
        </p>
      </CardFooter>
    </form>
  );
}
