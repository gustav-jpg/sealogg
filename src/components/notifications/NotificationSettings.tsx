import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Smartphone, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type DigestFrequency = 'daily' | 'weekly';

interface NotificationPreferences {
  id?: string;
  email_daily_digest: boolean;
  digest_frequency: DigestFrequency;
  email_expiring_certificates: boolean;
  email_expiring_controls: boolean;
  email_new_deviations: boolean;
  email_new_faults: boolean;
  email_unsigned_logbooks: boolean;
  email_fault_comment: boolean;
  email_fault_assigned: boolean;
  push_enabled: boolean;
  push_new_deviations: boolean;
  push_new_faults: boolean;
  push_expiring_controls: boolean;
  push_fault_comment: boolean;
  push_fault_assigned: boolean;
  days_before_warning: number;
}

const defaultPreferences: NotificationPreferences = {
  email_daily_digest: false,
  digest_frequency: 'daily',
  email_expiring_certificates: true,
  email_expiring_controls: true,
  email_new_deviations: true,
  email_new_faults: true,
  email_unsigned_logbooks: false,
  email_fault_comment: true,
  email_fault_assigned: true,
  push_enabled: true,
  push_new_deviations: true,
  push_new_faults: true,
  push_expiring_controls: true,
  push_fault_comment: true,
  push_fault_assigned: true,
  days_before_warning: 14,
};

