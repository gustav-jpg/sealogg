import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isNativePlatform } from '@/lib/capacitor';

/**
 * Hook for native push notifications via APNs/FCM (Capacitor).
 * Falls back to Web Push on web.
 */
export function useNativePushNotifications() {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const register = useCallback(async () => {
    if (!user || !isNativePlatform()) return false;
    setIsLoading(true);

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        toast.error('Du måste tillåta notifikationer i enhetens inställningar');
        setIsLoading(false);
        return false;
      }

      // Set up listeners BEFORE calling register() to avoid missing the event
      await PushNotifications.removeAllListeners();

      const registrationResult = await new Promise<boolean>(async (resolve) => {
        let isResolved = false;
        const resolveOnce = (value: boolean) => {
          if (isResolved) return;
          isResolved = true;
          resolve(value);
        };

        const timeoutId = window.setTimeout(() => {
          console.error('[NativePush] Registration timed out');
          toast.error('Registrering av push-notifikationer tog för lång tid');
          resolveOnce(false);
        }, 15000);

        try {
          // Listen for registration token
          await PushNotifications.addListener('registration', async (token) => {
            console.log('[NativePush] Device token:', token.value);

            const { error } = await supabase
              .from('push_subscriptions')
              .upsert({
                user_id: user.id,
                endpoint: `apns://${token.value}`,
                p256dh: token.value,
                auth: 'native',
                user_agent: `capacitor-${(await import('@capacitor/core')).Capacitor.getPlatform()}`
              }, {
                onConflict: 'user_id,endpoint'
              });

            window.clearTimeout(timeoutId);

            if (error) {
              console.error('[NativePush] Error saving token:', error);
              toast.error('Kunde inte spara push-token');
              resolveOnce(false);
            } else {
              setIsRegistered(true);
              toast.success('Push-notifikationer aktiverade!');
              resolveOnce(true);
            }
          });

          // Listen for registration errors
          await PushNotifications.addListener('registrationError', (error) => {
            window.clearTimeout(timeoutId);
            console.error('[NativePush] Registration error:', error);
            toast.error('Kunde inte registrera push-notifikationer');
            resolveOnce(false);
          });

          // Listen for incoming notifications while app is in foreground
          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[NativePush] Received:', notification);
            toast(notification.title || 'Ny notifikation', {
              description: notification.body,
            });
          });

          // Listen for notification taps (app opened from notification)
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[NativePush] Action performed:', action);
            const url = action.notification.data?.url;
            if (url) {
              window.location.href = url;
            }
          });

          // Now register with APNs/FCM
          await PushNotifications.register();
        } catch (listenerError) {
          window.clearTimeout(timeoutId);
          console.error('[NativePush] Listener setup error:', listenerError);
          resolveOnce(false);
        }
      });

      setIsLoading(false);
      return registrationResult;
    } catch (error) {
      console.error('[NativePush] Error:', error);
      toast.error('Kunde inte aktivera push-notifikationer');
      setIsLoading(false);
      return false;
    }
  }, [user]);

  const unregister = useCallback(async () => {
    if (!user || !isNativePlatform()) return false;
    setIsLoading(true);

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();

      // Remove native subscriptions from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .like('endpoint', 'apns://%');

      setIsRegistered(false);
      toast.success('Push-notifikationer avaktiverade');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('[NativePush] Unregister error:', error);
      setIsLoading(false);
      return false;
    }
  }, [user]);

  // Check if already registered
  useEffect(() => {
    if (!user || !isNativePlatform()) return;

    const checkRegistration = async () => {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .like('endpoint', 'apns://%')
        .maybeSingle();

      setIsRegistered(!!data);
    };

    checkRegistration();
  }, [user]);

  return {
    isNative: isNativePlatform(),
    isRegistered,
    isLoading,
    register,
    unregister,
  };
}
