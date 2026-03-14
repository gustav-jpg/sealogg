import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { isNativePlatform } from '@/lib/capacitor';

const PUSH_PROMPTED_KEY = 'sealogg-push-prompted';

/**
 * Automatically prompts for push notification permission on first app open
 * and registers the device token. Only runs once per device.
 */
export function AutoPushPrompt() {
  const { user } = useAuth();
  const { register, isRegistered, isLoading } = useNativePushNotifications();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!user || !isNativePlatform() || isLoading || isRegistered || hasTriggered.current) return;

    const alreadyPrompted = localStorage.getItem(`${PUSH_PROMPTED_KEY}-${user.id}`);
    if (alreadyPrompted) return;

    hasTriggered.current = true;

    // Small delay to let the app settle after login
    const timer = setTimeout(async () => {
      localStorage.setItem(`${PUSH_PROMPTED_KEY}-${user.id}`, '1');
      await register();
    }, 1500);

    return () => clearTimeout(timer);
  }, [user, isRegistered, isLoading, register]);

  return null;
}
