import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, Smartphone, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationPreferences {
  id?: string;
  email_daily_digest: boolean;
  email_expiring_certificates: boolean;
  email_expiring_controls: boolean;
  email_new_deviations: boolean;
  email_new_faults: boolean;
  email_unsigned_logbooks: boolean;
  push_enabled: boolean;
  push_new_deviations: boolean;
  push_new_faults: boolean;
  push_expiring_controls: boolean;
  days_before_warning: number;
}

const defaultPreferences: NotificationPreferences = {
  email_daily_digest: false,
  email_expiring_certificates: true,
  email_expiring_controls: true,
  email_new_deviations: true,
  email_new_faults: true,
  email_unsigned_logbooks: false,
  push_enabled: false,
  push_new_deviations: true,
  push_new_faults: true,
  push_expiring_controls: true,
  days_before_warning: 14
};

export function NotificationSettings() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe, permission } = usePushNotifications();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user || !selectedOrgId) return;

      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .eq('organization_id', selectedOrgId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setPreferences({
            id: data.id,
            email_daily_digest: data.email_daily_digest,
            email_expiring_certificates: data.email_expiring_certificates,
            email_expiring_controls: data.email_expiring_controls,
            email_new_deviations: data.email_new_deviations,
            email_new_faults: data.email_new_faults,
            email_unsigned_logbooks: data.email_unsigned_logbooks,
            push_enabled: data.push_enabled,
            push_new_deviations: data.push_new_deviations,
            push_new_faults: data.push_new_faults,
            push_expiring_controls: data.push_expiring_controls,
            days_before_warning: data.days_before_warning
          });
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user, selectedOrgId]);

  // Save preferences
  const savePreferences = async () => {
    if (!user || !selectedOrgId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          id: preferences.id,
          user_id: user.id,
          organization_id: selectedOrgId,
          ...preferences
        }, {
          onConflict: 'user_id,organization_id'
        });

      if (error) throw error;

      toast.success('Inställningar sparade');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Kunde inte spara inställningar');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle push toggle
  const handlePushToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await subscribe();
      if (success) {
        setPreferences(prev => ({ ...prev, push_enabled: true }));
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        setPreferences(prev => ({ ...prev, push_enabled: false }));
      }
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean | number) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-postnotifikationer
          </CardTitle>
          <CardDescription>
            Välj vilka e-postmeddelanden du vill ta emot
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email_daily_digest" className="flex flex-col">
              <span>Daglig sammanfattning</span>
              <span className="text-sm text-muted-foreground font-normal">
                Få en översikt varje morgon
              </span>
            </Label>
            <Switch
              id="email_daily_digest"
              checked={preferences.email_daily_digest}
              onCheckedChange={(checked) => updatePreference('email_daily_digest', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="email_expiring_certificates" className="flex flex-col">
              <span>Certifikat som går ut</span>
              <span className="text-sm text-muted-foreground font-normal">
                Påminnelse innan certifikat går ut
              </span>
            </Label>
            <Switch
              id="email_expiring_certificates"
              checked={preferences.email_expiring_certificates}
              onCheckedChange={(checked) => updatePreference('email_expiring_certificates', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email_expiring_controls" className="flex flex-col">
              <span>Egenkontroller som förfaller</span>
              <span className="text-sm text-muted-foreground font-normal">
                Påminnelse för schemalagda kontroller
              </span>
            </Label>
            <Switch
              id="email_expiring_controls"
              checked={preferences.email_expiring_controls}
              onCheckedChange={(checked) => updatePreference('email_expiring_controls', checked)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="email_new_deviations" className="flex flex-col">
              <span>Nya avvikelser</span>
              <span className="text-sm text-muted-foreground font-normal">
                När en ny avvikelse rapporteras
              </span>
            </Label>
            <Switch
              id="email_new_deviations"
              checked={preferences.email_new_deviations}
              onCheckedChange={(checked) => updatePreference('email_new_deviations', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email_new_faults" className="flex flex-col">
              <span>Nya felrapporter</span>
              <span className="text-sm text-muted-foreground font-normal">
                När ett nytt fel rapporteras
              </span>
            </Label>
            <Switch
              id="email_new_faults"
              checked={preferences.email_new_faults}
              onCheckedChange={(checked) => updatePreference('email_new_faults', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="email_unsigned_logbooks" className="flex flex-col">
              <span>Osignerade loggböcker</span>
              <span className="text-sm text-muted-foreground font-normal">
                Påminnelse om loggböcker som saknar signatur
              </span>
            </Label>
            <Switch
              id="email_unsigned_logbooks"
              checked={preferences.email_unsigned_logbooks}
              onCheckedChange={(checked) => updatePreference('email_unsigned_logbooks', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push-notifikationer
          </CardTitle>
          <CardDescription>
            Få direkta notifikationer i webbläsaren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <p className="text-sm text-muted-foreground">
              Push-notifikationer stöds inte i din webbläsare.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="push_enabled" className="flex flex-col">
                  <span>Aktivera push-notifikationer</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    {permission === 'denied' 
                      ? 'Du har blockerat notifikationer i webbläsaren'
                      : isSubscribed 
                        ? 'Push-notifikationer är aktiverade'
                        : 'Tillåt notifikationer för att aktivera'}
                  </span>
                </Label>
                <Switch
                  id="push_enabled"
                  checked={isSubscribed}
                  onCheckedChange={handlePushToggle}
                  disabled={pushLoading || permission === 'denied'}
                />
              </div>

              {isSubscribed && (
                <>
                  <Separator />

                  <div className="flex items-center justify-between">
                    <Label htmlFor="push_new_deviations" className="flex flex-col">
                      <span>Nya avvikelser</span>
                    </Label>
                    <Switch
                      id="push_new_deviations"
                      checked={preferences.push_new_deviations}
                      onCheckedChange={(checked) => updatePreference('push_new_deviations', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="push_new_faults" className="flex flex-col">
                      <span>Nya felrapporter</span>
                    </Label>
                    <Switch
                      id="push_new_faults"
                      checked={preferences.push_new_faults}
                      onCheckedChange={(checked) => updatePreference('push_new_faults', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="push_expiring_controls" className="flex flex-col">
                      <span>Förfallande egenkontroller</span>
                    </Label>
                    <Switch
                      id="push_expiring_controls"
                      checked={preferences.push_expiring_controls}
                      onCheckedChange={(checked) => updatePreference('push_expiring_controls', checked)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Allmänna inställningar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="days_before_warning" className="flex flex-col">
              <span>Dagar innan varning</span>
              <span className="text-sm text-muted-foreground font-normal">
                Hur många dagar i förväg ska påminnelser skickas
              </span>
            </Label>
            <Input
              id="days_before_warning"
              type="number"
              min={1}
              max={90}
              value={preferences.days_before_warning}
              onChange={(e) => updatePreference('days_before_warning', parseInt(e.target.value) || 14)}
              className="w-20"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={savePreferences} disabled={isSaving} className="w-full">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sparar...
          </>
        ) : (
          'Spara inställningar'
        )}
      </Button>
    </div>
  );
}
