export function formatSupabaseError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  // Supabase v2 errors often include: message, code, details, hint
  const e = error as any;
  if (e?.message) return e.message as string;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
