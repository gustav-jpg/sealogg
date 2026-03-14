import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { isNativePlatform } from '@/lib/capacitor';

const NATIVE_REGISTRATION_TIMEOUT_MS = 12000;

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
      const { Capacitor } = await import('@capacitor/core');

      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        toast.error('Du måste tillåta notifikationer i enhetens inställningar');
        return false;
      }

      await PushNotifications.removeAllListeners();

      const registrationResult = await new Promise<boolean>(async (resolve) => {
        let isResolved = false;

        const resolveOnce = (value: boolean) => {
          if (isResolved) return;
          isResolved = true;
          resolve(value);
        };

        const timeoutId = globalThis.setTimeout(() => {
          console.error('[NativePush] Registration timed out');
          const isSimulator = /simulator/i.test(globalThis.navigator?.userAgent ?? '');

          if (isSimulator) {
            toast.error('Push-notiser fungerar inte i iOS-simulatorn. Testa på fysisk iPhone.');
          } else {
            toast.error('Ingen push-token kom från iOS. Kontrollera AppDelegate-bridge för push.');
          }

          resolveOnce(false);
        }, NATIVE_REGISTRATION_TIMEOUT_MS);

        try {
          await PushNotifications.addListener('registration', async (token) => {
            globalThis.clearTimeout(timeoutId);
            console.log('[NativePush] Device token received');

            const endpoint = `apns://${token.value}`;

            const { error: cleanupError } = await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', user.id)
              .like('endpoint', 'apns://%');

            if (cleanupError) {
              console.warn('[NativePush] Could not cleanup old APNs tokens:', cleanupError);
            }

            const { error } = await supabase
              .from('push_subscriptions')
              .insert({
                user_id: user.id,
                endpoint,
                p256dh: token.value,
                auth: 'native',
                user_agent: `capacitor-${Capacitor.getPlatform()}`,
              });

            const errorCode = (error as { code?: string } | null)?.code;
            const isDuplicate = errorCode === '23505';

            if (error && !isDuplicate) {
              console.error('[NativePush] Error saving token:', error);
              toast.error('Kunde inte spara push-token');
              resolveOnce(false);
              return;
            }

            setIsRegistered(true);
            toast.success('Push-notifikationer aktiverade!');
            resolveOnce(true);
          });

          await PushNotifications.addListener('registrationError', (error) => {
            globalThis.clearTimeout(timeoutId);
            console.error('[NativePush] Registration error:', error);

            const message =
              (error as { errorMessage?: string; message?: string } | null)?.errorMessage ||
              (error as { errorMessage?: string; message?: string } | null)?.message ||
              '';

            if (/capacitorDidRegisterForRemoteNotifications/i.test(message)) {
              toast.error('iOS push-bridge saknas i AppDelegate. Lägg till didRegister/didFail-metoderna.');
            } else {
              toast.error('Kunde inte registrera push-notifikationer');
            }

            resolveOnce(false);
          });

          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[NativePush] Received:', notification);
            toast(notification.title || 'Ny notifikation', {
              description: notification.body,
            });
          });

          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[NativePush] Action performed:', action);
            const url = action.notification.data?.url;
            if (url) {
              window.location.href = url;
            }
          });

          await PushNotifications.register();
        } catch (listenerError) {
          globalThis.clearTimeout(timeoutId);
          console.error('[NativePush] Listener setup error:', listenerError);
          toast.error('Kunde inte starta push-registrering');
          resolveOnce(false);
        }
      });

      return registrationResult;
    } catch (error) {
      console.error('[NativePush] Error:', error);
      toast.error('Kunde inte aktivera push-notifikationer');
      return false;
    } finally {
      setIsLoading(false);
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
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .like('endpoint', 'apns://%');

      if (error) {
        console.error('[NativePush] Registration status check failed:', error);
        setIsRegistered(false);
        return;
      }

      setIsRegistered((count ?? 0) > 0);
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
