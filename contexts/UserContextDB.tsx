import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, UserRole, Transaction, Notification, ChatMessage } from '../types';
import { MOCK_USER, TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';
import { supabase } from '../lib/supabase';
import {updateWalletBalance, incrementAIUsage as incrementAIUsageDB, updateUserProfile, getCurrentUser, signOut } from '../services/authService';

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

  const [user, setUser] = useState<User>(MOCK_USER);
  const [role, setRole] = useState<UserRole>(() => getInitialState('chowkar_role', UserRole.WORKER));
  const [language, setLanguage] = useState<'en' | 'hi'>(() => getInitialState('chowkar_language', 'en'));
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [hasInitialized, setHasInitialized] = useState(false);

  // Persistence Effects (only for preferences, NOT auth state)
  useEffect(() => localStorage.setItem('chowkar_role', JSON.stringify(role)), [role]);
  useEffect(() => localStorage.setItem('chowkar_language', JSON.stringify(language)), [language]);

  useEffect(() => {
    console.log('[Auth] Initializing authentication...');
    console.log('[Auth] Current URL:', window.location.href);
    console.log('[Auth] URL Hash:', window.location.hash);

    // Clean up old localStorage auth data that may interfere
    try {
      localStorage.removeItem('chowkar_isLoggedIn');
      localStorage.removeItem('chowkar_user');
    } catch (e) {
      console.warn('[Auth] Could not clean localStorage:', e);
    }

    // Check if there are OAuth parameters in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hasOAuthParams = hashParams.has('access_token') || hashParams.has('code');

    if (hasOAuthParams) {
      console.log('[Auth] OAuth parameters detected in URL, processing...');
    }

    // Set up auth state listener
    // Note: onAuthStateChange handles OAuth callbacks automatically when detectSessionInUrl is true
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State change event:', event, 'Session exists:', !!session);

      // Additional debug logging for OAuth flow
      if (session) {
        console.log('[Auth] Session user email:', session.user.email);
        console.log('[Auth] Session provider:', session.user.app_metadata.provider);
      }

      if (event === 'INITIAL_SESSION') {
        setHasInitialized(true);
        if (session?.user) {
          console.log('[Auth] Initial session detected, fetching profile...');
          setIsAuthLoading(true);
          setLoadingMessage('Loading your profile...');

          // Add timeout to prevent infinite loading
          const timeoutId = setTimeout(() => {
            console.error('[Auth] Profile fetch timeout - forcing auth completion');
            setLoadingMessage('Connection timeout. Please refresh the page.');
            setIsAuthLoading(false);
          }, 10000); // 10 second timeout

          try {
            const { user: currentUser, error} = await getCurrentUser();
            clearTimeout(timeoutId);

            if (error) {
              console.error('[Auth] Error fetching user profile:', error);
              setLoadingMessage('Error loading profile. Please try again.');
              setIsAuthLoading(false);
              return;
            }

            if (currentUser) {
              console.log('[Auth] Profile loaded successfully:', currentUser.name);
              setLoadingMessage('Setting up your account...');
              setUser(currentUser);
              setIsLoggedIn(true);
            } else {
              console.warn('[Auth] No user profile returned');
              setLoadingMessage('Profile not found. Please try again.');
            }
          } catch (err) {
            clearTimeout(timeoutId);
            console.error('[Auth] Exception while fetching profile:', err);
            setLoadingMessage('Something went wrong. Please refresh.');
          } finally {
            setIsAuthLoading(false);
          }
        } else {
          console.log('[Auth] No initial session found');
          setIsAuthLoading(false);
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        console.log('[Auth] User signed in, fetching profile...');
        setIsAuthLoading(true);
        setLoadingMessage('Creating your profile...');

        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.error('[Auth] Profile fetch timeout after sign in - forcing auth completion');
          setLoadingMessage('Connection timeout. Please refresh the page.');
          setIsAuthLoading(false);
        }, 10000); // 10 second timeout

        try {
          const { user: currentUser, error } = await getCurrentUser();
          clearTimeout(timeoutId);

          if (error) {
            console.error('[Auth] Error fetching user profile:', error);
            setLoadingMessage('Error creating profile. Please try again.');
            setIsAuthLoading(false);
            return;
          }

          if (currentUser) {
            console.log('[Auth] Profile loaded successfully:', currentUser.name);
            setLoadingMessage('Welcome! Setting up your account...');
            setUser(currentUser);
            setIsLoggedIn(true);
          } else {
            console.warn('[Auth] No user profile returned after sign in');
            setLoadingMessage('Profile creation failed. Please try again.');
          }
        } catch (err) {
          clearTimeout(timeoutId);
          console.error('[Auth] Exception while fetching profile:', err);
          setLoadingMessage('Something went wrong. Please refresh.');
        } finally {
          setIsAuthLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        // Only process sign-out if we've initialized and user was actually logged in
        if (hasInitialized && isLoggedIn) {
          console.log('[Auth] User signed out');
          setUser(MOCK_USER);
          setIsLoggedIn(false);
          setTransactions([]);
          setNotifications([]);
          setMessages([]);
        } else {
          console.log('[Auth] Sign-out event ignored (not logged in or not initialized)');
        }
        setIsAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token refreshed');
      } else if (event === 'USER_UPDATED') {
        console.log('[Auth] User updated, refreshing profile...');
        const { user: currentUser } = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user data from database when logged in
  useEffect(() => {
    if (isLoggedIn && user.id) {
      fetchUserData();
    }
  }, [isLoggedIn, user.id]);

  const fetchUserData = async () => {
    console.log('[Data] Starting to fetch user data...');
    try {
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
        .order('created_at', { ascending: false });

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

      // Fetch chat messages for all jobs where user is involved (as poster or worker)
      console.log('[Data] Fetching chat messages...');
      const { data: userJobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', user.id);

      if (jobsError) {
        console.error('[Data] Error fetching user jobs:', jobsError);
      }

      const { data: userBids, error: bidsError } = await supabase
        .from('bids')
        .select('job_id')
        .eq('worker_id', user.id)
        .eq('status', 'ACCEPTED');

      if (bidsError) {
        console.error('[Data] Error fetching user bids:', bidsError);
      }

      const jobIds = [
        ...(userJobs?.map(j => j.id) || []),
        ...(userBids?.map(b => b.job_id) || [])
      ];

      const { data: messagesData, error: msgError } = jobIds.length > 0
        ? await supabase
            .from('chat_messages')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: true })
        : { data: [], error: null };

      if (msgError) throw msgError;

      const msgs: ChatMessage[] = messagesData?.map(msg => ({
        id: msg.id,
        jobId: msg.job_id,
        senderId: msg.sender_id,
        text: msg.text,
        timestamp: new Date(msg.created_at).getTime(),
        translatedText: msg.translated_text || undefined
      })) || [];

      setMessages(msgs);
      console.log('[Data] Chat messages loaded:', msgs.length);
      console.log('[Data] All user data loaded successfully');

    } catch (error) {
      console.error('[Data] Error fetching user data:', error);
      // Don't block the app if data fetch fails - user can still use basic features
    }
  };

  // Real-time subscription for notifications
  useEffect(() => {
    if (!isLoggedIn || !user.id) return;

    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif: Notification = {
            id: payload.new.id,
            userId: payload.new.user_id,
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type,
            read: payload.new.read,
            timestamp: new Date(payload.new.created_at).getTime(),
            relatedJobId: payload.new.related_job_id || undefined
          };
          setNotifications(prev => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isLoggedIn, user.id]);

  const t = TRANSLATIONS[language];

  const addNotification = async (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', relatedJobId?: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          read: false,
          related_job_id: relatedJobId
        })
        .select()
        .single();

      if (error) throw error;

      // Real-time subscription will handle adding to state
      // But if it's for the current user, add it immediately for responsive UI
      if (userId === user.id) {
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
      }
    } catch (error) {
      console.error('Error adding notification:', error);
      // Fallback to local state only
      const newNotif: Notification = {
        id: `n${Date.now()}`,
        userId,
        title,
        message,
        type,
        read: false,
        timestamp: Date.now(),
        relatedJobId
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCurrentAlert({ message, type });
    setTimeout(() => {
      setCurrentAlert(prev => (prev?.message === message ? null : prev));
    }, 3000);
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
    await signOut();
    setIsLoggedIn(false);
    setUser(MOCK_USER);
    setTransactions([]);
    setNotifications([]);
    setMessages([]);
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
      retryAuth
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
