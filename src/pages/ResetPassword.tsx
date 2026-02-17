import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import sealoggLogo from '@/assets/sealog-logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Listen for auth state changes – the PASSWORD_RECOVERY event fires
    // when the Supabase client processes the recovery token from the URL hash.
    // This avoids a race condition where getSession() runs before the hash is parsed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session) {
          setIsValidSession(true);
          setIsCheckingSession(false);
        }
      }
    });

    // Also check if session already exists (e.g. page refresh)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
        setIsCheckingSession(false);
      } else {
        // Give some extra time for the hash to be processed before showing error
        setTimeout(() => {
          setIsCheckingSession(prev => {
            if (prev) {
              toast({
                variant: 'destructive',
                title: 'Ogiltig eller utgången länk',
                description: 'Begär en ny återställningslänk.',
              });
            }
            return false;
          });
        }, 3000);
      }
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Lösenordet är för kort',
        description: 'Lösenordet måste vara minst 6 tecken.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Lösenorden matchar inte',
        description: 'Kontrollera att du skrivit samma lösenord.',
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Något gick fel',
        description: 'Kunde inte uppdatera lösenordet. Försök igen.',
      });
    } else {
      toast({
        title: 'Lösenord uppdaterat',
        description: 'Du kan nu logga in med ditt nya lösenord.',
      });
      await supabase.auth.signOut();
      navigate('/portal/login');
    }

    setIsLoading(false);
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle>Länken har utgått</CardTitle>
            <CardDescription>
              Återställningslänken är ogiltig eller har utgått.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate('/portal/login')} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={sealoggLogo} alt="SeaLogg" className="h-10" />
          </div>
          <CardTitle className="font-logo text-2xl font-extrabold">Nytt lösenord</CardTitle>
          <CardDescription>Ange ditt nya lösenord</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nytt lösenord</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Uppdatera lösenord
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
