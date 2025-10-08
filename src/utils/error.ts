export function formatSupabaseError(error: any) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;

  const e = error as any;

  // Common Supabase error shapes
  const candidates = [e.message, e.msg, e.error, e.description, e.details, e.hint, e.code, e.statusText];
  for (const c of candidates) {
    if (c && typeof c === 'string') return c;
    if (c != null) {
      try {
        return JSON.stringify(c);
      } catch {}
    }
  }

  // Try to stringify the whole object if it's informative
  try {
    const json = JSON.stringify(e);
    if (json && json !== '{}' && json !== 'null') return json;
  } catch {}

  // Fallback: build a readable string from enumerable properties
  try {
    const parts = Object.entries(e).map(([k, v]) => {
      try {
        return `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
      } catch {
        return `${k}: ${String(v)}`;
      }
    });
    if (parts.length) return parts.join('; ');
  } catch {}

  return String(e);
}
