import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
let supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
let configLoadPromise: Promise<void> | null = null;

// Load configuration from runtime config file
async function loadConfig() {
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const config = await response.json();
      if (config.supabase?.url) supabaseUrl = config.supabase.url;
      if (config.supabase?.anonKey) supabaseAnonKey = config.supabase.anonKey;
      console.log('Supabase config loaded from runtime config');
    }
  } catch (error) {
    console.warn('Failed to load runtime config, will use environment variables:', error);
  }
}

// Start loading config immediately
if (!configLoadPromise) {
  configLoadPromise = loadConfig();
}

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

let supabaseClient: any = null;

const getSupabaseClient = (): any => {
  if (!supabaseClient) {
    if (supabaseUrl && supabaseAnonKey) {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } else {
      supabaseClient = createUnconfiguredSupabase();
    }
  }
  return supabaseClient;
};

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

// Create a proxy that lazily initializes the client
export const supabase = new Proxy({} as any, {
  get: (_, prop: string | symbol) => {
    const client = getSupabaseClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
}) as unknown as ReturnType<typeof createClient>;

export { loadConfig };
