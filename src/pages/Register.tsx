import { useState } from 'react';
import { Waves } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RegistrationStepPin } from '@/components/registration/RegistrationStepPin';
import { RegistrationStepAccount } from '@/components/registration/RegistrationStepAccount';
import { RegistrationStepCertificates } from '@/components/registration/RegistrationStepCertificates';
import { RegistrationStepComplete } from '@/components/registration/RegistrationStepComplete';

export default function Register() {
  const [step, setStep] = useState(1);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [registrationId, setRegistrationId] = useState('');

  const stepDescriptions: Record<number, string> = {
    1: 'Ange din organisationskod för att börja',
    2: 'Fyll i dina uppgifter',
    3: 'Ladda upp dina certifikat',
    4: 'Registrering slutförd',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background maritime-gradient-subtle p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full maritime-gradient">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
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
            organizationId={organizationId}
            organizationName={organizationName}
            onAccountCreated={(regId) => {
              setRegistrationId(regId);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <RegistrationStepCertificates
            registrationId={registrationId}
            onComplete={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && <RegistrationStepComplete />}
      </Card>
    </div>
  );
}
