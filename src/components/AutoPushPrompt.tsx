import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';
import { isNativePlatform } from '@/lib/capacitor';

function isRunningAsNativeApp(): boolean {
  if (isNativePlatform()) return true;
  if (new URLSearchParams(window.location.search).has('forceHideBadge')) return true;
  if (sessionStorage.getItem('sealogg-native-portal-login') === '1') return true;
  if (window.navigator.userAgent.toLowerCase().includes('capacitor')) return true;
  return false;
}

/**
 * Automatically registers for push notifications on every native app start.
 * Always re-registers to ensure the device token is fresh (handles reinstalls,
 * token rotation, etc.). Old tokens are cleaned up by the register function.
 */
export function AutoPushPrompt() {
  const { user } = useAuth();
  const { register, isLoading } = useNativePushNotifications();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!user || !isRunningAsNativeApp() || isLoading || hasTriggered.current) return;

    hasTriggered.current = true;

    const timer = setTimeout(async () => {
      await register();
    }, 1500);

    return () => clearTimeout(timer);
  }, [user, isLoading, register]);

  return null;
}
