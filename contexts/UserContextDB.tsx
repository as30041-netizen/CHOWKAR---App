import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';
import { User, UserRole, Transaction, Notification, ChatMessage } from '../types';
import { MOCK_USER, TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { supabase } from '../lib/supabase';
import { updateWalletBalance, incrementAIUsage as incrementAIUsageDB, updateUserProfile, getCurrentUser, getUserProfile, signOut } from '../services/authService';

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
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
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

  // Init user from storage to prevent flashing/empty state on reload
  const [user, setUser] = useState<User>(() => getInitialState('chowkar_user', MOCK_USER));
  const [role, setRole] = useState<UserRole>(() => getInitialState('chowkar_role', UserRole.WORKER));
  const [language, setLanguage] = useState<'en' | 'hi'>(() => getInitialState('chowkar_language', 'en'));

  // STREAMLINED AUTH: Check localStorage flag for instant login
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chowkar_isLoggedIn') === 'true';
    }
    return false;
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const [currentAlert, setCurrentAlert] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  // If we have the persistent flag, we are NOT loading initially (Optimistic Success)
  const [isAuthLoading, setIsAuthLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chowkar_isLoggedIn') !== 'true';
    }
    return true;
  });

  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [hasInitialized, setHasInitialized] = useState(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Persistence Effects (only for preferences, NOT auth state)
  useEffect(() => localStorage.setItem('chowkar_role', JSON.stringify(role)), [role]);
  useEffect(() => localStorage.setItem('chowkar_language', JSON.stringify(language)), [language]);
  // Persist User Object
  useEffect(() => localStorage.setItem('chowkar_user', JSON.stringify(user)), [user]);

  useEffect(() => {
    console.log('[Auth] Initializing authentication...');
    let mounted = true;

    // 1. SAFETY TIMEOUT: Force app to open if auth hangs for more than 3 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && isAuthLoading) {
        console.warn('[Auth] Safety timeout reached. Forcing app initialization.');
        setHasInitialized(true);
        setIsAuthLoading(false);
      }
    }, 3000);

    // 2. DIRECT SESSION CHECK (Primary Initialization)
    const initAuth = async () => {
      try {
        console.log('[Auth] Checking session directly...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (mounted && session?.user) {
          console.log('[Auth] Direct session found:', session.user.email);
          // VALID SESSION FOUND
          localStorage.setItem('chowkar_isLoggedIn', 'true'); // Ensure flag is set

          // Use cached user if available and matches session, otherwise start fresh
          // This prevents overwriting rich profile data with basic session data during reload
          const baseUser = (user.id === session.user.id) ? user : MOCK_USER;

          const optimisticUser: User = {
            ...baseUser,
            id: session.user.id,
            email: session.user.email || baseUser.email || '',
            name: session.user.user_metadata?.full_name || baseUser.name || session.user.email?.split('@')[0] || 'User'
          };

          // BATCH UPDATES
          setUser(optimisticUser);
          setIsLoggedIn(true);
          currentUserIdRef.current = session.user.id;
          setHasInitialized(true);
          setIsAuthLoading(false); // UNBLOCK UI IMMEDIATELY

          // Background Profile Sync
          getCurrentUser(session.user).then(({ user: currentUser }) => {
            if (mounted && currentUser) setUser(currentUser);
          });
        } else if (mounted) {
          // CHECK FOR OAUTH HASH: If we are returning from Google, session might not be ready yet.
          const isOAuthRedirect = typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token') ||
              window.location.hash.includes('type=recovery') ||
              window.location.hash.includes('error_description'));

          if (isOAuthRedirect) {
            console.log('[Auth] OAuth redirect detected. Deferring failure decision...');
            // We do NOT log out yet. We wait for onAuthStateChange or a second check.
            // We can optionally check again in a few seconds to be safe.
            setTimeout(async () => {
              if (!mounted) return;
              console.log('[Auth] Re-checking session after OAuth delay...');
              const { data: { session: retrySession } } = await supabase.auth.getSession();

              if (retrySession?.user) {
                console.log('[Auth] Session verified after delay.');
                // onAuthStateChange likely handled the state update already
              } else {
                console.log('[Auth] OAuth verification failed or timed out.');
                localStorage.removeItem('chowkar_isLoggedIn');
                setIsLoggedIn(false);
                setHasInitialized(true);
                setIsAuthLoading(false);
              }
            }, 4000); // 4 seconds grace period for token processing
            return;
          }

          console.log('[Auth] No direct session found.');
          // If we thought we were logged in (optimistic flag), we were wrong.
          localStorage.removeItem('chowkar_isLoggedIn');
          setIsLoggedIn(false);
          setHasInitialized(true);
          setIsAuthLoading(false); // Show Login Screen
        }
      } catch (err) {
        console.error('[Auth] Direct session check failed:', err);
        // Fallback: If we have the flag, we probably shouldn't kick them out on network error alone?
        // But for safety, if we can't verify, we might stop loading.
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // 3. EVENT LISTENER (Secondary / Updates)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('[Auth] Event:', event);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // If we already have this user, minimal update
          if (currentUserIdRef.current === session.user.id) {
            // ensure loading is off
            if (isAuthLoading) setIsAuthLoading(false);
            return;
          }

          console.log('[Auth] Handling sign-in event.');
          localStorage.setItem('chowkar_isLoggedIn', 'true'); // Persist

          setIsLoggedIn(true);
          const optimisticUser: User = {
            ...MOCK_USER,
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User'
          };
          setUser(optimisticUser);
          currentUserIdRef.current = session.user.id;
          setIsAuthLoading(false);

          // Background sync
          getCurrentUser(session.user).then(({ user: currentUser }) => {
            if (mounted && currentUser) setUser(currentUser);
          });
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('[Auth] Signed out.');
        localStorage.removeItem('chowkar_isLoggedIn'); // Clear persist
        setUser(MOCK_USER);
        setIsLoggedIn(false);
        currentUserIdRef.current = null;
        setTransactions([]);
        setNotifications([]);
        setMessages([]);
        setIsAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user data from database when logged in
  useEffect(() => {
    // Only fetch data if logged in AND initial auth loading is complete
    // This prevents race conditions with the initial profile fetch
    if (isLoggedIn && user.id && !isAuthLoading) {
      fetchUserData();
    }
  }, [isLoggedIn, user.id, isAuthLoading]);

  const fetchUserData = async () => {
    console.log('[Data] Starting to fetch user data...');

    // Guard: Only fetch if user.id is a valid UUID (not mock 'u1')
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    if (!isValidUUID) {
      console.log('[Data] Skipping fetch - user.id is not a valid UUID:', user.id);
      return;
    }

    try {
      // 1. Fetch latest profile data directly (skip auth check for speed)
      // We already have the user.id from the optimistic state
      const { user: refreshedUser, error: profileError } = await getUserProfile(user.id);
      if (!profileError && refreshedUser) {
        setUser(refreshedUser);
      }

      // Fetch transactions
      console.log('[Data] Fetching transactions...');
      const { data: transactionsData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (transError) {
        console.error('[Data] Error fetching transactions:', transError);
        throw transError;
      }

      const txs: Transaction[] = transactionsData?.map(tx => ({
        id: tx.id,
        userId: tx.user_id,
        amount: tx.amount,
        type: tx.type as 'CREDIT' | 'DEBIT',
        description: tx.description,
        timestamp: new Date(tx.created_at).getTime()
      })) || [];

      setTransactions(txs);
      console.log('[Data] Transactions loaded:', txs.length);

      // Fetch notifications
      console.log('[Data] Fetching notifications...');
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (notifError) {
        console.error('[Data] Error fetching notifications:', notifError);
        throw notifError;
      }

      const notifs: Notification[] = notificationsData?.map(notif => ({
        id: notif.id,
        userId: notif.user_id,
        title: notif.title,
        message: notif.message,
        type: notif.type as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
        read: notif.read,
        timestamp: new Date(notif.created_at).getTime(),
        relatedJobId: notif.related_job_id || undefined
      })) || [];

      setNotifications(notifs);
      console.log('[Data] Notifications loaded:', notifs.length);

      // OPTIMIZATION: We do NOT fetch full chat history here anymore to save bandwidth.
      // Chat components will fetch their own history on demand.
      // We only track *new* messages via Realtime in this context.
      setMessages([]);
      console.log('[Data] Chat history fetch skipped (Lazy Loading Enabled)');
      console.log('[Data] All user data loaded successfully');

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

      // SUPPRESS: If user is actively viewing this job, don't show notification
      if (relatedJobId && activeJobIdRef.current === relatedJobId) {
        console.log('[Realtime] Suppressing notification - user is viewing this job:', relatedJobId);
        return; // Silently ignore - user already sees the content
      }

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
        // Check by ID
        if (prev.some(n => n.id === newNotif.id)) {
          console.log('[Realtime] Duplicate notification by ID, skipping');
          return prev;
        }
        // Check by content + time window (5 seconds) to catch broadcast/postgres_changes duplicates
        const isDuplicateContent = prev.some(n =>
          n.title === newNotif.title &&
          n.message === newNotif.message &&
          n.relatedJobId === newNotif.relatedJobId &&
          Math.abs(n.timestamp - newNotif.timestamp) < 5000
        );
        if (isDuplicateContent) {
          console.log('[Realtime] Duplicate notification by content, skipping');
          return prev;
        }

        // Show alert for new notifications (inside callback to ensure we only alert on actual additions)
        if (!newNotif.read) {
          // Use setTimeout to escape the state update context
          setTimeout(() => showAlert(`${newNotif.title}: ${newNotif.message}`, 'info'), 0);
        }

        return [newNotif, ...prev];
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
                m.senderId === newMsg.senderId &&
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
                msgJob: newMsg.jobId,
                throttle: lastNotificationTimeRef.current[newMsg.jobId]
              });

              return [...prev, newMsg];
            });

            // NOTIFICATION LOGIC
            if (newMsg.senderId !== user.id && activeChatIdRef.current !== newMsg.jobId) {
              const now = Date.now();
              const lastTime = lastNotificationTimeRef.current[newMsg.jobId] || 0;

              if (now - lastTime > 2000) { // 2s throttle
                console.log('[Realtime] Triggering Notification', newMsg.jobId);
                lastNotificationTimeRef.current[newMsg.jobId] = now;

                // Insert notification into DB (which will trigger the other listener to update UI)
                const preview = newMsg.text.length > 50 ? newMsg.text.substring(0, 50) + '...' : newMsg.text;

                // REMOVED: Backend Trigger 'on_chat_message_created' now handles this reliably (even if offline).
                // await addNotification(
                //   user.id,
                //   "New Message",
                //   preview,
                //   "INFO",
                //   newMsg.jobId
                // );

                // Also show a local toast for immediate "wow" factor

                // Also show a local toast for immediate "wow" factor
                showAlert(`New message: ${preview}`, 'info');
              } else {
                console.log('[Realtime] Notification throttled for job:', newMsg.jobId);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            console.log('[Realtime] Message Updated:', payload.new.id);
            setMessages(prev => prev.map(m =>
              m.id === payload.new.id
                ? { ...m, text: payload.new.text, translatedText: payload.new.translated_text || undefined }
                : m
            ));
          }
        }
      )
      .subscribe();

    return () => {
      chatSubscription.unsubscribe();
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
          // Update wallet balance and other profile fields
          setUser(prev => ({
            ...prev,
            walletBalance: payload.new.wallet_balance ?? prev.walletBalance,
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
        try {
          const channel = supabase.channel(`user_notifications_${userId}`);
          await channel.subscribe((status) => {
            console.log(`[Notification] Broadcast channel status for ${userId}:`, status);
          });

          const sendResult = await channel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: broadcastPayload
          });

          console.log('[Notification] Broadcast sent to user:', userId, 'Result:', sendResult);
          supabase.removeChannel(channel);
        } catch (broadcastError) {
          console.error('[Notification] Broadcast failed:', broadcastError);
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

  const markNotificationsAsReadForJob = async (jobId: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n =>
      n.relatedJobId === jobId && !n.read
        ? { ...n, read: true }
        : n
    ));

    // DB update
    if (user.id) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('related_job_id', jobId)
        .eq('read', false);
    }
  };

  // Delete a single notification (used when user clicks on it)
  const deleteNotification = async (notifId: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== notifId));

    // DB delete
    if (user.id) {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notifId)
        .eq('user_id', user.id);
    }
  };

  // Clear all notifications for a specific job (used when opening job context)
  const clearNotificationsForJob = async (jobId: string) => {
    // Optimistic update
    setNotifications(prev => prev.filter(n => n.relatedJobId !== jobId));

    // DB delete
    if (user.id) {
      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('related_job_id', jobId);
    }
  };

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
      // Update local state
      setUser(prev => ({ ...prev, ...updates }));

      // Update in database
      await updateUserProfile(user.id, updates);

      // Update wallet balance separately if needed
      if (updates.walletBalance !== undefined) {
        await updateWalletBalance(user.id, updates.walletBalance);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showAlert('Failed to update profile', 'error');
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Logging out...');
      const result = await signOut();
      if (result.error) {
        console.error('[Auth] Sign out error (forcing local logout):', result.error);
        // We continue to clear local state even if server logout fails
      }
      console.log('[Auth] Sign out successful');

      // STREAMLINED AUTH: Clear persistent flag
      localStorage.removeItem('chowkar_isLoggedIn');

      setIsLoggedIn(false);
      setUser(MOCK_USER);
      setTransactions([]);
      setNotifications([]);
      setMessages([]);
    } catch (error) {
      console.error('[Auth] Exception during logout:', error);
      showAlert('An error occurred during sign out', 'error');
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
        const { user: currentUser, error } = await getCurrentUser();

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
      transactions, setTransactions,
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
      clearNotificationsForJob
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
