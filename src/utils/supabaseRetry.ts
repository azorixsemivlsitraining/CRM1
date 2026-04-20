/**
 * Wrapper for Supabase queries with automatic retry logic for transient failures
 */

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

function isTransientError(error: any): boolean {
  if (!error) return false;

  // Network errors are transient
  if (error.name === 'TypeError' && /failed to fetch/i.test(error.message)) {
    return true;
  }

  // Timeout errors
  if (/timeout/i.test(String(error))) {
    return true;
  }

  // Some HTTP status codes indicate transient failures
  const status = error.status || error.statusCode;
  if (status === 408 || status === 429 || (status >= 500 && status < 600)) {
    return true;
  }

  return false;
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a Supabase query with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // If not a transient error, fail immediately
      if (!isTransientError(error)) {
        throw error;
      }

      // Don't retry after last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait with exponential backoff
      const actualDelay = Math.min(delay, maxDelayMs);
      console.warn(
        `Supabase query failed (transient), retrying in ${actualDelay}ms (attempt ${attempt + 1}/${maxRetries})`,
        error
      );
      await wait(actualDelay);

      // Increase delay for next retry
      delay *= backoffMultiplier;
    }
  }

  throw lastError;
}

/**
 * Retry helper for common Supabase operations
 */
export async function withRetrySelect<T = any>(
  query: any,
  options?: RetryOptions
): Promise<{ data: T[] | null; error: any }> {
  try {
    return await withRetry(() => query, options);
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Check if a Supabase error is due to network/connectivity issues
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  return isTransientError(error);
}
