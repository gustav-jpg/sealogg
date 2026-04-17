import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getAppVersion, compareSemver } from '@/lib/app-version';
import { isNativePlatform, getPlatform } from '@/lib/capacitor';
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

const DEFAULT_IOS_URL = 'https://apps.apple.com/se/app/sealogg/id6753391916';
const DEFAULT_ANDROID_URL = 'https://play.google.com/store/apps/details?id=app.lovable.ca12acbb7d5746d89d77109ee6b9dc68';

export function AppUpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [storeUrl, setStoreUrl] = useState<string>(DEFAULT_IOS_URL);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [requiredVersion, setRequiredVersion] = useState<string>('');

  useEffect(() => {
    if (!isNativePlatform()) return;

    const checkVersion = async () => {
      try {
        const version = await getAppVersion();
        setCurrentVersion(version);

        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['min_app_version', 'force_update', 'ios_app_store_url', 'android_app_store_url']);

        if (error) {
          console.warn('[AppUpdate] DB error:', error);
          return;
        }
        if (!data) return;

        const minVersion = data.find(r => r.key === 'min_app_version')?.value;
        const force = data.find(r => r.key === 'force_update')?.value === 'true';
        const platform = getPlatform();
        const iosUrl = data.find(r => r.key === 'ios_app_store_url')?.value || DEFAULT_IOS_URL;
        const androidUrl = data.find(r => r.key === 'android_app_store_url')?.value || DEFAULT_ANDROID_URL;
        setStoreUrl(platform === 'android' ? androidUrl : iosUrl);

        console.log('[AppUpdate] Current:', version, 'Required:', minVersion, 'Force:', force);

        if (minVersion && compareSemver(version, minVersion) < 0) {
          setRequiredVersion(minVersion);
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
    window.open(storeUrl, '_blank');
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
              ? `En ny version av SeaLogg krävs för att fortsätta använda appen. Du har version ${currentVersion}, version ${requiredVersion} krävs. Vänligen uppdatera via App Store.`
              : `En ny version av SeaLogg finns tillgänglig (${requiredVersion}). Du kör version ${currentVersion}. Vi rekommenderar att du uppdaterar.`}
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
