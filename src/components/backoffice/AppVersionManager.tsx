import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Smartphone, Save } from 'lucide-react';

const KEYS = ['min_app_version', 'force_update', 'ios_app_store_url', 'android_app_store_url'] as const;

export function AppVersionManager() {
  const [minVersion, setMinVersion] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [iosUrl, setIosUrl] = useState('');
  const [androidUrl, setAndroidUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', KEYS as unknown as string[]);
      if (data) {
        setMinVersion(data.find(r => r.key === 'min_app_version')?.value || '');
        setForceUpdate(data.find(r => r.key === 'force_update')?.value === 'true');
        setIosUrl(data.find(r => r.key === 'ios_app_store_url')?.value || '');
        setAndroidUrl(data.find(r => r.key === 'android_app_store_url')?.value || '');
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = [
        { key: 'min_app_version', value: minVersion },
        { key: 'force_update', value: forceUpdate ? 'true' : 'false' },
        { key: 'ios_app_store_url', value: iosUrl },
        { key: 'android_app_store_url', value: androidUrl },
      ];
      const { error } = await supabase
        .from('app_settings')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Version-inställningar sparade');
    } catch (e: any) {
      toast.error('Kunde inte spara: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobilappens version
        </CardTitle>
        <CardDescription>
          Tvinga eller rekommendera användare att uppdatera iOS/Android-appen. Popupen visas bara för
          användare som har en lägre installerad version än värdet nedan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Laddar...</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="min-version">Minimum-version (semver, t.ex. 1.0.2)</Label>
              <Input
                id="min-version"
                value={minVersion}
                onChange={e => setMinVersion(e.target.value)}
                placeholder="1.0.0"
              />
              <p className="text-xs text-muted-foreground">
                Popupen visas bara om installerad version är lägre. Exempel: har användaren 1.0.0 måste
                du sätta 1.0.1 för att trigga popupen.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Tvinga uppdatering</Label>
                <p className="text-xs text-muted-foreground">
                  Om aktiverad kan användaren inte stänga popupen utan att uppdatera.
                </p>
              </div>
              <Switch checked={forceUpdate} onCheckedChange={setForceUpdate} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ios-url">iOS App Store URL</Label>
              <Input
                id="ios-url"
                value={iosUrl}
                onChange={e => setIosUrl(e.target.value)}
                placeholder="https://apps.apple.com/se/app/sealogg/id..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="android-url">Android Play Store URL</Label>
              <Input
                id="android-url"
                value={androidUrl}
                onChange={e => setAndroidUrl(e.target.value)}
                placeholder="https://play.google.com/store/apps/details?id=..."
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Sparar...' : 'Spara inställningar'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
