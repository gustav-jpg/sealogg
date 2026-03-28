import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface Props {
  organizationId: string;
  organizationName: string;
  onAccountCreated: (registrationId: string) => void;
  onBack: () => void;
}

export function RegistrationStepAccount({ organizationId, organizationName, onAccountCreated, onBack }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Lösenorden matchar inte', description: 'Kontrollera att du skrivit samma lösenord två gånger.' });
      return;
    }

    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'För kort lösenord', description: 'Lösenordet måste vara minst 6 tecken.' });
      return;
    }

    setIsLoading(true);

    try {
      // Sign up user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        toast({ variant: 'destructive', title: 'Registrering misslyckades', description: signUpError.message });
        setIsLoading(false);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        toast({ variant: 'destructive', title: 'Fel', description: 'Kunde inte skapa konto.' });
        setIsLoading(false);
        return;
      }

      // Create pending registration
      const { data: regData, error: regError } = await supabase
        .from('pending_registrations')
        .insert({
          user_id: userId,
          organization_id: organizationId,
        })
        .select('id')
        .single();

      if (regError) {
        console.error('Failed to create pending registration:', regError);
        toast({ variant: 'destructive', title: 'Fel', description: 'Konto skapades men registrering kunde inte slutföras.' });
        setIsLoading(false);
        return;
      }

      // Send welcome email
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: { email, fullName },
        });
      } catch {
        console.error('Failed to send welcome email');
      }

      onAccountCreated(regData.id);
    } catch {
      toast({ variant: 'destructive', title: 'Fel', description: 'Ett oväntat fel uppstod.' });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Organisation:</span>
          <Badge variant="secondary">{organizationName}</Badge>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Fullständigt namn</Label>
          <Input id="fullName" type="text" placeholder="Anna Andersson" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-postadress</Label>
          <Input id="email" type="email" placeholder="din@email.se" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Lösenord</Label>
          <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
          <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Skapa konto & fortsätt
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
      </CardFooter>
    </form>
  );
}
