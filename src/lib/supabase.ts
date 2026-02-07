import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://oqqzrppoqgnrinavvolz.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xcXpycHBvcWducmluYXZ2b2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMyNTM2ODUsImV4cCI6MjA1ODgyOTY4NX0.O-hdv4Op8-eg6hzBmIaUSKjl0XQdIgH2lilRPahJPrA';

const createUnconfiguredSupabase = () => {
  const error = new Error(
    'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment.'
  );

  const makeQueryBuilder = () => {
    const builder: any = {
      select: async () => ({ data: null, error }),
      insert: async () => ({ data: null, error }),
      update: async () => ({ data: null, error }),
      upsert: async () => ({ data: null, error }),
      delete: async () => ({ data: null, error }),
      single: () => builder,
      maybeSingle: () => builder,
      eq: () => builder,
      neq: () => builder,
      order: () => builder,
      range: () => builder,
      ilike: () => builder,
      like: () => builder,
      limit: () => builder,
      contains: () => builder,
      in: () => builder,
    };
    return builder;
  };

  const mock: any = {
    from: () => makeQueryBuilder(),
    rpc: async () => ({ data: null, error }),
    auth: {
      getSession: async () => ({ data: { session: null }, error }),
      onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: null }, error }),
      signOut: async () => ({ error }),
      updateUser: async () => ({ data: { user: null }, error }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error }),
        download: async () => ({ data: null, error }),
        remove: async () => ({ data: null, error }),
      }),
    },
  };

  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(
      'Supabase environment variables are missing. The app will run in a read-only/demo state until configured.'
    );
  }

  return mock;
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createUnconfiguredSupabase();
