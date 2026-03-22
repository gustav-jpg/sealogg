import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import sealoggLogo from '@/assets/sealog-logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  // For the "request new link" form on expired page
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [pendingLink, setPendingLink] = useState<{ type: 'invite' | 'recovery'; token: string } | null>(null);
  const [linkErrorMessage, setLinkErrorMessage] = useState<string | null>(null);
  const [isActivatingLink, setIsActivatingLink] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session) {
          setIsValidSession(true);
          setIsCheckingSession(false);
        }
      }
    });

    const checkSession = async () => {
      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const hashParams = new URLSearchParams(hash);
      const hashErrorCode = hashParams.get('error_code') || hashParams.get('error');
      const hashErrorDescription = hashParams.get('error_description');

      if (hashErrorCode) {
        const decodedDescription = hashErrorDescription
          ? decodeURIComponent(hashErrorDescription.replace(/\+/g, ' '))
          : 'Länken är ogiltig eller har utgått.';
        setLinkErrorMessage(decodedDescription);
        setIsCheckingSession(false);
        return;
      }

      // Check for custom invitation token (7-day validity)
      const inviteToken = searchParams.get('invite_token');
      if (inviteToken) {
        setPendingLink({ type: 'invite', token: inviteToken });
        setIsCheckingSession(false);
        return;
      }

      // Check for direct token_hash in URL params (password reset flow)
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (tokenHash && type === 'recovery') {
        setPendingLink({ type: 'recovery', token: tokenHash });
        setIsCheckingSession(false);
        return;
      }

      // Fallback: check for existing session (e.g. from hash fragment redirect)
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidSession(true);
          setIsCheckingSession(false);
          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      setIsCheckingSession(false);
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const handleActivateLink = async () => {
    if (!pendingLink) return;

    setIsActivatingLink(true);
    setLinkErrorMessage(null);

    try {
      let tokenHashToVerify = pendingLink.token;

      if (pendingLink.type === 'invite') {
        const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-invitation-token', {
          body: { token: pendingLink.token },
        });

        if (verifyError) {
          throw new Error('Kunde inte verifiera inbjudningslänken. Be om en ny länk.');
        }

        if (verifyData?.error) {
          throw new Error(verifyData.error);
        }

        if (!verifyData?.token_hash) {
          throw new Error('Ogiltig inbjudningslänk. Be om en ny länk.');
        }

        tokenHashToVerify = verifyData.token_hash;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHashToVerify,
        type: 'recovery',
      });

      if (error || !data.session) {
        throw new Error('Länken är ogiltig eller har utgått. Be om en ny länk.');
      }

      setPendingLink(null);
      setIsValidSession(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Länken är ogiltig eller har utgått.';
      setLinkErrorMessage(message);
    } finally {
      setIsActivatingLink(false);
    }
  };

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

  const handleResendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'E-post krävs',
        description: 'Ange din e-postadress för att få en ny länk.',
      });
      return;
    }

    setIsResending(true);

    try {
      const { error } = await supabase.functions.invoke('public-password-reset', {
        body: { email: resendEmail },
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Något gick fel',
          description: 'Kunde inte skicka ny länk. Försök igen.',
        });
      } else {
        setResendSuccess(true);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Något gick fel',
        description: 'Kunde inte skicka ny länk. Försök igen.',
      });
    }

    setIsResending(false);
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
            <div className="flex justify-center mb-4">
              <img src={sealoggLogo} alt="SeaLogg" className="h-10" />
            </div>
            <CardTitle>{pendingLink ? 'Bekräfta länken' : 'Länken har utgått'}</CardTitle>
            <CardDescription>
              {pendingLink
                ? 'Tryck på knappen nedan för att öppna länken säkert och välja nytt lösenord.'
                : 'Återställningslänken är ogiltig eller har utgått. Ange din e-postadress nedan så skickar vi en ny länk direkt.'}
            </CardDescription>
          </CardHeader>

          {resendSuccess ? (
            <CardContent className="text-center space-y-4 pb-6">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="font-medium">Ny länk skickad!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Kolla din e-post (även skräppost) efter ett mail från SeaLogg med en ny länk.
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/portal/login')} className="w-full mt-4">
                Tillbaka till inloggning
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleResendLink}>
              <CardContent className="space-y-4">
                {pendingLink && (
                  <Button type="button" className="w-full" onClick={handleActivateLink} disabled={isActivatingLink}>
                    {isActivatingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Öppna återställningslänk
                  </Button>
                )}

                {linkErrorMessage && (
                  <p className="text-sm text-destructive text-center">{linkErrorMessage}</p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="resend-email">E-postadress</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    placeholder="din@email.se"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isResending}>
                  {isResending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Skicka ny länk
                </Button>
                <Button variant="ghost" onClick={() => navigate('/portal/login')} className="w-full">
                  Tillbaka till inloggning
                </Button>
              </CardFooter>
            </form>
          )}
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
