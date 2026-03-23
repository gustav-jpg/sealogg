import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION, compareSemver } from '@/lib/app-version';
import { isNativePlatform } from '@/lib/capacitor';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Download } from 'lucide-react';

export function AppUpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only check on native platforms
    if (!isNativePlatform()) return;

    const checkVersion = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['min_app_version', 'force_update']);

        if (!data) return;

        const minVersion = data.find(r => r.key === 'min_app_version')?.value;
        const force = data.find(r => r.key === 'force_update')?.value === 'true';

        if (minVersion && compareSemver(APP_VERSION, minVersion) < 0) {
          setNeedsUpdate(true);
          setForceUpdate(force);
        }
      } catch (e) {
        console.warn('[AppUpdate] Failed to check version:', e);
      }
    };

    checkVersion();
  }, []);

  if (!needsUpdate || dismissed) return null;

  const handleOpenStore = () => {
    // iOS App Store link — update with your actual App Store ID when available
    window.open('https://apps.apple.com/app/sealogg/id0000000000', '_blank');
  };

  return (
    <AlertDialog open={needsUpdate && !dismissed}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Ny version tillgänglig
          </AlertDialogTitle>
          <AlertDialogDescription>
            {forceUpdate
              ? 'En ny version av SeaLogg krävs för att fortsätta använda appen. Vänligen uppdatera via App Store.'
              : 'En ny version av SeaLogg finns tillgänglig med förbättringar och buggfixar. Vi rekommenderar att du uppdaterar.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <AlertDialogAction onClick={handleOpenStore}>
            Uppdatera nu
          </AlertDialogAction>
          {!forceUpdate && (
            <AlertDialogAction
              className="border border-input bg-background text-foreground hover:bg-accent"
              onClick={() => setDismissed(true)}
            >
              Senare
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
