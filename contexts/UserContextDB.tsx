import React, { createContext, useState, useContext, ReactNode, useEffect, useRef, startTransition, useCallback } from 'react';
import { User, UserRole, Notification, ChatMessage } from '../types';
import { TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { supabase } from '../lib/supabase';
import { incrementAIUsage as incrementAIUsageDB, updateUserProfile, getCurrentUser, getUserProfile, signOut } from '../services/authService';
import { fetchUserNotifications } from '../services/notificationService';
import { registerPushNotifications, setupPushListeners, removePushListeners, isPushSupported } from '../services/pushService';
import { initializeAppStateTracking, setAppLoginState, cleanupAppStateTracking, shouldSendPushNotification } from '../services/appStateService';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

interface UserContextType {
  user: User;
  setUser: React.Dispatch<React.SetStateAction<User>>;
  role: UserRole;
  setRole: React.Dispatch<React.SetStateAction<UserRole>>;
  language: 'en' | 'hi';
  setLanguage: React.Dispatch<React.SetStateAction<'en' | 'hi'>>;
  isLoggedIn: boolean;
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>;
  isAuthLoading: boolean;
  loadingMessage: string;
  notifications: Notification[];
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addNotification: (userId: string, title: string, message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', relatedJobId?: string) => void;
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
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  markNotificationsAsReadForJob: (jobId: string) => Promise<void>;
  deleteNotification: (notifId: string) => Promise<void>;
  clearNotificationsForJob: (jobId: string) => Promise<void>;
  showEditProfile: boolean;
  setShowEditProfile: React.Dispatch<React.SetStateAction<boolean>>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

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

  // Define safe initial user state (empty) to avoid "Rajesh Kumar" mock data leaking
  const INITIAL_USER: User = {
    id: '',
    name: '',
    rating: 0,
    jobsCompleted: 0
  };

  // Init user from storage to prevent flashing/empty state on reload
  // BUT fallback to INITIAL_USER to prevent fake data
  const [user, setUser] = useState<User>(() => getInitialState('chowkar_user', INITIAL_USER));
  const [role, setRole] = useState<UserRole>(() => getInitialState('chowkar_role', UserRole.WORKER));
  const [language, setLanguage] = useState<'en' | 'hi'>(() => getInitialState('chowkar_language', 'en'));

  // Check if we are currently in an OAuth callback (to prevent flickering)
  const isAuthCallback = typeof window !== 'undefined' && (
    window.location.href.includes('access_token=') ||
    window.location.href.includes('code=') ||
    window.location.href.includes('error=') ||
    window.location.href.includes('refresh_token=')
  );

  // STREAMLINED AUTH: Check localStorage flag for instant login OR check if we are in a callback
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (isAuthCallback) return true;
      return localStorage.getItem('chowkar_isLoggedIn') === 'true';
    }
    return false;
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Track active chat to prevent notifications for open chats
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const activeChatIdRef = useRef<string | null>(null);
  // Track last notification time per job to prevent spam (throttling)
  const lastNotificationTimeRef = useRef<Record<string, number>>({});

  const setActiveChatId = (id: string | null) => {
    setActiveChatIdState(id);
    activeChatIdRef.current = id;
  };

  // Track active job to suppress notifications when user is viewing that job
  const [activeJobId, setActiveJobIdState] = useState<string | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const setActiveJobId = (id: string | null) => {
    setActiveJobIdState(id);
    activeJobIdRef.current = id;
  };

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  // If we have the persistent flag OR are in a callback, we are NOT loading initially (Optimistic Success)
  // BUT we show a special loading state while processing the callback token
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      if (isAuthCallback) return true; // Show spinner while parsing token
      return localStorage.getItem('chowkar_isLoggedIn') !== 'true';
    }
    return true;
  });

  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Track state transitions to avoid flickering
  const pendingAuthEventRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const currentUserIdRef = useRef<string | null>(null);
  const userProfileRef = useRef<User>(user);

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    userProfileRef.current = user;
  }, [user]);

  // CRITICAL: Track if we are currently handling an OAuth callback to prevent state wipes
  const isAuthCallbackRef = useRef<boolean>(false);
  if (typeof window !== 'undefined' && !hasInitialized) {
    isAuthCallbackRef.current =
      window.location.href.includes('access_token=') ||
      window.location.href.includes('code=') ||
      window.location.href.includes('error=') ||
      window.location.href.includes('refresh_token=');
  }

  // Persistence Effects (only for preferences, NOT auth state)
  useEffect(() => localStorage.setItem('chowkar_role', JSON.stringify(role)), [role]);
  useEffect(() => localStorage.setItem('chowkar_language', JSON.stringify(language)), [language]);

  // Persist User Object with safety check
  useEffect(() => {
    // Never persist mock data to local storage
    if (user.id && !user.id.startsWith('u') && !user.name.includes('Mock')) {
      console.log('[Data] Syncing user to localStorage:', user.id);
      localStorage.setItem('chowkar_user', JSON.stringify(user));
    }
  }, [user]);

  // Cleanup: If we start and find legacy test data in storage, clear it
  useEffect(() => {
    const savedUser = localStorage.getItem('chowkar_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.id === 'u1' || parsed.name?.toLowerCase().includes('mock')) {
          console.log('[Auth] Found legacy test user in storage, clearing...');
          localStorage.removeItem('chowkar_isLoggedIn');
          localStorage.removeItem('chowkar_user');
          setUser(INITIAL_USER);
        }
      } catch (e) { }
    }
  }, []);

  // Initialize app state tracking (for push notification logic)
  useEffect(() => {
    initializeAppStateTracking();
    console.log('[AppState] Initialized app state tracking');
    return () => {
      cleanupAppStateTracking();
    };
  }, []);

  // Update login state when auth status changes
  useEffect(() => {
    setAppLoginState(isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    console.log('[Auth] Initializing authentication...');
    let mounted = true;

    // CRITICAL FIX: Force session refresh on every page load to ensure auth token is fresh
    // This makes page refresh behave like fresh login
    const refreshSessionOnLoad = async () => {
      // SKIP if we are processing an auth callback (Supabase handles this automatically)
      // calling refreshSession here causes a race condition that swallows the INITIAL_SESSION event
      if (isAuthCallbackRef.current) {
        console.log('[Auth] Auth callback detected, skipping manual refresh to allow auto-handling...');
        return;
      }

      try {
        console.log('[Auth] Refreshing session on page load...');
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[Auth] Session refresh failed:', error.message);
          // Session might be expired - this will trigger SIGNED_OUT event
        } else if (session) {
          console.log('[Auth] Session refreshed successfully for:', session.user?.email);
        }
      } catch (err) {
        console.warn('[Auth] Session refresh exception:', err);
      }
    };

    // Trigger session refresh (non-blocking)
    refreshSessionOnLoad();

    // 1. SAFETY TIMEOUT: Force app to open if auth hangs
    // extend wait time if we are processing a callback (OAuth takes longer)
    const timeoutDuration = isAuthCallbackRef.current ? 20000 : 4000;

    const safetyTimeout = setTimeout(async () => {
      if (mounted && isAuthLoading) {
        console.warn(`[Auth] Safety timeout reached (${timeoutDuration}ms). Checking session manually...`);

        try {
          // Wrapped in timeout to prevent hanging forever if client is stuck
          const sessionPromise = supabase.auth.getSession();
          // Relaxed manually check timeout to 3s (was 1s) to give slow clients a chance
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 3000)
          );

          const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

          if (session?.user) {
            console.log('[Auth] Recovered session manually after timeout');
            // Manually trigger state update since event listener missed it
            setIsLoggedIn(true);
            currentUserIdRef.current = session.user.id;
            setUser(prev => ({ ...prev, id: session.user.id, email: session.user.email }));
          } else {
            // If we can't find a session, assume we are logged out
            console.warn('[Auth] No session found (or timed out). Defaulting to logged out.');
            setIsLoggedIn(false);
            localStorage.removeItem('chowkar_isLoggedIn');
          }
        } catch (e) {
          console.error('[Auth] Manual check failed:', e);
          setIsLoggedIn(false);
          localStorage.removeItem('chowkar_isLoggedIn');
        }

        // ALWAYS unblock the UI
        setHasInitialized(true);
        setIsAuthLoading(false);
      }
    }, timeoutDuration);

    // 2. Consolidated Auth handling via Supabase listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('[Auth] Event:', event, session?.user?.email);

      if (event === 'INITIAL_SESSION' && !session?.user) {
        // Handle case where we thought we were logged in but aren't
        // CRITICAL FIX: Don't wipe if we see auth data in URL or if we're on a native platform starting up
        if (isAuthCallbackRef.current) {
          console.log('[Auth] INITIAL_SESSION null but auth data detected, waiting for next event...');
          return;
        }

        if (Capacitor.isNativePlatform()) {
          console.log('[Auth] Native platform detected. Deferring session wipe to allow deep links to process.');
          // Give deep links 2 seconds to fire before we assume session death
          const nativeTimeout = setTimeout(() => {
            if (mounted && !isLoggedIn && localStorage.getItem('chowkar_isLoggedIn') === 'true') {
              console.log('[Auth] Native grace period over, session still null. Wiping.');
              localStorage.removeItem('chowkar_isLoggedIn');
              setIsAuthLoading(false);
              setHasInitialized(true);
            }
          }, 2000);
          return; // Wait for that timeout or a SIGNED_IN event
        }

        if (localStorage.getItem('chowkar_isLoggedIn') === 'true') {
          console.log('[Auth] Optimistic login invalidated by INITIAL_SESSION null');
          localStorage.removeItem('chowkar_isLoggedIn');
          setIsLoggedIn(false);
        }
        setIsAuthLoading(false);
        setHasInitialized(true);
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // If we are already logged in with the same user, just update the ref and continue
          const currentUser = userProfileRef.current;
          const isSameUser = currentUser.id === session.user.id;

          if (isSameUser && isLoggedIn) {
            console.log('[Auth] session refresh/token event for already logged in user. updating in background.');
            // Update token if needed (ref handled internally by supabase)
            // But don't toggle loading state to prevent flickering
          }

          console.log('[Auth] Handling session:', event);
          localStorage.setItem('chowkar_isLoggedIn', 'true');
          setIsLoggedIn(true);
          currentUserIdRef.current = session.user.id;

          // SET ID IMMEDIATELY to unblock feed loading in Home.tsx
          // This ensures that even if profile fetch is slow, the app knows the user identity
          setUser(prev => {
            if (prev.id === session.user.id) return prev;
            return {
              ...prev,
              id: session.user.id,
              email: session.user.email || prev.email,
              name: prev.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || ''
            };
          });

          // CLEAR URL SENSITIVE DATA AFTER SUCCESSFUL CONSUMPTION
          if (isAuthCallbackRef.current && typeof window !== 'undefined') {
            console.log('[Auth] Cleaning sensitive data from URL...');
            window.history.replaceState({}, document.title, window.location.pathname);
            isAuthCallbackRef.current = false;
          }

          // STALE-WHILE-REVALIDATE: Fetch FULL profile (with phone/location)
          try {
            console.log('[Auth] Fetching profile update...');
            const { user: fullUser, error: fetchError } = await getCurrentUser(session.user);
            if (fullUser && mountedRef.current) {
              // Update with full profile data
              setUser(fullUser);
            }
          } catch (err) {
            console.warn('[Auth] Background profile refresh failed', err);
          } finally {
            if (mountedRef.current) {
              setIsAuthLoading(false);
              setHasInitialized(true);
            }
          }
        } else if (event === 'INITIAL_SESSION') {
          // Initial session is null, wait for actual state before clearing
          console.log('[Auth] INITIAL_SESSION is null, checking for persistent state...');
          if (localStorage.getItem('chowkar_isLoggedIn') === 'true') {
            // We expect a login, don't stop loading yet
            console.log('[Auth] Persistent login found, waiting for redirect/refresh event...');
          } else {
            setIsAuthLoading(false);
            setHasInitialized(true);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] SIGNED_OUT event received');

        // CRITICAL FIX: Don't handle SIGNED_OUT if we started with auth data in URL
        if (isAuthCallbackRef.current) {
          console.log('[Auth] SIGNED_OUT received but auth data detected at start, ignoring...');
          return;
        }

        if (isLoggedIn || currentUserIdRef.current) {
          console.log('[Auth] Cleaning up state after SIGNED_OUT');
          localStorage.removeItem('chowkar_isLoggedIn');
          startTransition(() => {
            setUser(INITIAL_USER);
            setIsLoggedIn(false);
            setNotifications([]);
            setMessages([]);
            setIsAuthLoading(false);
            setHasInitialized(true);
          });
          currentUserIdRef.current = null;
        }
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

  // Fetch user data from database when logged in
  useEffect(() => {
    if (isLoggedIn && user.id && !isAuthLoading) {
      fetchUserData();
    }
  }, [isLoggedIn, user.id, isAuthLoading]);

  const fetchUserData = async () => {
    console.log('[Data] Starting to fetch user data...');
    // Guard: Only fetch if user.id is a valid UUID
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (!isValidUUID) return;

    try {
      console.log('[Data] Fetching user data in parallel...');

      // OPTIMIZATION: Fetch all user data in parallel instead of sequentially
      const [profileResult, notificationsResult] = await Promise.all([
        getUserProfile(user.id),
        fetchUserNotifications(user.id)
      ]);

      // Process profile
      const { user: refreshedUser, error: profileError } = profileResult;
      if (!profileError && refreshedUser) {
        setUser(refreshedUser);
      }

      // Process notifications
      const { notifications: notificationsData, error: notifError } = notificationsResult;
      if (notifError) {
        console.error('[Data] Error fetching notifications:', notifError);
      } else {
        setNotifications(notificationsData);
        console.log('[Data] Notifications loaded:', notificationsData.length);
      }

      // OPTIMIZATION: We do NOT fetch full chat history here anymore to save bandwidth.
      // Chat components will fetch their own history on demand.
      setMessages([]);
      console.log('[Data] All user data loaded successfully (parallel fetch)');


      // Register for push notifications on native platforms (don't await this)
      if (isPushSupported()) {
        registerPushNotifications(user.id).then(({ success, token, error }) => {
          if (success) {
            console.log('[Push] Registered successfully, token:', token?.substring(0, 20) + '...');
          } else {
            console.log('[Push] Registration failed:', error);
          }
        });
      }

      // Request LocalNotifications permission (required for Android)
      if (Capacitor.isNativePlatform()) {
        LocalNotifications.checkPermissions().then(permStatus => {
          if (permStatus.display === 'prompt' || permStatus.display === 'prompt-with-rationale') {
            LocalNotifications.requestPermissions().then(result => {
              console.log('[LocalNotification] Permission result:', result.display);
            });
          } else if (permStatus.display === 'granted') {
            console.log('[LocalNotification] Permission already granted');
          } else {
            console.warn('[LocalNotification] Permission denied');
          }
        }).catch(err => console.error('[LocalNotification] Permission check failed:', err));
      }


    } catch (error) {
      console.error('[Data] Error fetching user data:', error);
      showAlert('Failed to refresh data. Please check your connection.', 'error');
      // Don't block the app if data fetch fails - user can still use basic features
    }
  };

  // Real-time subscription for notifications (HYBRID: Broadcast + postgres_changes)
  useEffect(() => {
    if (!isLoggedIn || !user.id) return;

    console.log('[Realtime] Setting up HYBRID notification subscription for user:', user.id);

    // Handler for incoming notifications (shared between broadcast and postgres_changes)
    const handleIncomingNotification = (notifData: any) => {
      console.log('[Realtime] Notification received via hybrid channel:', notifData);

      const relatedJobId = notifData.related_job_id || notifData.relatedJobId || undefined;

      // CRITICAL: Skip notification if user is currently viewing this chat or job
      if (relatedJobId && (relatedJobId === activeChatIdRef.current || relatedJobId === activeJobIdRef.current)) {
        console.log('[Realtime] Suppressing notification for active chat/job:', relatedJobId);
        return;
      }

      // Note: No longer suppressing notifications when app is open.
      // Industry best practice: always show in-app notification for awareness
      // User can dismiss or tap to navigate

      const newNotif: Notification = {
        id: notifData.id || `n${Date.now()}`,
        userId: notifData.user_id || notifData.userId || user.id,
        title: notifData.title,
        message: notifData.message,
        type: (notifData.type as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR') || 'INFO',
        read: notifData.read ?? false,
        timestamp: notifData.created_at ? new Date(notifData.created_at).getTime() : Date.now(),
        relatedJobId
      };

      // Check for duplicates BEFORE updating state
      setNotifications(prev => {
        // Check by ID (exact match)
        if (prev.some(n => n.id === newNotif.id)) {
          console.log('[Realtime] Duplicate notification by ID, skipping');
          return prev;
        }

        // Check by content + time window (30 seconds) to catch broadcast/postgres_changes duplicates
        // This handles the case where broadcast arrives first with "n123456" ID
        // and then postgres_changes arrives with actual DB ID "uuid-xxx"
        const isDuplicateContent = prev.some(n =>
          n.title === newNotif.title &&
          n.message === newNotif.message &&
          n.relatedJobId === newNotif.relatedJobId &&
          Math.abs(n.timestamp - newNotif.timestamp) < 30000 // 30 seconds window
        );
        if (isDuplicateContent) {
          console.log('[Realtime] Duplicate notification by content (within 30s window), skipping');
          return prev;
        }

        // Extra check: Skip if we already have a notification with same title+message+job in the last minute
        // This catches edge cases where timestamps differ significantly
        const veryRecentDuplicate = prev.some(n =>
          n.title === newNotif.title &&
          n.message === newNotif.message &&
          n.relatedJobId === newNotif.relatedJobId &&
          (Date.now() - n.timestamp) < 60000 // Within last minute
        );
        if (veryRecentDuplicate) {
          console.log('[Realtime] Found very recent duplicate (within 1 min), skipping');
          return prev;
        }

        // Show alert for new notifications (inside callback to ensure we only alert on actual additions)
        if (!newNotif.read) {
          // Use setTimeout to escape the state update context
          setTimeout(() => {
            showAlert(`${newNotif.title}: ${newNotif.message}`, 'info');

            // Trigger System Tray Notification (Native Only, Background Only)
            // REMOVED: LocalNotifications.schedule caused duplicate notifications because server also sends FCM.
            // We rely 100% on the server-side Edge Function to send FCM push when needed.
            /* 
            if (Capacitor.isNativePlatform() && shouldSendPushNotification()) {
              LocalNotifications.schedule({
                notifications: [{
                  title: newNotif.title,
                  body: newNotif.message,
                  id: Math.floor(Date.now() % 100000000), // Integer ID required
                  schedule: { at: new Date(Date.now() + 100) },
                  sound: undefined,
                  attachments: undefined,
                  actionTypeId: "",
                  extra: {
                    jobId: newNotif.relatedJobId,
                    type: newNotif.type,
                    notificationId: newNotif.id
                  }
                }]
              }).catch(err => console.error('[LocalNotification] Error:', err));
            }
            */
          }, 0);
        }

        // Add new notification and limit to 100 to prevent memory issues
        const updated = [newNotif, ...prev];
        return updated.length > 100 ? updated.slice(0, 100) : updated;
      });
    };

    const channel = supabase
      .channel(`user_notifications_${user.id}`)
      // Method 1: Supabase Broadcast (Instant, bypasses RLS for delivery)
      .on('broadcast', { event: 'new_notification' }, (payload) => {
        console.log('[Realtime] Broadcast notification received:', payload);
        if (payload.payload) {
          handleIncomingNotification(payload.payload);
        }
      })
      // Method 2: postgres_changes (Backup, RLS-dependent)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[Realtime] postgres_changes notification received:', payload.new);
          if (payload.new) {
            handleIncomingNotification(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Hybrid notification subscription status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, user.id]);

  // Handle Visibility Change (Foreground sync) with debouncing
  useEffect(() => {
    if (!isLoggedIn || !user.id) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Debounce: Only refresh if 2 seconds have passed since last foreground event
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          console.log('[Realtime] App foregrounded, refreshing data for sync...');
          fetchUserData().catch(err => console.error('Foreground refresh failed', err));
        }, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isLoggedIn, user.id]);

  // Listen for notification taps (LocalNotifications)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      console.log('[Tap] Notification tapped:', notificationAction);

      const { jobId, type, notificationId } = notificationAction.notification.extra || {};

      if (jobId) {
        // Store navigation intent for App.tsx to handle
        localStorage.setItem('chowkar_pending_navigation', JSON.stringify({
          jobId,
          type,
          timestamp: Date.now()
        }));

        // Mark as read
        if (notificationId) {
          deleteNotification(notificationId);
        }

        console.log('[Tap] Stored pending navigation for jobId:', jobId);
      }
    });

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, []);


  // Real-time subscription for chat messages AND Notifications
  useEffect(() => {
    if (!isLoggedIn || !user.id) return;

    // Guard: Only subscribe if user.id is set (REMOVED STRICT UUID CHECK TO BE SAFE)
    if (!user.id) return;

    console.log('[Realtime] Subscribing to global chat messages...');
    const chatSubscription = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen now to INSERT and UPDATE
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg: ChatMessage = {
              id: payload.new.id,
              jobId: payload.new.job_id,
              senderId: payload.new.sender_id,
              text: payload.new.text,
              translatedText: payload.new.translated_text || undefined,
              timestamp: new Date(payload.new.created_at).getTime()
            };

            // Update messages state (for active chats)
            setMessages(prev => {
              // Exact ID Check
              if (prev.some(m => m.id === newMsg.id)) return prev;

              // Optimistic Update Check
              const tempMatchIndex = prev.findIndex(m =>
                m.id.startsWith('temp_') &&
                m.senderId?.toLowerCase() === newMsg.senderId?.toLowerCase() &&
                m.jobId === newMsg.jobId &&
                m.text === newMsg.text
              );

              if (tempMatchIndex !== -1) {
                const updated = [...prev];
                updated[tempMatchIndex] = { ...updated[tempMatchIndex], id: newMsg.id, timestamp: newMsg.timestamp };
                return updated;
              }

              console.log('[Realtime] New Chat Message received:', newMsg);

              // Log for debugging notification issues
              console.log('[Realtime] Debug:', {
                msgSender: newMsg.senderId,
                myId: user.id,
                activeChat: activeChatIdRef.current,
                msgJob: newMsg.jobId
              });

              return [...prev, newMsg];
            });

            // NOTIFICATION LOGIC REMOVED: 
            // We now rely 100% on the backend trigger 'trg_notify_on_chat_message' 
            // which inserts into the 'notifications' table.
            // The 'user_notifications' subscription above will pick that up and show the alert.
            // This prevents "double toasts" (one from here + one from notification table).

          } else if (payload.eventType === 'UPDATE') {
            console.log('[Realtime] Message Updated:', payload.new.id, 'Read:', payload.new.read);
            const updatedMsg: ChatMessage = {
              id: payload.new.id,
              jobId: payload.new.job_id,
              senderId: payload.new.sender_id,
              text: payload.new.is_deleted ? 'This message was deleted' : payload.new.text,
              translatedText: payload.new.translated_text || undefined,
              timestamp: new Date(payload.new.created_at).getTime(),
              isDeleted: payload.new.is_deleted,
              read: payload.new.read,
            };
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Chat subscription status:', status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] Chat sync lost, will attempt recovery...');
        }
      });

    return () => {
      supabase.removeChannel(chatSubscription);
    };
  }, [isLoggedIn, user.id]);

  // Real-time subscription for wallet balance updates (profiles table)
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
        (payload) => {
          console.log('[Realtime] Profile updated:', payload.new);
          // Update profile fields
          setUser(prev => ({
            ...prev,
            rating: payload.new.rating ?? prev.rating,
            isPremium: payload.new.is_premium ?? prev.isPremium
          }));
        }
      )
      .subscribe();

    return () => {
      profileSubscription.unsubscribe();
    };
  }, [isLoggedIn, user.id]);

  const t = TRANSLATIONS[language];

  const addNotification = async (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', relatedJobId?: string) => {
    try {
      const isForMe = userId === user.id;
      const payload = {
        user_id: userId,
        title,
        message,
        type,
        read: false,
        related_job_id: relatedJobId
      };

      if (isForMe) {
        // For current user, we want the data back to update state
        const { data, error } = await supabase.from('notifications').insert(payload).select().single();
        if (error) throw error;

        const newNotif: Notification = {
          id: data.id,
          userId: data.user_id,
          title: data.title,
          message: data.message,
          type: data.type,
          read: data.read,
          timestamp: new Date(data.created_at).getTime(),
          relatedJobId: data.related_job_id || undefined
        };
        setNotifications(prev => [newNotif, ...prev]);
      } else {
        // FOR OTHERS: Fire and forget to DB (no .select() to avoid RLS issues)
        const dbInsert = supabase.from('notifications').insert(payload);
        dbInsert.then(({ error }) => {
          if (error) console.warn('[Notification] DB insert failed:', error.message);
          else console.log('[Notification] DB insert success for user:', userId);
        });

        // INSTANT DELIVERY: Broadcast to the recipient's channel (bypasses RLS)
        const broadcastPayload = {
          id: `n${Date.now()}`,
          user_id: userId,
          userId: userId,
          title,
          message,
          type,
          read: false,
          related_job_id: relatedJobId,
          relatedJobId: relatedJobId,
          created_at: new Date().toISOString()
        };

        // Send via Supabase Broadcast to the recipient's channel
        const channel = supabase.channel(`user_notifications_${userId}`);
        try {
          // Subscribe and wait for connection
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Subscribe timeout')), 3000);
            channel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                clearTimeout(timeout);
                resolve();
              }
            });
          });

          await channel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: broadcastPayload
          });

          console.log('[Notification] Broadcast sent successfully');
        } catch (broadcastError) {
          console.warn('[Notification] Broadcast failed:', broadcastError);
        } finally {
          // Always cleanup channel
          supabase.removeChannel(channel);
        }

        // Send push notification via edge function to the OTHER user
        // We ALWAYS send push for notifications to other users - they may have app closed
        // Note: The edge function will handle cases where user has no push token

        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.access_token) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            console.log('[Push] Sending push notification (app in background)');

            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                userId,
                title,
                body: message,
                data: {
                  notificationId: broadcastPayload.id,
                  jobId: relatedJobId || '',
                  type
                }
              })
            });

            if (response.ok) {
              console.log('[Push] ✅ Notification sent successfully to user:', userId);
            } else {
              const error = await response.text();
              console.warn('[Push] Failed to send notification:', error);
            }
          }
        } catch (pushError) {
          console.warn('[Push] Edge function call failed:', pushError);
          // Don't throw - notification was created successfully
        }

      }
    } catch (error) {
      console.error('Error adding notification:', error);
      // Local fallback only for current user
      if (userId === user.id) {
        const newNotif: Notification = {
          id: `n${Date.now()}`,
          userId, title, message, type,
          read: false,
          timestamp: Date.now(),
          relatedJobId
        };
        setNotifications(prev => [newNotif, ...prev]);
      }
    }
  };
  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCurrentAlert({ message, type });
    setTimeout(() => {
      setCurrentAlert(prev => (prev?.message === message ? null : prev));
    }, 3000);
  };

  const markNotificationsAsReadForJob = useCallback(async (jobId: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      n.relatedJobId === jobId && !n.read
        ? { ...n, read: true }
        : n
    ));

    // DB update using safeRPC
    if (user.id) {
      try {
        const { safeRPC } = await import('../lib/supabase');
        const { error } = await safeRPC('mark_messages_read', {
          p_job_id: jobId,
          p_user_id: user.id
        });

        if (error) {
          // Fallback to direct update if RPC fails or old logic preferred for non-message notifications
          console.warn('[UserContext] RPC mark_messages_read failed, falling back to direct update:', error);
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('related_job_id', jobId)
            .eq('read', false);
        }
      } catch (err) {
        console.error('[UserContext] Error marking notifications read:', err);
      }
    }
  }, [user.id]);

  // Delete a single notification (used when user clicks on it)
  const deleteNotification = useCallback(async (notifId: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notifId));

    // DB delete using safeRPC
    if (user.id) {
      try {
        const { safeRPC } = await import('../lib/supabase');
        const { error } = await safeRPC('soft_delete_notification', { p_notification_id: notifId });
        if (error) {
          console.warn('[UserContext] RPC soft_delete_notification failed, falling back to mark as read:', error);
          await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notifId)
            .match({ user_id: user.id });
        }
      } catch (err) {
        console.error('[UserContext] Error deleting notification:', err);
      }
    }
  }, [user.id]);

  // Clear all notifications for a specific job (Soft Delete/Hide)
  const clearNotificationsForJob = useCallback(async (jobId: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.relatedJobId !== jobId));

    // DB: Mark as read/hidden instead of deleting
    if (user.id) {
      const { safeRPC } = await import('../lib/supabase');
      // We use a bulk soft-delete or just mark all as read for this job
      await safeRPC('soft_delete_job_notifications', { p_job_id: jobId });
    }
  }, [user.id]);

  const checkFreeLimit = () => {
    const isFreeLimitReached = !user.isPremium && (user.aiUsageCount || 0) >= FREE_AI_USAGE_LIMIT;
    if (isFreeLimitReached) {
      setShowSubscriptionModal(true);
      return false;
    }
    return true;
  };

  const incrementAiUsage = async () => {
    if (!user.isPremium) {
      const newCount = (user.aiUsageCount || 0) + 1;
      setUser(prev => ({
        ...prev,
        aiUsageCount: newCount
      }));

      // Update in database
      await incrementAIUsageDB(user.id, user.aiUsageCount || 0);

      const remaining = FREE_AI_USAGE_LIMIT - newCount;
      if (remaining > 0) {
        await addNotification(
          user.id,
          "Free AI Try Used",
          `${remaining} ${remaining === 1 ? 'try' : 'tries'} remaining.`,
          "INFO"
        );
      } else {
        await addNotification(
          user.id,
          "Last Free Try Used",
          "Premium features coming soon!",
          "WARNING"
        );
      }
    }
  };

  const updateUserInDB = async (updates: Partial<User>) => {
    try {
      console.log('[Data] Updating user profile:', updates);

      // Update local state optimistically
      setUser(prev => ({ ...prev, ...updates }));

      console.log(`[Data] Update payload size: ${JSON.stringify(updates).length} characters`);

      const updatePromise = updateUserProfile(user.id, updates);
      const timeoutPromise = new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out while updating profile. Please check your internet and try again.')), 15000)
      );

      const result = await Promise.race([updatePromise, timeoutPromise]);

      if (!result.success) {
        console.error('[Data] DB Update Failed:', result.error);
        throw new Error(result.error);
      }

      console.log('[Data] DB Update Success');
    } catch (error) {
      console.error('Error updating user:', error);
      // Revert optimistic update if needed? For now, we rely on refresh.
      throw error; // Re-throw so the caller (EditProfileModal) knows it failed!
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Initiating logout...');

      // 1. CLEAR LOCAL STATE FIRST (Immediate UI response)
      localStorage.removeItem('chowkar_isLoggedIn');
      localStorage.removeItem('chowkar_user');
      localStorage.removeItem('chowkar_onboarding_complete');
      localStorage.removeItem('chowkar_role'); // Clear role to force reset
      localStorage.removeItem('chowkar_language'); // Clear language preference
      localStorage.removeItem('chowkar_feed_cache'); // Clear any feed cache
      localStorage.removeItem('chowkar_pending_navigation'); // Clear pending navigation

      // 2. CLEAR URL TO PREVENT RE-LOGIN ON REFRESH
      // This removes access_token, code, etc. from the address bar
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);

        // 3. HARD CLEAR SUPABASE STORAGE (Safety for refresh issues)
        // This targets the internal storage keys Supabase uses
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase.auth.token') || key.startsWith('sb-') || key.includes('auth-token')) {
            console.log('[Auth] Hard clearing storage key:', key);
            localStorage.removeItem(key);
          }
        });
      }

      startTransition(() => {
        setIsLoggedIn(false);
        setIsAuthLoading(false);
        setHasInitialized(true);
        setUser(INITIAL_USER);
        setNotifications([]);
        setMessages([]);
      });
      currentUserIdRef.current = null;

      // 4. CALL SERVER SIGN OUT (In background)
      console.log('[Auth] Calling server sign out...');
      signOut().then(result => {
        if (result.success) {
          console.log('[Auth] Server sign out successful');
        } else {
          console.warn('[Auth] Server sign out failed (already cleared locally):', result.error);
        }
      }).catch(err => {
        console.error('[Auth] Server sign out exception:', err);
      });

    } catch (error) {
      console.error('[Auth] Exception during logout state cleanup:', error);
      // Fallback: force location reload to clear memory
      window.location.href = '/';
    }
  };

  const retryAuth = async () => {
    console.log('[Auth] Retrying authentication...');
    setIsAuthLoading(true);
    setLoadingMessage('Retrying...');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setLoadingMessage('Loading your profile...');
        const { user: currentUser, error } = await getCurrentUser(session.user);

        if (error || !currentUser) {
          throw new Error('Failed to load profile');
        }

        setUser(currentUser);
        setIsLoggedIn(true);
        setLoadingMessage('Success!');
      } else {
        setIsLoggedIn(false);
        setLoadingMessage('No active session found');
      }
    } catch (error) {
      console.error('[Auth] Retry failed:', error);
      setLoadingMessage('Retry failed. Please refresh the page.');
    } finally {
      setTimeout(() => setIsAuthLoading(false), 500);
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
      notifications, setNotifications,
      messages, setMessages,
      addNotification,
      checkFreeLimit,
      incrementAiUsage,
      logout,
      t,
      showSubscriptionModal, setShowSubscriptionModal,
      showAlert, currentAlert,
      updateUserInDB,
      retryAuth,
      refreshUser: fetchUserData,
      activeChatId,
      setActiveChatId,
      activeJobId,
      setActiveJobId,
      markNotificationsAsReadForJob,
      deleteNotification,
      clearNotificationsForJob,
      showEditProfile,
      setShowEditProfile
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
