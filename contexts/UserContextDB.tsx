import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, startTransition, useCallback } from 'react';
import { User, UserRole, Notification, ChatMessage, Language } from '../types';
import { TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { supabase } from '../lib/supabase';
import { incrementAIUsage as incrementAIUsageDB, updateUserProfile, getCurrentUser, getUserProfile, signOut } from '../services/authService';
import { initializeAppStateTracking, setAppLoginState, cleanupAppStateTracking, addAppStateListener } from '../services/appStateService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from './LanguageContext';
import { useToast } from './ToastContext';

interface UserContextType {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  role: UserRole;
  setRole: React.Dispatch<React.SetStateAction<UserRole>>;
  language: Language;
  setLanguage: React.Dispatch<React.SetStateAction<Language>>;
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  isAuthLoading: boolean;
  loadingMessage: string;
  checkFreeLimit: () => boolean;
  incrementAiUsage: () => void;
  logout: () => void;
  t: any;
  showSubscriptionModal: boolean;
  setShowSubscriptionModal: React.Dispatch<React.SetStateAction<boolean>>;
  showAlert: (message: string, type?: 'success' | 'error' | 'info') => void;
  currentAlert: { message: string; type: 'success' | 'error' | 'info' } | null;
  updateUserInDB: (updates: Partial<User>) => Promise<void>;
  retryAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  showEditProfile: boolean;
  setShowEditProfile: React.Dispatch<React.SetStateAction<boolean>>;
  hasInitialized: boolean;
  isProfileComplete: boolean;
  authStatus: 'loading' | 'unauthenticated' | 'onboarding' | 'ready';
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Helper to get initial state from localStorage or fallback
  const getInitialState = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      console.error(`Error parsing ${key} from localStorage`, e);
      return fallback;
    }
  };

  const INITIAL_USER: User = {
    id: '',
    name: '',
    rating: 0,
    jobsCompleted: 0
  };

  const [user, setUser] = useState<User>(() => {
    // PLAYWRIGHT HELPER: Check for mock auth flag
    if (typeof window !== 'undefined' && localStorage.getItem('chowkar_mock_auth') === 'true') {
      console.log('[MockAuth] Initializing with Mock User');
      return {
        id: 'mock-user-1',
        name: 'Demo User',
        phone: '9876543210',
        location: 'Mumbai, India',
        rating: 4.8,
        jobsCompleted: 12,
        isPremium: true
      };
    }
    return getInitialState('chowkar_user', INITIAL_USER);
  });

  const [role, setRole] = useState<UserRole>(() => getInitialState('chowkar_role', UserRole.WORKER));



  // Consume new contexts (Facade Pattern)
  const { language, setLanguage, t } = useLanguage();
  const { showAlert, currentAlert } = useToast();

  const isAuthCallback = typeof window !== 'undefined' && (
    window.location.href.includes('access_token=') ||
    window.location.href.includes('code=') ||
    window.location.href.includes('error=') ||
    window.location.href.includes('refresh_token=')
  );

  // CRITICAL FIX: isLoggedIn should strictly reflect session presence, NOT optimistic guesses
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('chowkar_mock_auth') === 'true') return true;
    return false;
  });

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('chowkar_mock_auth') === 'true') return false;
      if (isAuthCallback) return true;
      // CRITICAL FIX: If we think we ARE logged in, we MUST stay in loading state until verified.
      // If we are NOT logged in, we can skip loading to show Landing/Home quickly.
      return localStorage.getItem('chowkar_isLoggedIn') === 'true';
    }
    return true;
  });

  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [hasInitialized, setHasInitialized] = useState(false);

  const pendingAuthEventRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const userProfileRef = useRef<User>(user);
  const fetchInProgressRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    userProfileRef.current = user;
  }, [user]);

  // Check for auth callback synchronously during initialization to prevent race conditions
  const isAuthCallbackRef = useRef<boolean>(
    typeof window !== 'undefined' && (
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('id_token=') ||
      window.location.hash.includes('error=') ||
      window.location.hash.includes('code=') ||
      window.location.search.includes('code=')
    )
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && !hasInitialized) {
      if (window.location.href.includes('error=')) {
        console.warn('[Auth:Debug] Auth error detected in URL, cancelling loading state...');
        const url = new URL(window.location.href);
        url.searchParams.delete('error');
        url.searchParams.delete('error_code');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, document.title, url.pathname + url.search);
        setIsAuthLoading(false);
        setHasInitialized(true);
        showAlert('Authentication cancelled or failed.', 'info');
        return;
      }

      const isCallback =
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('id_token=') ||
        window.location.search.includes('code=') ||
        window.location.hash.includes('code=');

      if (isCallback) {
        console.log('[Auth:Debug] Confirmed OAuth callback in useEffect');
        isAuthCallbackRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    // SUSPENSION CHECK
    if ((user as any).is_suspended && isLoggedIn) {
      console.warn('User is suspended. Forcing logout.');
      logout();
      // Small timeout to allow logout cleanly before alert
      setTimeout(() => {
        alert('Your account has been suspended by the administrator. Please contact support.');
      }, 500);
    }

    localStorage.setItem('chowkar_role', JSON.stringify(role));
  }, [role, user, isLoggedIn]);

  useEffect(() => {
    if (user.id && !user.id.startsWith('u') && !user.name.includes('Mock')) {
      localStorage.setItem('chowkar_user', JSON.stringify(user));
    }
  }, [user]);

  useEffect(() => {
    const savedUser = localStorage.getItem('chowkar_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.id === 'u1' || parsed.name?.toLowerCase().includes('mock')) {
          localStorage.removeItem('chowkar_isLoggedIn');
          localStorage.removeItem('chowkar_user');
          setUser(INITIAL_USER);
        }
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    initializeAppStateTracking();

    // Listen for App Resume (Foreground) to refresh session
    const cleanupListener = addAppStateListener(async (isActive) => {
      // Only act if coming to FOREGROUND and we think we are logged in
      if (isActive && isLoggedIn) {
        // Guard: Don't validate session if we are literally in the middle of a callback or loading
        if (isAuthCallbackRef.current || isAuthLoading) {
          console.log('[Auth] App resumed but skipping validation during active auth process.');
          return;
        }

        console.log('[Auth] App resumed. Validating session...');

        // Silent Check: Don't show loading spinner, just verify token validity
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          console.warn('[Auth] Session invalid on resume:', error);
          if (!isAuthCallbackRef.current) {
            console.error('[Auth] Hard reset due to invalid session on resume.');
            logout();
          }
        } else {
          console.log('[Auth] Session valid on resume. Refreshing data...');
          // Refresh Profile & Wallet (Silent)
          fetchUserData();
        }
      }
    });

    return () => {
      cleanupListener();
      cleanupAppStateTracking();
    };
  }, [isLoggedIn]); // Re-bind if login state changes

  useEffect(() => {
    setAppLoginState(isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    let mounted = true;
    const refreshSessionOnLoad = async () => {
      if (isAuthCallbackRef.current) return;
      try {
        // STRICT CHECK: Try to get a valid session immediately
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session?.user) {
          console.log('[Auth] Valid session found on init.');
          setIsLoggedIn(true);
          currentUserIdRef.current = session.user.id;
          setUser(prev => ({ ...prev, id: session.user.id, email: session.user.email }));
        } else {
          console.log('[Auth] No active session returned by getSession().');

          // CRITICAL FIX FOR MOBILE: 
          // Supabase's async storage on mobile (Capacitor) might be slower than this execution.
          // Do NOT logout immediately if localStorage claims we are logged in.
          // Wait for onAuthStateChange to fire 'SIGNED_OUT' or 'INITIAL_SESSION' to confirm.
          if (localStorage.getItem('chowkar_isLoggedIn') === 'true') {
            console.warn('[Auth] Local state says logged in, but no session yet. Waiting for Auth State Change...');
            // Do NOT call logout() here. Let the subscription handle it or the safety timeout.
          } else {
            // Truly no session and no local record
            if (isLoggedIn) logout();
          }
        }
      } catch (err) {
        console.error('[Auth] Init session check failed:', err);
        // Don't logout on error, retrying is safer
      } finally {
        if (mounted) {
          // CRITICAL: If we are in an OAuth callback, DO NOT stop loading yet.
          // Wait for onAuthStateChange to fire the SIGNED_IN event.
          if (isAuthCallbackRef.current) {
            console.log('[Auth:Debug] OAuth callback detected. Keeping loading state active...');
          } else if (localStorage.getItem('chowkar_isLoggedIn') !== 'true') {
            console.log('[Auth:Debug] No session and no local record. Finalizing initialization.');
            setIsAuthLoading(false);
            setHasInitialized(true);
          } else {
            console.log('[Auth:Debug] Local record exists. Waiting for Auth State change...');
          }
        }
      }
    };

    refreshSessionOnLoad();

    // Redundant "Safety Timeout" removed - we rely on the explicit check above.
    // We kept the timeout logic conceptually as a fallback for the async call hanging indefinitely?
    // Supabase client usually timeouts itself. Let's keep a very long safety just in case.
    const safetyTimeout = setTimeout(() => {
      if (mounted && isAuthLoading) {
        console.warn('[Auth] Initialization took too long using fallback.');

        // ZOMBIE PROTECTION: If we think we're logged in but have no user, force a reset
        if (localStorage.getItem('chowkar_isLoggedIn') === 'true' && !currentUserIdRef.current && localStorage.getItem('chowkar_mock_auth') !== 'true') {
          console.error('[Auth] Stuck in Zombie State (isLoggedIn=true, userId=null). Forcing Hard Reset...');
          logout();
        }

        setIsAuthLoading(false);
        setHasInitialized(true);
      }
    }, 12000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth Event] ${event}`, { userId: session?.user?.id, email: session?.user?.email });
      if (!mounted) return;

      if (event === 'INITIAL_SESSION' && !session?.user) {
        console.log('[Auth:Debug] INITIAL_SESSION fired with no user.');

        // CRITICAL GUARD: If we are in an OAuth callback, IGNORE this "null session" event.
        // Supabase client fires INITIAL_SESSION before processing the redirect hash.
        if (isAuthCallbackRef.current) {
          console.log('[Auth:Debug] Ignoring null INITIAL_SESSION during OAuth callback.');
          return;
        }

        if (localStorage.getItem('chowkar_isLoggedIn') === 'true' && localStorage.getItem('chowkar_mock_auth') !== 'true') {
          console.warn('[Auth] Local storage says logged in, but INITIAL_SESSION has no user. Verifying...');

          if (Capacitor.isNativePlatform()) {
            setTimeout(() => {
              if (mounted && !isLoggedIn && localStorage.getItem('chowkar_isLoggedIn') === 'true') {
                console.log('[Auth:Debug] Native fallback logout after delay');
                logout();
              }
            }, 3000);
            return;
          }

          console.log('[Auth:Debug] Forcing logout due to null initial session.');
          logout();
        }
        setIsAuthLoading(false);
        setHasInitialized(true);
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const isSameUser = currentUserIdRef.current === session.user.id;

          localStorage.setItem('chowkar_isLoggedIn', 'true');
          setIsLoggedIn(true);
          currentUserIdRef.current = session.user.id;

          setUser(prev => {
            if (prev.id === session.user.id) return prev;
            return {
              ...prev,
              id: session.user.id,
              email: session.user.email || prev.email,
              name: prev.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
            };
          });

          if (isAuthCallbackRef.current && typeof window !== 'undefined') {
            console.log('[Auth:Debug] Cleaning up URL hash after successful OAuth');
            window.history.replaceState({}, document.title, window.location.pathname);
            isAuthCallbackRef.current = false;
          }

          // OPTIMIZATION: Unblock UI immediately. Don't wait for profile fetch.
          if (mountedRef.current) {
            setIsAuthLoading(false); // Hide splash screen
            setHasInitialized(true); // Allow components to load
          }

          // Only fetch if it's a new login or we don't have full data yet
          const needsProfileSync = !isSameUser || !isProfileComplete;
          if (needsProfileSync && !fetchInProgressRef.current) {
            try {
              console.log(`[Auth] Triggering profile sync for ${event}...`);
              fetchUserData();
            } catch (err) {
              console.error('[Auth] Profile sync failed during event:', event, err);
            }
          }
        } else if (event === 'INITIAL_SESSION') {
          if (localStorage.getItem('chowkar_isLoggedIn') !== 'true') {
            setIsAuthLoading(false);
            setHasInitialized(true);
          }
        }
      }

      // CRITICAL FIX: Clear safety timeout if auth reaches a terminal state
      const isTerminalState = session?.user || event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session);
      if (isTerminalState) {
        console.log(`[Auth] State resolved via ${event}, clearing safety timeout.`);
        clearTimeout(safetyTimeout);
      }

      if (event === 'SIGNED_OUT') {
        if (isAuthCallbackRef.current) return;
        if (isLoggedIn || currentUserIdRef.current) {
          localStorage.removeItem('chowkar_isLoggedIn');
          startTransition(() => {
            setUser(INITIAL_USER);
            setIsLoggedIn(false);
            setIsAuthLoading(false);
            setHasInitialized(true);
          });
          currentUserIdRef.current = null;
        }

        // Also clear timeout on logout
        clearTimeout(safetyTimeout);
      } else if (event === 'USER_UPDATED' && session?.user) {
        currentUserIdRef.current = session.user.id;
      }
    });

    return () => {
      mountedRef.current = false;
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Only refresh if logged in and we aren't already fetching
    if (isLoggedIn && user.id && !isAuthLoading && !fetchInProgressRef.current) {
      const now = Date.now();
      // Throttling: Don't refresh more than every 5 seconds via this effect
      if (now - lastFetchTimeRef.current > 5000) {
        console.log('[UserContext] Auto-refreshing user data...');
        fetchUserData();
      }
    }
  }, [isLoggedIn, user.id, isAuthLoading]);

  const fetchUserData = async () => {
    if (!user.id || fetchInProgressRef.current) return;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (!isValidUUID) return;

    try {
      fetchInProgressRef.current = true;
      lastFetchTimeRef.current = Date.now();

      console.log('[UserContext] Fetching user profile for:', user.id);
      const { user: refreshedUser, error: profileError } = await getUserProfile(user.id);

      if (!profileError && refreshedUser && mountedRef.current) {
        setUser(refreshedUser);
      }

      if (Capacitor.isNativePlatform() && mountedRef.current) {
        LocalNotifications.checkPermissions().then(permStatus => {
          if (permStatus.display === 'prompt' || permStatus.display === 'prompt-with-rationale') {
            LocalNotifications.requestPermissions();
          }
        }).catch(err => console.error(err));
      }
    } catch (error) {
      console.error('[UserContext] fetchUserData error:', error);
      // Only show alert if it's not a background refresh
      if (!hasInitialized) {
        showAlert('Failed to refresh data. Please check your connection.', 'error');
      }
    } finally {
      fetchInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user.id) return;
    let debounceTimer: NodeJS.Timeout | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchUserData().catch(err => console.error(err));
        }, 2000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [isLoggedIn, user.id]);

  useEffect(() => {
    if (!isLoggedIn || !user.id) return;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (!isValidUUID) return;
    const profileSubscription = supabase
      .channel('profile_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            console.log('[Realtime] Profile updated:', payload.new);
            setUser(prev => ({
              ...prev,
              ...payload.new,
              email: prev.email,
              name: payload.new.name || prev.name,
              subscription_plan: payload.new.subscription_plan,
              subscription_expiry: payload.new.subscription_expiry,
              is_suspended: payload.new.is_suspended
            }));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [isLoggedIn, user.id]);

  const checkFreeLimit = () => {
    if (user.isPremium) return true;
    if ((user.aiUsageCount || 0) < FREE_AI_USAGE_LIMIT) return true;
    setShowSubscriptionModal(true);
    return false;
  };

  const incrementAiUsage = () => {
    if (user.isPremium) return;
    const newCount = (user.aiUsageCount || 0) + 1;
    setUser(prev => ({ ...prev, aiUsageCount: newCount }));
    incrementAIUsageDB(user.id, newCount);
  };

  // SUPER APP FIX: Profile is complete if user has a real name, real phone, and location
  const isProfileComplete = !!(
    user.name &&
    user.name !== 'User' &&
    user.name.trim() !== '' &&
    user.phone &&
    !user.phone.startsWith('pending_') && // Block unique placeholders
    user.location &&
    user.location !== 'Not set'
  );

  // Derived Auth Status for Super App Gatekeeper
  const authStatus = !hasInitialized || isAuthLoading
    ? 'loading'
    : !isLoggedIn || !user.id
      ? 'unauthenticated'
      : !isProfileComplete
        ? 'onboarding'
        : 'ready';

  const updateUserInDB = async (updates: Partial<User>) => {
    try {
      if (updates.name && updates.name.trim() !== user.name) {
        setUser(prev => ({ ...prev, name: updates.name || '' }));
      }
      const updatePromise = updateUserProfile(user.id, updates);
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out while updating profile.')), 15000)
      );
      const result = await Promise.race([updatePromise, timeoutPromise]);
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('chowkar_isLoggedIn');
      localStorage.removeItem('chowkar_user');
      localStorage.removeItem('chowkar_onboarding_complete');
      localStorage.removeItem('chowkar_role');
      // localStorage.removeItem('chowkar_language'); // Keep language preference across sessions
      localStorage.removeItem('chowkar_feed_cache');
      localStorage.removeItem('chowkar_pending_navigation');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase.auth.token') || key.startsWith('sb-') || key.includes('auth-token')) {
            localStorage.removeItem(key);
          }
        });
      }
      startTransition(() => {
        setIsLoggedIn(false);
        setIsAuthLoading(false);
        setHasInitialized(true);
        setUser(INITIAL_USER);
      });
      currentUserIdRef.current = null;
      signOut();
    } catch (error) {
      window.location.href = '/';
    }
  };

  const retryAuth = async () => {
    setIsAuthLoading(true);
    setLoadingMessage('Retrying...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setLoadingMessage('Loading your profile...');
        const { user: currentUser, error } = await getCurrentUser(session.user);
        if (error || !currentUser) throw new Error('Failed to load profile');
        setUser(currentUser);
        setIsLoggedIn(true);
        setLoadingMessage('Success!');
      } else {
        setIsLoggedIn(false);
        setLoadingMessage('No active session found');
        throw new Error('No active session');
      }
    } catch (error) {
      setLoadingMessage('Retry failed. Please refresh the page.');
    } finally {
      setIsAuthLoading(false);
      setHasInitialized(true);
    }
  };

  return (
    <UserContext.Provider value={{
      user, setUser,
      role, setRole,
      language, setLanguage,
      isLoggedIn, setIsLoggedIn,
      isAuthLoading,
      loadingMessage,
      checkFreeLimit,
      incrementAiUsage,
      logout,
      t,
      showSubscriptionModal,
      setShowSubscriptionModal,
      showAlert,
      currentAlert,
      updateUserInDB,
      retryAuth,
      refreshUser: fetchUserData,
      showEditProfile,
      setShowEditProfile,
      hasInitialized,
      isProfileComplete,
      authStatus
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
