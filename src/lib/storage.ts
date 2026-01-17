// Shared helpers for Lovable Cloud storage paths

/**
 * Supabase Storage rejects some characters in object keys.
 * We normalize filenames to a safe ASCII subset.
 */
export function sanitizeStorageFileName(originalName: string): string {
  // Keep extension if present
  const lastDot = originalName.lastIndexOf('.');
  const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const ext = lastDot > 0 ? originalName.slice(lastDot) : '';

  const safeBase = base
    .normalize('NFKD')
    // remove diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // replace whitespace with single dash
    .replace(/\s+/g, '-')
    // remove anything not safe
    .replace(/[^a-zA-Z0-9._-]/g, '')
    // avoid empty
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  const safeExt = ext
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.]/g, '')
    .slice(0, 20);

  return `${safeBase || 'file'}${safeExt}`;
}
