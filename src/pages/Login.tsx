import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Waves, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Inloggning misslyckades',
        description: 'Kontrollera e-post och lösenord.',
      });
    } else {
      navigate('/portal');
    }

    setIsLoading(false);
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'E-post krävs',
        description: 'Ange din e-postadress.',
      });
      return;
    }

    setIsResetLoading(true);

    const { error } = await supabase.functions.invoke('public-password-reset', {
      body: { email: resetEmail },
    });

    // Av säkerhetsskäl: visa samma svar oavsett om e-posten finns eller ej
    if (error) {
      console.error('Password reset error:', error);
      toast({
        variant: 'destructive',
        title: 'Något gick fel',
        description: 'Kunde inte skicka återställningslänk. Försök igen.',
      });
    } else {
      toast({
        title: 'Återställningslänk skickad',
        description: 'Kontrollera din e-post för att återställa lösenordet.',
      });
      setResetDialogOpen(false);
      setResetEmail('');
    }

    setIsResetLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
      <Card className="w-full max-w-md mx-4 animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full maritime-gradient">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="font-logo text-2xl font-extrabold">SeaLogg</CardTitle>
          <CardDescription>Logga in för att fortsätta</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Logga in
            </Button>
            <div className="flex flex-col items-center gap-2 text-sm">
              <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="text-primary hover:underline">
                    Glömt lösenord?
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handlePasswordReset}>
                    <DialogHeader>
                      <DialogTitle>Återställ lösenord</DialogTitle>
                      <DialogDescription>
                        Ange din e-postadress så skickar vi en länk för att återställa ditt lösenord.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="reset-email">E-postadress</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="din@email.se"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isResetLoading}>
                        {isResetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Skicka återställningslänk
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}