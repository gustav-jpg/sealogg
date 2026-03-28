import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  organizationName: string;
  initialData?: { fullName: string; email: string; password: string };
  onNext: (data: { fullName: string; email: string; password: string }) => void;
  onBack: () => void;
}

export function RegistrationStepAccount({ organizationName, initialData, onNext, onBack }: Props) {
  const [fullName, setFullName] = useState(initialData?.fullName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(initialData?.password || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte.');
      return;
    }

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.');
      return;
    }

    onNext({ fullName, email, password });
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

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <Button type="submit" className="w-full">
          Fortsätt
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
      </CardFooter>
    </form>
  );
}
