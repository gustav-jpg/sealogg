import { CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';

export function RegistrationStepComplete() {
  return (
    <>
      <CardContent className="text-center space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-green-600" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Din registrering har skickats! En administratör kommer granska dina uppgifter och certifikat.
          </p>
          <p className="text-sm text-muted-foreground">
            Du får tillgång till systemet när din ansökan har godkänts.
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link to="/portal/login">Gå till inloggning</Link>
        </Button>
      </CardFooter>
    </>
  );
}
