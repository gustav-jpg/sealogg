import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { isNativePlatform } from '@/lib/capacitor';

const PUSH_PROMPTED_KEY = 'sealogg-push-prompted';

function isRunningAsNativeApp(): boolean {
  if (isNativePlatform()) return true;
  // Also detect native context via forceHideBadge param or session flag
  if (new URLSearchParams(window.location.search).has('forceHideBadge')) return true;
  if (sessionStorage.getItem('sealogg-native-portal-login') === '1') return true;
  if (window.navigator.userAgent.toLowerCase().includes('capacitor')) return true;
  return false;
}

/**
 * Automatically prompts for push notification permission on first app open
 * and registers the device token. Only runs once per user per device.
 */
export function AutoPushPrompt() {
  const { user } = useAuth();
  const { register, isRegistered, isLoading } = useNativePushNotifications();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!user || !isRunningAsNativeApp() || isLoading || isRegistered || hasTriggered.current) return;

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
