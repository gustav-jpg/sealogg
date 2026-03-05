/**
 * Backup/restore Supabase auth session using Capacitor Preferences (native storage).
 * This prevents logout when iOS clears WebView localStorage.
 */
import { isNativePlatform } from '@/lib/capacitor';

const SESSION_KEY = 'supabase-auth-session-backup';

async function getPreferences() {
  if (!isNativePlatform()) return null;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    return Preferences;
  } catch {
    return null;
  }
}

export async function backupSession(session: { access_token: string; refresh_token: string }) {
  const Preferences = await getPreferences();
  if (!Preferences) return;
  
  await Preferences.set({
    key: SESSION_KEY,
    value: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  });
}

export async function getBackupSession(): Promise<{ access_token: string; refresh_token: string } | null> {
  const Preferences = await getPreferences();
  if (!Preferences) return null;
  
  const { value } = await Preferences.get({ key: SESSION_KEY });
  if (!value) return null;
  
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function clearBackupSession() {
  const Preferences = await getPreferences();
  if (!Preferences) return;
  
  await Preferences.remove({ key: SESSION_KEY });
}
