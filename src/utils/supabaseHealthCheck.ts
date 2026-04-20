import { supabase } from '../lib/supabase';
import { formatSupabaseError } from './error';

export interface HealthCheckResult {
  isOnline: boolean;
  url: string;
  status: string;
  details: string;
  timestamp: string;
}

/**
 * Test basic connectivity to Supabase
 */
export async function testSupabaseConnection(): Promise<HealthCheckResult> {
  const url = 'https://oqqzrppoqgnrinavvolz.supabase.co';
  const timestamp = new Date().toISOString();

  try {
    // Try to reach the Supabase URL
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors', // Avoid CORS issues for basic connectivity
    });

    return {
      isOnline: true,
      url,
      status: 'online',
      details: `Server responded with status ${response.status || 'unknown'}`,
      timestamp,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isNetworkError = error?.name === 'TypeError' && /failed to fetch/i.test(errorMsg);

    return {
      isOnline: false,
      url,
      status: isNetworkError ? 'network_error' : 'unreachable',
      details: isNetworkError
        ? 'Network error - check if Supabase URL is correct and accessible. This could be: (1) Invalid URL, (2) CORS issue, (3) Network connectivity problem, (4) Supabase service down'
        : `Connection failed: ${errorMsg}`,
      timestamp,
    };
  }
}

/**
 * Test if Supabase client can perform a basic query
 */
export async function testSupabaseQuery(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();

  try {
    // Try a simple query to test client functionality
    const result = await supabase
      .from('chitoor_project_approvals')
      .select('id')
      .limit(1);

    if (result?.error) {
      return {
        isOnline: false,
        url: 'supabase_query',
        status: 'query_error',
        details: `Query error: ${formatSupabaseError(result.error)}`,
        timestamp,
      };
    }

    return {
      isOnline: true,
      url: 'supabase_query',
      status: 'query_success',
      details: 'Supabase query successful',
      timestamp,
    };
  } catch (error: any) {
    const errorMsg = formatSupabaseError(error);

    return {
      isOnline: false,
      url: 'supabase_query',
      status: 'query_error',
      details: `Query failed: ${errorMsg}`,
      timestamp,
    };
  }
}

/**
 * Perform full diagnostics on Supabase connectivity
 */
export async function performSupabaseDiagnostics(): Promise<{
  connectionTest: HealthCheckResult;
  queryTest: HealthCheckResult;
  summary: string;
}> {
  const connectionTest = await testSupabaseConnection();
  const queryTest = await testSupabaseQuery();

  let summary = '';
  if (!connectionTest.isOnline) {
    summary = `Unable to reach Supabase at ${connectionTest.url}. ${connectionTest.details}`;
  } else if (!queryTest.isOnline) {
    summary = `Supabase is reachable but queries are failing. ${queryTest.details}`;
  } else {
    summary = 'Supabase is fully operational';
  }

  return {
    connectionTest,
    queryTest,
    summary,
  };
}
