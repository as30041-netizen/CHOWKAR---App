import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Fix for Capacitor: Use native WebSocket implementation
    transport: Capacitor.isNativePlatform() ? undefined : undefined,
  },
  global: {
    headers: {
      'X-Client-Info': `supabase-js-capacitor/${Capacitor.getPlatform()}`,
    },
  },
});

// ============================================================================
// SUPABASE INITIALIZATION TRACKING
// The Supabase client can block queries until auth state is resolved.
// This utility ensures we wait for initialization before making queries.
// ============================================================================

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Supabase client and wait for auth state to be resolved.
 * Call this before making any queries on page load.
 */
export const initSupabase = (): Promise<void> => {
  if (isInitialized) return Promise.resolve();

  if (!initPromise) {
    initPromise = new Promise<void>((resolve) => {
      console.log('[Supabase] Initializing client...');

      // Listen for the first auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[Supabase] Auth state changed: ${event}`);
        if (!isInitialized) {
          isInitialized = true;
          console.log('[Supabase] ✅ Client initialized');
          // Add small delay to ensure query execution is ready
          setTimeout(() => {
            console.log('[Supabase] ✅ Client fully ready for queries');
            resolve();
          }, 100);
        }
      });

      // Also resolve after a timeout to prevent blocking forever
      setTimeout(() => {
        if (!isInitialized) {
          isInitialized = true;
          console.warn('[Supabase:Debug] ⚠️ Initialization timeout (3s), proceeding anyway');
          resolve();
        }
      }, 3000);
    });
  }

  return initPromise;
};

/**
 * Check if Supabase client is initialized
 */
export const isSupabaseReady = () => isInitialized;

/**
 * Utility to wait for Supabase to be ready before running a query
 */
export const waitForSupabase = async <T>(queryFn: () => Promise<T>): Promise<T> => {
  await initSupabase();
  return queryFn();
};

// ============================================================================
// CACHED SESSION MANAGEMENT (Industry Best Practice)
// Avoids calling getSession() multiple times which can cause race conditions
// ============================================================================

let cachedSession: {
  accessToken: string | null;
  userId: string | null;
  lastUpdated: number;
} = { accessToken: null, userId: null, lastUpdated: 0 };

// Keep session cache in sync with auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token) {
    cachedSession = {
      accessToken: session.access_token,
      userId: session.user?.id || null,
      lastUpdated: Date.now()
    };
    console.log('[Supabase] Session cache updated for:', session.user?.email);
  } else if (event === 'SIGNED_OUT') {
    cachedSession = { accessToken: null, userId: null, lastUpdated: Date.now() };
    console.log('[Supabase] Session cache cleared (signed out)');
  }
});

/**
 * Get cached access token - FAST, no async!
 * Falls back to null if no session cached yet.
 * Use this instead of calling getSession() in hot paths.
 */
export const getCachedAccessToken = (): string | null => {
  return cachedSession.accessToken;
};

/**
 * Get cached user ID - FAST, no async!
 */
export const getCachedUserId = (): string | null => {
  return cachedSession.userId;
};

/**
 * Get access token with optional fresh fetch.
 * Will return cached token if available and recent (< 5 min).
 * Falls back to localStorage directly to avoid getSession() hangs.
 */
export const getAccessToken = async (): Promise<string | undefined> => {
  // 1. If memory cache is fresh (< 5 min), use it immediately
  if (cachedSession.accessToken && (Date.now() - cachedSession.lastUpdated < 5 * 60 * 1000)) {
    return cachedSession.accessToken;
  }

  // 2. Try to get from localStorage directly (fastest, most reliable on refresh)
  try {
    const storageKey = 'sb-ghtshhafukyirwkfdype-auth-token';
    const authData = localStorage.getItem(storageKey);
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.access_token) {
        // Update memory cache
        cachedSession = {
          accessToken: parsed.access_token,
          userId: parsed.user?.id || null,
          lastUpdated: Date.now()
        };
        return parsed.access_token;
      }
    }
  } catch (e) {
    console.warn('[Supabase] Failed to parse localStorage session');
  }

  // 3. Last resort: Try getSession() with timeout
  try {
    const tokenPromise = supabase.auth.getSession().then(r => {
      if (r.data.session?.access_token) {
        cachedSession = {
          accessToken: r.data.session.access_token,
          userId: r.data.session.user?.id || null,
          lastUpdated: Date.now()
        };
        return r.data.session.access_token;
      }
      return undefined;
    });
    const timeoutPromise = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 1500));
    return await Promise.race([tokenPromise, timeoutPromise]);
  } catch (e) {
    console.warn('[Supabase] getSession failed');
    return cachedSession.accessToken || undefined;
  }
};

/**
 * SAFE RPC CALLER - Uses REST API directly to avoid Supabase client hanging
 * This is the recommended way to call RPCs after page refresh
 * 
 * DEFENSIVE: If cache is empty (fresh login, race condition), waits briefly for auth init
 */
