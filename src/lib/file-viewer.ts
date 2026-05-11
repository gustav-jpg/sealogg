import { useSyncExternalStore } from 'react';

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

export function openFileViewer(file: ViewerFile) {
  current = file;
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