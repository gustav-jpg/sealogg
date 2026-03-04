import { useCallback } from 'react';
import { isNativePlatform } from '@/lib/capacitor';

/**
 * Hook for native haptic feedback.
 * Falls back to no-op on web.
 */
export function useHaptics() {
  const impact = useCallback(async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!isNativePlatform()) return;
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const styleMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: styleMap[style] });
    } catch (e) {
      // Haptics not available
    }
  }, []);

  const notification = useCallback(async (type: 'success' | 'warning' | 'error' = 'success') => {
    if (!isNativePlatform()) return;
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      await Haptics.notification({ type: typeMap[type] });
    } catch (e) {
      // Haptics not available
    }
  }, []);

  const selectionClick = useCallback(async () => {
    if (!isNativePlatform()) return;
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.selectionChanged();
    } catch (e) {
      // Haptics not available
    }
  }, []);

  return { impact, notification, selectionClick };
}