/** A single notification row with Mail + Push toggles */
function NotificationRow({
  label,
  description,
  emailKey,
  pushKey,
  preferences,
  onUpdate,
  pushAvailable,
}: {
  label: string;
  description?: string;
  emailKey?: keyof NotificationPreferences;
  pushKey?: keyof NotificationPreferences;
  preferences: NotificationPreferences;
  onUpdate: (key: keyof NotificationPreferences, value: boolean) => void;
  pushAvailable: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {emailKey && (
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch
              checked={preferences[emailKey] as boolean}
              onCheckedChange={(checked) => onUpdate(emailKey, checked)}
            />
          </div>
        )}
        {pushKey && (
          <div className="flex items-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch
              checked={pushAvailable ? (preferences[pushKey] as boolean) : false}
              onCheckedChange={(checked) => onUpdate(pushKey, checked)}
              disabled={!pushAvailable}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const { user, isAdmin } = useAuth();
  const { selectedOrgId } = useOrganization();
  const webPush = usePushNotifications();
  const nativePush = useNativePushNotifications();

  const isNative = nativePush.isNative;
  const isSupported = isNative || webPush.isSupported;
  const isSubscribed = isNative ? nativePush.isRegistered : webPush.isSubscribed;
  const pushLoading = isNative ? nativePush.isLoading : webPush.isLoading;
  const permission = isNative ? 'default' : webPush.permission;

  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [optimisticPushEnabled, setOptimisticPushEnabled] = useState<boolean | null>(null);

  const effectivePushEnabled = optimisticPushEnabled ?? isSubscribed;
  const pushAvailable = effectivePushEnabled && isSubscribed;

  const pushStatusText = permission === 'denied'
    ? 'Du har blockerat notifikationer i webbläsaren'
    : pushLoading && optimisticPushEnabled === true
      ? 'Aktiverar...'
      : pushLoading && optimisticPushEnabled === false
        ? 'Avaktiverar...'
        : effectivePushEnabled
          ? 'Aktiverat'
          : 'Avaktiverat';

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
            digest_frequency: (data.digest_frequency as DigestFrequency) || 'daily',
            email_expiring_certificates: data.email_expiring_certificates,
            email_expiring_controls: data.email_expiring_controls,
            email_new_deviations: data.email_new_deviations,
            email_new_faults: data.email_new_faults,
            email_unsigned_logbooks: data.email_unsigned_logbooks,
            email_fault_comment: data.email_fault_comment ?? true,
            email_fault_assigned: data.email_fault_assigned ?? true,
            push_enabled: data.push_enabled,
            push_new_deviations: data.push_new_deviations,
            push_new_faults: data.push_new_faults,
            push_expiring_controls: data.push_expiring_controls,
            push_fault_comment: data.push_fault_comment ?? true,
            push_fault_assigned: data.push_fault_assigned ?? true,
            days_before_warning: data.days_before_warning,
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

  useEffect(() => {
    setOptimisticPushEnabled(null);
  }, [isSubscribed]);

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
          ...preferences,
        }, { onConflict: 'user_id,organization_id' });

      if (error) throw error;
      toast.success('Inställningar sparade');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Kunde inte spara inställningar');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    setOptimisticPushEnabled(enabled);
    if (enabled) {
      const success = isNative ? await nativePush.register() : await webPush.subscribe();
      if (success) {
        setPreferences(prev => ({ ...prev, push_enabled: true }));
      } else {
        setOptimisticPushEnabled(false);
      }
    } else {
      const success = isNative ? await nativePush.unregister() : await webPush.unsubscribe();
      if (success) {
        setPreferences(prev => ({ ...prev, push_enabled: false }));
      } else {
        setOptimisticPushEnabled(true);
      }
    }
  };

  const updatePreference = (key: keyof NotificationPreferences, value: boolean | number | string) => {
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
      {/* Push master toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Push-notifikationer
          </CardTitle>
          <CardDescription>
            {isSupported ? pushStatusText : 'Push-notifikationer stöds inte i din webbläsare.'}
          </CardDescription>
        </CardHeader>
        {isSupported && (
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="push_enabled" className="flex flex-col">
                <span>Aktivera push-notifikationer</span>
              </Label>
              <Switch
                id="push_enabled"
                checked={effectivePushEnabled}
                onCheckedChange={handlePushToggle}
                disabled={pushLoading || permission === 'denied'}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Notification categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifikationstyper
          </CardTitle>
          <CardDescription>
            Välj vilka notifikationer du vill ta emot via e-post och/eller push
          </CardDescription>
          {/* Legend */}
          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span>E-post</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Push</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Admin-only section */}
          {isAdmin && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1">Administration</p>

              {/* Digest - email only */}
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">Sammanfattning</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Översikt med certifikat, kontroller, avvikelser och fel
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch
                      checked={preferences.email_daily_digest}
                      onCheckedChange={(checked) => updatePreference('email_daily_digest', checked)}
                    />
                  </div>
                  {/* No push for digest */}
                  <div className="w-[52px]" />
                </div>
              </div>

              {preferences.email_daily_digest && (
                <div className="pl-4 border-l-2 border-muted pb-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Frekvens</Label>
                    <Select
                      value={preferences.digest_frequency}
                      onValueChange={(value) => updatePreference('digest_frequency', value)}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Dagligen</SelectItem>
                        <SelectItem value="weekly">Veckovis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <NotificationRow
                label="Nya avvikelser"
                description="När en ny avvikelse rapporteras"
                emailKey="email_new_deviations"
                pushKey="push_new_deviations"
                preferences={preferences}
                onUpdate={updatePreference}
                pushAvailable={pushAvailable}
              />

              <NotificationRow
                label="Nya felrapporter"
                description="När ett nytt fel rapporteras"
                emailKey="email_new_faults"
                pushKey="push_new_faults"
                preferences={preferences}
                onUpdate={updatePreference}
                pushAvailable={pushAvailable}
              />

              <Separator className="my-2" />
            </>
          )}

          {/* Shared section - all roles */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 pt-1">Felärenden</p>

          <NotificationRow
            label="Ny kommentar / taggning"
            description="När någon kommenterar eller taggar dig i ett felärende"
            emailKey="email_fault_comment"
            pushKey="push_fault_comment"
            preferences={preferences}
            onUpdate={updatePreference}
            pushAvailable={pushAvailable}
          />

          <NotificationRow
            label="Tilldelad ansvarig"
            description="När du blir tilldelad ansvarig på ett felärende"
            emailKey="email_fault_assigned"
            pushKey="push_fault_assigned"
            preferences={preferences}
            onUpdate={updatePreference}
            pushAvailable={pushAvailable}
          />
        </CardContent>
      </Card>

      {/* General settings - admin only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allmänna inställningar</CardTitle>
          </CardHeader>
          <CardContent>
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
      )}

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
