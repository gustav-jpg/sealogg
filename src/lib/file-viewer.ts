import { useSyncExternalStore } from 'react';
import { Browser } from '@capacitor/browser';
import { isNativePlatform } from '@/lib/capacitor';

export type ViewerFile = {
  url: string;
  fileName?: string;
  /** Optional: 'image' | 'pdf' — auto-detected from url/fileName if omitted */
  kind?: 'image' | 'pdf' | 'other';
};

let current: ViewerFile | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function openFileViewer(file: ViewerFile) {
  const kind = file.kind ?? detectKind(file.url, file.fileName);

  // On native iOS/Android, PDFs render badly inside a WKWebView iframe
  // (zoomed in, no controls). Use the in-app system browser
  // (SFSafariViewController on iOS) which handles PDFs properly.
  if (isNativePlatform() && kind === 'pdf') {
    try {
      await Browser.open({ url: file.url, presentationStyle: 'fullscreen' });
      return;
    } catch (err) {
      console.warn('Browser.open failed, falling back to in-app viewer', err);
    }
  }

  current = { ...file, kind };
  emit();
}

export function closeFileViewer() {
  current = null;
  emit();
}

export function useFileViewer(): ViewerFile | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

export function detectKind(url: string, fileName?: string): 'image' | 'pdf' | 'other' {
  const candidate = (fileName || url).toLowerCase().split('?')[0];
  if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(candidate)) return 'image';
  if (/\.pdf$/.test(candidate)) return 'pdf';
  return 'other';
}