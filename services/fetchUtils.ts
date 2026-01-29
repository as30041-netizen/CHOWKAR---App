import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const DEFAULT_TIMEOUT_MS = 15000;

// Singleton promise for session refresh to prevent "thundering herd" (multiple parallel refreshes)
let refreshPromise: Promise<any> | null = null;

export interface SafeFetchOptions extends RequestInit {
    timeout?: number;
}

/**
 * Standardized fetch wrapper with automatic timeout and error handling.
 * Automatically adds authorization headers if a session exists.
 */
export const safeFetch = async (
    url: string,
    options: SafeFetchOptions = {}
): Promise<Response> => {
    const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            if (attempt > 0) {
                const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
                logger.log(`[safeFetch] Retry attempt ${attempt} for ${url} after ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
            }

            // Inject Auth Header if not present
            if (!fetchOptions.headers) {
                fetchOptions.headers = {};
            }

            // Check if we need to add auth
            const hasAuthHeader = Object.keys(fetchOptions.headers).some(k => k.toLowerCase() === 'authorization');
            if (!hasAuthHeader) {
                const { getCachedAccessToken, getAccessToken } = await import('../lib/supabase');
                let token = getCachedAccessToken();

                if (!token) {
                    token = (await getAccessToken()) || null;
                }

                const finalToken = token || import.meta.env.VITE_SUPABASE_ANON_KEY;
                (fetchOptions.headers as any)['Authorization'] = `Bearer ${finalToken}`;
                (fetchOptions.headers as any)['apikey'] = import.meta.env.VITE_SUPABASE_ANON_KEY;
            }

            let response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });

            // RETRY LOGIC FOR 401 (Expired Token) - This should only happen once per attempt
            if (response.status === 401) {
                logger.warn(`[safeFetch] 401 Unauthorized for ${url}. Attempting unified session refresh...`);

                // 1. Singleton refresh logic: Only one request refreshes the session
                if (!refreshPromise) {
                    refreshPromise = (async () => {
                        try {
                            const refreshCall = supabase.auth.refreshSession();
                            const refreshTimeout = new Promise<{ data: { session: null }; error: { message: string } }>((resolve) =>
                                setTimeout(() => resolve({ data: { session: null }, error: { message: 'Refresh timed out' } }), 8000)
                            );

                            const result = await Promise.race([refreshCall, refreshTimeout]) as any;
                            if (result.error) throw result.error;
                            return result.data.session;
                        } finally {
                            refreshPromise = null;
                        }
                    })();
                }

                try {
                    const session = await refreshPromise;

                    if (session?.access_token) {
                        logger.log('[safeFetch] Session refreshed successfully. Retrying request...');
                        (fetchOptions.headers as any)['Authorization'] = `Bearer ${session.access_token}`;

                        const retryController = new AbortController();
                        const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);

                        try {
                            response = await fetch(url, {
                                ...fetchOptions,
                                signal: retryController.signal,
                            });
                        } finally {
                            clearTimeout(retryTimeoutId);
                        }
                    }
                } catch (error) {
                    logger.error('[safeFetch] Unified refresh failed:', error);
                }
            }

            // If we have a successful response or a non-retriable error (like 400), return it
            if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 401)) {
                return response;
            }

            // If it's a 5xx error, we might want to retry
            if (response.status >= 500 && attempt < maxRetries) {
                logger.warn(`[safeFetch] Server error ${response.status} for ${url}. Retrying...`);
                lastError = new Error(`Server error: ${response.status}`);
                continue;
            }

            return response;

        } catch (error: any) {
            lastError = error;
            const isNetworkError = error.name === 'TypeError' || error.message.includes('fetch');
            const isTimeout = error.name === 'AbortError';

            if ((isNetworkError || isTimeout) && attempt < maxRetries) {
                logger.warn(`[safeFetch] Network error or timeout on attempt ${attempt} for ${url}: ${error.message}. Retrying...`);
                continue;
            }

            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeout}ms. Please check your connection.`);
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw lastError || new Error(`Request failed after ${maxRetries} attempts`);
};

/**
 * Helper to ensure we have a valid session before making calls
 */
export const ensureSession = async (): Promise<string | null> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) return null;
    return session.access_token;
};

/**
 * Safe wrapper for Supabase RPC calls with timeout and automatic token handling.
 */
export const safeRPC = async <T = any>(
    functionName: string,
    params: Record<string, any> = {},
    options: SafeFetchOptions = {}
): Promise<{ data: T | null; error: any }> => {
    try {
        const { timeout = DEFAULT_TIMEOUT_MS } = options;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const rpcUrl = `${supabaseUrl}/rest/v1/rpc/${functionName}`;

        const response = await safeFetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(params),
            timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorJson;
            try { errorJson = JSON.parse(errorText); } catch { errorJson = { message: errorText }; }
            return { data: null, error: errorJson };
        }

        if (response.status === 204) {
            return { data: null, error: null };
        }

        const data = await response.json();
        return { data, error: null };
    } catch (error: any) {
        return { data: null, error };
    }
};
