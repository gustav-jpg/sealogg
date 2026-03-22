import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import sealoggLogo from '@/assets/sealog-logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [pendingLink, setPendingLink] = useState<{ type: 'invite' | 'recovery'; token: string } | null>(null);
  const [linkErrorMessage, setLinkErrorMessage] = useState<string | null>(null);
  const [isActivatingLink, setIsActivatingLink] = useState(false);
  // OTP code fallback state
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
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
        setShowCodeEntry(true);
        setIsCheckingSession(false);
        return;
      }

      const inviteToken = searchParams.get('invite_token');
      if (inviteToken) {
        setPendingLink({ type: 'invite', token: inviteToken });
        setIsCheckingSession(false);
        return;
      }

      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      if (tokenHash && type === 'recovery') {
        setPendingLink({ type: 'recovery', token: tokenHash });
        setIsCheckingSession(false);
        return;
      }

      // No params at all = user navigated here to enter code manually
      if (!inviteToken && !tokenHash && !hash) {
        setShowCodeEntry(true);
        setIsCheckingSession(false);
        return;
      }

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

      setShowCodeEntry(true);
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

        if (verifyError || verifyData?.error || !verifyData?.token_hash) {
          const errMsg = verifyData?.error || 'Kunde inte verifiera länken.';
          setLinkErrorMessage(errMsg);
          setShowCodeEntry(true);
          setIsActivatingLink(false);
          return;
        }
        tokenHashToVerify = verifyData.token_hash;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHashToVerify,
        type: 'recovery',
      });

      if (error || !data.session) {
        setLinkErrorMessage('Länken fungerade inte. Använd koden från mailet istället.');
        setShowCodeEntry(true);
        setIsActivatingLink(false);
        return;
      }

      setPendingLink(null);
      setIsValidSession(true);
    } catch {
      setLinkErrorMessage('Länken fungerade inte. Använd koden från mailet istället.');
      setShowCodeEntry(true);
    } finally {
      setIsActivatingLink(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || !otpEmail.trim()) {
      toast({ variant: 'destructive', title: 'Fyll i alla fält', description: 'Ange både e-postadress och kod.' });
      return;
    }

    setIsVerifyingCode(true);
    setLinkErrorMessage(null);

    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-invitation-token', {
        body: { otp_code: otpCode.trim(), email: otpEmail.trim() },
      });

      if (verifyError || verifyData?.error || !verifyData?.token_hash) {
        setLinkErrorMessage(verifyData?.error || 'Felaktig kod eller e-postadress. Försök igen.');
        setIsVerifyingCode(false);
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: verifyData.token_hash,
        type: 'recovery',
      });

      if (error || !data.session) {
        setLinkErrorMessage('Kunde inte aktivera sessionen. Försök igen.');
        setIsVerifyingCode(false);
        return;
      }

      setIsValidSession(true);
    } catch {
      setLinkErrorMessage('Något gick fel. Försök igen.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Lösenordet är för kort', description: 'Lösenordet måste vara minst 6 tecken.' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Lösenorden matchar inte', description: 'Kontrollera att du skrivit samma lösenord.' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ variant: 'destructive', title: 'Något gick fel', description: 'Kunde inte uppdatera lösenordet. Försök igen.' });
    } else {
      toast({ title: 'Lösenord uppdaterat', description: 'Du kan nu logga in med ditt nya lösenord.' });
      await supabase.auth.signOut();
      navigate('/portal/login');
    }
    setIsLoading(false);
  };

  const handleResendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      toast({ variant: 'destructive', title: 'E-post krävs', description: 'Ange din e-postadress.' });
      return;
    }
    setIsResending(true);
    try {
      await supabase.functions.invoke('public-password-reset', { body: { email: resendEmail } });
      setResendSuccess(true);
    } catch {
      toast({ variant: 'destructive', title: 'Något gick fel', description: 'Kunde inte skicka. Försök igen.' });
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

  // Password change form (valid session)
  if (isValidSession) {
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
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Bekräfta lösenord</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
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

  // Link activation + code fallback view
  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={sealoggLogo} alt="SeaLogg" className="h-10" />
          </div>
          <CardTitle>{pendingLink ? 'Bekräfta länken' : 'Återställ lösenord'}</CardTitle>
          <CardDescription>
            {pendingLink
              ? 'Tryck på knappen nedan för att öppna länken. Om det inte fungerar, använd koden från mailet.'
              : 'Ange koden från mailet, eller begär en ny.'}
          </CardDescription>
        </CardHeader>

        {resendSuccess ? (
          <CardContent className="text-center space-y-4 pb-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="font-medium">Nytt mail skickat!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Kolla din e-post (även skräppost). Mailet innehåller både en länk och en 6-siffrig kod.
              </p>
            </div>
            <Button variant="outline" onClick={() => { setResendSuccess(false); setShowCodeEntry(true); }} className="w-full mt-4">
              Jag har koden – ange den
            </Button>
            <Button variant="ghost" onClick={() => navigate('/portal/login')} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        ) : (
          <CardContent className="space-y-4">
            {/* Link activation button */}
            {pendingLink && (
              <Button type="button" className="w-full" onClick={handleActivateLink} disabled={isActivatingLink}>
                {isActivatingLink && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Öppna återställningslänk
              </Button>
            )}

            {linkErrorMessage && (
              <p className="text-sm text-destructive text-center">{linkErrorMessage}</p>
            )}

            {/* OTP Code Entry */}
            {showCodeEntry && (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <KeyRound className="h-3 w-3" /> Ange kod från mailet
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp-email">E-postadress</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="din@email.se"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp-code">6-siffrig kod</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isVerifyingCode || otpCode.length !== 6}>
                  {isVerifyingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verifiera kod
                </Button>
              </form>
            )}

            {/* Request new code */}
            {showCodeEntry && (
              <>
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Har du ingen kod?</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <form onSubmit={handleResendLink} className="space-y-3">
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
                  <Button type="submit" variant="outline" className="w-full" disabled={isResending}>
                    {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Skicka ny kod
                  </Button>
                </form>
              </>
            )}

            {!showCodeEntry && !pendingLink && (
              <Button variant="outline" onClick={() => setShowCodeEntry(true)} className="w-full">
                <KeyRound className="mr-2 h-4 w-4" />
                Ange kod istället
              </Button>
            )}

            <Button variant="ghost" onClick={() => navigate('/portal/login')} className="w-full">
              Tillbaka till inloggning
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
