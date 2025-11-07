export function formatSupabaseError(error: any) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) {
    // If it's a network TypeError from fetch, give clearer guidance
    if (error.name === 'TypeError' && /failed to fetch/i.test(error.message)) {
      return 'Network error: Failed to fetch. Check Supabase URL, CORS settings, or connectivity.';
    }
    return error.message;
  }

  const e = error as any;

  // If it's an object with message-like fields, return first useful one
  const candidates = [e.message, e.msg, e.error, e.description, e.details, e.hint, e.code, e.statusText];
  for (const c of candidates) {
    if (c && typeof c === 'string') {
      // If it's a TypeError message inside, give network guidance
      if (/TypeError/i.test(c) && /failed to fetch/i.test(c)) {
        return 'Network error: Failed to fetch. Check Supabase URL, CORS settings, or connectivity.';
      }
      return c;
    }
    if (c != null) {
      try {
        return JSON.stringify(c);
      } catch {}
    }
  }

  // Safe stringify avoiding circular refs
  const safeStringify = (obj: any) => {
    try {
      const seen = new WeakSet();
      return JSON.stringify(obj, (_k, v) => {
        if (v && typeof v === 'object') {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
        }
        return v;
      }, 2);
    } catch {
      try {
        return String(obj);
      } catch {
        return '[unstringifiable error]';
      }
    }
  };

  try {
    const json = safeStringify(e);
    if (json && json !== '{}' && json !== 'null') return json;
  } catch {}

  // Fallback: build a readable string from enumerable properties
  try {
    const parts = Object.entries(e).map(([k, v]) => {
      try {
        return `${k}: ${typeof v === 'string' ? v : safeStringify(v)}`;
      } catch {
        return `${k}: ${String(v)}`;
      }
    });
    if (parts.length) return parts.join('; ');
  } catch {}

  // Last resort
  try {
    return String(e);
  } catch {
    return 'Unknown error (unstringifiable)';
  }
}
