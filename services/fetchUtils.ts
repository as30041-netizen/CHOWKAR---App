
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const DEFAULT_TIMEOUT_MS = 10000;

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        // Inject Auth Header if not present
        if (!fetchOptions.headers) {
            fetchOptions.headers = {};
        }

        // Check if we need to add auth
        const hasAuthHeader = Object.keys(fetchOptions.headers).some(k => k.toLowerCase() === 'authorization');
        if (!hasAuthHeader) {
            // PERFORMANCE FIX: Use cached token first, but fall back to async fetch if missing
            // This ensures we don't use ANON key when we actually have a session (e.g. on first load)
            const { getCachedAccessToken, getAccessToken } = await import('../lib/supabase');
            let token = getCachedAccessToken();

            if (!token) {
                // If memory cache is empty, try async fetch (localStorage -> getSession)
                token = (await getAccessToken()) || null;
            }

            // Fallback to ANON key ONLY if token is explicitly null (i.e., truly unauthenticated)
            // But if we are calling an authenticated endpoint, this might still fail.
            // For now, consistent behavior: use token if exists, else Anon Key.
            const finalToken = token || import.meta.env.VITE_SUPABASE_ANON_KEY;

            // Cast to any to allow indexed access since HeadersInit is strict
            (fetchOptions.headers as any)['Authorization'] = `Bearer ${finalToken}`;
            (fetchOptions.headers as any)['apikey'] = import.meta.env.VITE_SUPABASE_ANON_KEY;
        }

        let response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });

        // RETRY LOGIC FOR 401 (Expired Token)
        if (response.status === 401) {
            logger.warn('[safeFetch] 401 Unauthorized detected. Attempting to refresh session and retry...');

            // 1. Invalidate cache
            const { supabase } = await import('../lib/supabase');

            // 2. Force refresh session (with timeout to prevent hang)
            const refreshPromise = supabase.auth.refreshSession();
            const timeoutPromise = new Promise<{ data: { session: null }; error: { message: string } }>((resolve) =>
                setTimeout(() => resolve({ data: { session: null }, error: { message: 'Refresh timed out' } }), 5000)
            );

            const { data: { session }, error } = await Promise.race([refreshPromise, timeoutPromise]) as any;

            if (!error && session?.access_token) {
                logger.log('[safeFetch] Session refreshed successfully. Retrying request...');

                // 3. Update header with new token
                (fetchOptions.headers as any)['Authorization'] = `Bearer ${session.access_token}`;

                // 4. Retry request (resetting abort signal for retry)
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
            } else {
                logger.error('[safeFetch] Failed to refresh session:', error?.message || 'No session returned');

                // CRITICAL FIX: Do NOT clear storage or reload page automatically.
                // This causes "0 Balance" and random logouts on network glitches.
                // Just throw the error so the UI can decide whether to show a "Session Expired" modal
                // or let the user manually retry.
                throw new Error('Session expired: ' + (error?.message || 'Refresh failed'));
            }
        }

        return response;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms. Please check your connection.`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
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

        // Construct RPC URL
        const rpcUrl = `${supabaseUrl}/rest/v1/rpc/${functionName}`;

        const response = await safeFetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Prefer': 'return=representation' // Standard Supabase RPC header
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

        // Handle void returns (204 No Content)
        if (response.status === 204) {
            return { data: null, error: null };
        }

        const data = await response.json();
        return { data, error: null };
    } catch (error: any) {
        return { data: null, error };
    }
};
