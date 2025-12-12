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

  const [user, setUser] = useState<User>(() => getInitialState('chowkar_user', MOCK_USER));
  const [role, setRole] = useState<UserRole>(() => getInitialState('chowkar_role', UserRole.WORKER));
  const [language, setLanguage] = useState<'en' | 'hi'>(() => getInitialState('chowkar_language', 'en'));
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => getInitialState('chowkar_isLoggedIn', false));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Persistence Effects (only for preferences)
  useEffect(() => localStorage.setItem('chowkar_user', JSON.stringify(user)), [user]);
  useEffect(() => localStorage.setItem('chowkar_role', JSON.stringify(role)), [role]);
  useEffect(() => localStorage.setItem('chowkar_language', JSON.stringify(language)), [language]);
  useEffect(() => localStorage.setItem('chowkar_isLoggedIn', JSON.stringify(isLoggedIn)), [isLoggedIn]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { user: currentUser } = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { user: currentUser } = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsLoggedIn(true);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(MOCK_USER);
        setIsLoggedIn(false);
        setTransactions([]);
        setNotifications([]);
        setMessages([]);
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
    try {
      // Fetch transactions
      const { data: transactionsData, error: transError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (transError) throw transError;

      const txs: Transaction[] = transactionsData?.map(tx => ({
        id: tx.id,
        userId: tx.user_id,
        amount: tx.amount,
        type: tx.type as 'CREDIT' | 'DEBIT',
        description: tx.description,
        timestamp: new Date(tx.created_at).getTime()
      })) || [];

      setTransactions(txs);

      // Fetch notifications
      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notifError) throw notifError;

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

      // Fetch chat messages
      const { data: messagesData, error: msgError } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: true });

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

    } catch (error) {
      console.error('Error fetching user data:', error);
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

  return (
    <UserContext.Provider value={{
      user, setUser,
      role, setRole,
      language, setLanguage,
      isLoggedIn, setIsLoggedIn,
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
      updateUserInDB
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
