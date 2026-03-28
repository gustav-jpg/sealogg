import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RegistrationStepPin } from '@/components/registration/RegistrationStepPin';
import { RegistrationStepAccount } from '@/components/registration/RegistrationStepAccount';
import { RegistrationStepCertificates, CertificateUpload } from '@/components/registration/RegistrationStepCertificates';
import { RegistrationStepComplete } from '@/components/registration/RegistrationStepComplete';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import sealoggLogo from '@/assets/sealog-logo.png';

export default function Register() {
  const [step, setStep] = useState(1);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [accountData, setAccountData] = useState<{ fullName: string; email: string; password: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const stepDescriptions: Record<number, string> = {
    1: 'Ange din organisationskod för att börja',
    2: 'Fyll i dina uppgifter',
    3: 'Ladda upp dina certifikat',
    4: 'Registrering slutförd',
  };

  const handleFinalSubmit = async (certificates: CertificateUpload[]) => {
    if (!accountData) return;
    setIsSubmitting(true);

    try {
      // 1. Create the account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: accountData.fullName, organization_id: organizationId },
        },
      });

      if (signUpError) {
        toast({ variant: 'destructive', title: 'Registrering misslyckades', description: signUpError.message });
        setIsSubmitting(false);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        toast({ variant: 'destructive', title: 'Fel', description: 'Kunde inte skapa konto.' });
        setIsSubmitting(false);
        return;
      }

      // 2. Create pending registration
      const { data: regData, error: regError } = await supabase
        .from('pending_registrations')
        .insert({ user_id: userId, organization_id: organizationId })
        .select('id')
        .single();

      if (regError) {
        console.error('Failed to create pending registration:', regError);
        toast({ variant: 'destructive', title: 'Fel', description: 'Konto skapades men registrering kunde inte slutföras.' });
        setIsSubmitting(false);
        return;
      }

      // 3. Upload certificates and save records
      for (const cert of certificates) {
        const filePath = `${userId}/${cert.id}-${cert.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('registration-certificates')
          .upload(filePath, cert.file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        await supabase.from('pending_certificates').insert({
          registration_id: regData.id,
          file_url: filePath,
          file_name: cert.file.name,
          ai_suggested_type: cert.aiResult?.certificate_type || null,
          ai_suggested_expiry: cert.aiResult?.expiry_date || null,
          ai_confidence: cert.aiResult?.confidence || null,
          confirmed_type_id: cert.aiResult?.certificate_type_id || null,
        });
      }

      // 4. Sign out so user can't access portal until approved
      await supabase.auth.signOut();

      setStep(4);
    } catch {
      toast({ variant: 'destructive', title: 'Fel', description: 'Ett oväntat fel uppstod.' });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={sealoggLogo} alt="SeaLogg" className="h-10" />
          </div>
          <CardTitle className="font-display text-2xl">
            {step === 4 ? 'Registrering klar!' : 'Skapa konto'}
          </CardTitle>
          <CardDescription>{stepDescriptions[step]}</CardDescription>
          {step < 4 && (
            <div className="flex gap-2 justify-center mt-3">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-12 rounded-full transition-colors ${
                    s <= step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </CardHeader>

        {step === 1 && (
          <RegistrationStepPin
            onVerified={(orgId, orgName) => {
              setOrganizationId(orgId);
              setOrganizationName(orgName);
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <RegistrationStepAccount
            organizationName={organizationName}
            initialData={accountData || undefined}
            onNext={(data) => {
              setAccountData(data);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <RegistrationStepCertificates
            onComplete={handleFinalSubmit}
            onBack={() => setStep(2)}
            isSubmitting={isSubmitting}
            organizationId={organizationId}
          />
        )}

        {step === 4 && <RegistrationStepComplete />}
      </Card>
    </div>
  );
}
