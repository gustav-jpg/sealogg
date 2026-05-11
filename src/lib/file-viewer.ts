import { create } from 'zustand';

export type ViewerFile = {
  url: string;
  fileName?: string;
  /** Optional: 'image' | 'pdf' — auto-detected from url/fileName if omitted */
  kind?: 'image' | 'pdf' | 'other';
};

type State = {
  file: ViewerFile | null;
  open: (file: ViewerFile) => void;
  close: () => void;
};

export const useFileViewer = create<State>((set) => ({
  file: null,
  open: (file) => set({ file }),
  close: () => set({ file: null }),
}));

export function detectKind(url: string, fileName?: string): 'image' | 'pdf' | 'other' {
  const candidate = (fileName || url).toLowerCase().split('?')[0];
  if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(candidate)) return 'image';
  if (/\.pdf$/.test(candidate)) return 'pdf';
  return 'other';
}