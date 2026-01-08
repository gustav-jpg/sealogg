import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Waves, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Register() {
  const [pin, setPin] = useState('');
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      setIsPinVerified(true);
    } else {
      toast({
        variant: 'destructive',
        title: 'Felaktig PIN-kod',
        description: 'Ange rätt PIN-kod för att fortsätta.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Lösenorden matchar inte',
        description: 'Kontrollera att du skrivit samma lösenord två gånger.',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'För kort lösenord',
        description: 'Lösenordet måste vara minst 6 tecken.',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(email, password, fullName);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Registrering misslyckades',
        description: error.message,
      });
    } else {
      // Send welcome email via edge function
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: { email, fullName },
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      toast({
        title: 'Konto skapat',
        description: 'Du kan nu logga in med dina uppgifter. Ett välkomstmejl har skickats.',
      });
      navigate('/portal/login');
    }

    setIsLoading(false);
  };

  if (!isPinVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
        <Card className="w-full max-w-md mx-4 animate-fade-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full maritime-gradient">
                <Waves className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-display text-2xl">Skapa konto</CardTitle>
            <CardDescription>Ange PIN-kod för att fortsätta</CardDescription>
          </CardHeader>
          <form onSubmit={handlePinSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN-kod</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  maxLength={4}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full">
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
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full maritime-gradient">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="font-display text-2xl">Skapa konto</CardTitle>
          <CardDescription>Registrera dig för att använda SeaLogg</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Fullständigt namn</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Anna Andersson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-postadress</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@email.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Skapa konto
            </Button>
            <p className="text-sm text-muted-foreground">
              Har du redan ett konto?{' '}
              <Link to="/portal/login" className="text-primary hover:underline">
                Logga in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
