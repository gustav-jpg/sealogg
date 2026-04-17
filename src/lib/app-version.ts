import { App } from '@capacitor/app';
import { isNativePlatform } from './capacitor';

/**
 * Fallback version used on web or if native API fails.
 * On iOS/Android the REAL version comes from the native build (Info.plist / build.gradle).
 */
export const APP_VERSION_FALLBACK = '1.0.0';

let cachedVersion: string | null = null;

/**
 * Get the current app version. On native platforms this returns the real
 * CFBundleShortVersionString (iOS) or versionName (Android). On web it returns the fallback.
 */
export async function getAppVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  if (!isNativePlatform()) {
    cachedVersion = APP_VERSION_FALLBACK;
    return cachedVersion;
  }

  try {
    const info = await App.getInfo();
    cachedVersion = info.version || APP_VERSION_FALLBACK;
    return cachedVersion;
  } catch (e) {
    console.warn('[app-version] Failed to read native version:', e);
    cachedVersion = APP_VERSION_FALLBACK;
    return cachedVersion;
  }
}

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return -1;
    if (na > nb) return 1;
  }
  return 0;
}