export const safeRPC = async <T = any>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<{ data: T | null; error: Error | null }> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Get token from cache (fast) or fetch with timeout
  let accessToken = getCachedAccessToken();

  // DEFENSIVE: If cache empty, wait briefly for auth initialization
  if (!accessToken) {
    console.log(`[safeRPC] Cache empty, waiting for auth init...`);
    await new Promise(resolve => setTimeout(resolve, 500));
    accessToken = getCachedAccessToken();
  }

  // Still empty? Try fetching with timeout
  if (!accessToken) {
    accessToken = await getAccessToken() || undefined;
  }

  const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${supabaseKey}`;
  const tokenStatus = accessToken ? 'authenticated' : 'anon';

  console.log(`[safeRPC] Calling ${functionName} (${tokenStatus})...`);

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[safeRPC] ${functionName} failed:`, response.status, errorText);
      return { data: null, error: new Error(errorText || `RPC failed: ${response.status}`) };
    }

    // Handle 204 No Content for void functions
    if (response.status === 204) {
      console.log(`[safeRPC] ${functionName} success (204 No Content)`);
      return { data: null, error: null };
    }

    const data = await response.json().catch(() => null);
    console.log(`[safeRPC] ${functionName} success`);
    return { data, error: null };
  } catch (e: any) {
    console.error(`[safeRPC] ${functionName} error:`, e);
    return { data: null, error: e };
  }
};

// Debug logging for Capacitor (only in development)
if (Capacitor.isNativePlatform()) {
  logger.log('🔧 [Supabase] Running on native platform:', Capacitor.getPlatform());
  logger.log('🔧 [Supabase] Realtime enabled with Capacitor config');
}

// Database type helpers
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          auth_user_id: string | null;
          location: string;
          latitude: number | null;
          longitude: number | null;
          wallet_balance: number;
          rating: number;
          profile_photo: string | null;
          is_premium: boolean;
          ai_usage_count: number;
          bio: string | null;
          skills: string[];
          experience: string | null;
          jobs_completed: number;
          join_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          auth_user_id?: string | null;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          wallet_balance?: number;
          rating?: number;
          profile_photo?: string | null;
          is_premium?: boolean;
          ai_usage_count?: number;
          bio?: string | null;
          skills?: string[];
          experience?: string | null;
          jobs_completed?: number;
          join_date?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          wallet_balance?: number;
          rating?: number;
          profile_photo?: string | null;
          is_premium?: boolean;
          ai_usage_count?: number;
          bio?: string | null;
          skills?: string[];
          experience?: string | null;
          jobs_completed?: number;
        };
      };
      jobs: {
        Row: {
          id: string;
          poster_id: string;
          poster_name: string;
          poster_phone: string;
          poster_photo: string | null;
          title: string;
          description: string;
          category: string;
          location: string;
          latitude: number | null;
          longitude: number | null;
          job_date: string;
          duration: string;
          budget: number;
          status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id: string | null;
          image: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          poster_id: string;
          poster_name: string;
          poster_phone: string;
          poster_photo?: string | null;
          title: string;
          description: string;
          category: string;
          location: string;
          latitude?: number | null;
          longitude?: number | null;
          job_date: string;
          duration: string;
          budget: number;
          status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id?: string | null;
          image?: string | null;
        };
        Update: {
          poster_name?: string;
          poster_phone?: string;
          poster_photo?: string | null;
          title?: string;
          description?: string;
          category?: string;
          location?: string;
          latitude?: number | null;
          longitude?: number | null;
          job_date?: string;
          duration?: string;
          budget?: number;
          status?: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
          accepted_bid_id?: string | null;
          image?: string | null;
        };
      };
      bids: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          worker_name: string;
          worker_phone: string;
          worker_rating: number;
          worker_location: string;
          worker_latitude: number | null;
          worker_longitude: number | null;
          worker_photo: string | null;
          amount: number;
          message: string;
          status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          worker_id: string;
          worker_name: string;
          worker_phone: string;
          worker_rating: number;
          worker_location: string;
          worker_latitude?: number | null;
          worker_longitude?: number | null;
          worker_photo?: string | null;
          amount: number;
          message: string;
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history?: any;
        };
        Update: {
          amount?: number;
          message?: string;
          status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
          negotiation_history?: any;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: 'CREDIT' | 'DEBIT';
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          type: 'CREDIT' | 'DEBIT';
          description: string;
        };
        Update: {
          amount?: number;
          type?: 'CREDIT' | 'DEBIT';
          description?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read: boolean;
          related_job_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read?: boolean;
          related_job_id?: string | null;
        };
        Update: {
          title?: string;
          message?: string;
          type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
          read?: boolean;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          job_id: string;
          sender_id: string;
          receiver_id: string | null;
          text: string;
          translated_text: string | null;
          is_deleted: boolean;
          read: boolean;
          read_at: string | null;
          media_type: 'voice' | 'image' | 'video' | null;
          media_url: string | null;
          media_duration: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          sender_id: string;
          receiver_id?: string | null;
          text: string;
          translated_text?: string | null;
          is_deleted?: boolean;
          read?: boolean;
          read_at?: string | null;
          media_type?: 'voice' | 'image' | 'video' | null;
          media_url?: string | null;
          media_duration?: number | null;
        };
        Update: {
          text?: string;
          translated_text?: string | null;
          is_deleted?: boolean;
          read?: boolean;
          read_at?: string | null;
          media_type?: 'voice' | 'image' | 'video' | null;
          media_url?: string | null;
          media_duration?: number | null;
        };
      };
      reviews: {
        Row: {
          id: string;
          reviewer_id: string;
          reviewee_id: string;
          job_id: string | null;
          rating: number;
          comment: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          reviewee_id: string;
          job_id?: string | null;
          rating: number;
          comment?: string | null;
          tags?: string[];
        };
        Update: {
          rating?: number;
          comment?: string | null;
          tags?: string[];
        };
      };
    };
  };
};
