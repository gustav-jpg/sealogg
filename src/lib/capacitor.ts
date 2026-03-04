import { Capacitor } from '@capacitor/core';

/**
 * Check if we're running inside a native Capacitor app (iOS/Android)
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform: 'ios', 'android', or 'web'
 */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}
