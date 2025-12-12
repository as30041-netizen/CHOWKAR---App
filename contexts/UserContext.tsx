import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { User, UserRole, Transaction, Notification, ChatMessage } from '../types';
import { MOCK_USER, MOCK_TRANSACTIONS, MOCK_NOTIFICATIONS, TRANSLATIONS, FREE_AI_USAGE_LIMIT } from '../constants';

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
  const [transactions, setTransactions] = useState<Transaction[]>(() => getInitialState('chowkar_transactions', MOCK_TRANSACTIONS));
  const [notifications, setNotifications] = useState<Notification[]>(() => getInitialState('chowkar_notifications', MOCK_NOTIFICATIONS));
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialState('chowkar_messages', []));
  
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [currentAlert, setCurrentAlert] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);

  // Persistence Effects
  useEffect(() => localStorage.setItem('chowkar_user', JSON.stringify(user)), [user]);
  useEffect(() => localStorage.setItem('chowkar_role', JSON.stringify(role)), [role]);
  useEffect(() => localStorage.setItem('chowkar_language', JSON.stringify(language)), [language]);
  useEffect(() => localStorage.setItem('chowkar_isLoggedIn', JSON.stringify(isLoggedIn)), [isLoggedIn]);
  useEffect(() => localStorage.setItem('chowkar_transactions', JSON.stringify(transactions)), [transactions]);
  useEffect(() => localStorage.setItem('chowkar_notifications', JSON.stringify(notifications)), [notifications]);
  useEffect(() => localStorage.setItem('chowkar_messages', JSON.stringify(messages)), [messages]);

  const t = TRANSLATIONS[language];

  const addNotification = (userId: string, title: string, message: string, type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' = 'INFO', relatedJobId?: string) => {
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
  };

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setCurrentAlert({ message, type });
    // Clear alert after 3 seconds
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

  const incrementAiUsage = () => {
    if (!user.isPremium) {
        const newCount = (user.aiUsageCount || 0) + 1;
        setUser(prev => ({
            ...prev,
            aiUsageCount: newCount
        }));
        
        const remaining = FREE_AI_USAGE_LIMIT - newCount;
        if (remaining > 0) {
            addNotification(
                user.id, 
                "Free AI Try Used", 
                `${remaining} ${remaining === 1 ? 'try' : 'tries'} remaining.`, 
                "INFO"
            );
        } else {
            addNotification(
                user.id, 
                "Last Free Try Used", 
                "Premium features coming soon!", // UPDATED MESSAGE
                "WARNING"
            );
        }
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUser(MOCK_USER); // Reset to default mock user on logout
    // We let the useEffects handle the localStorage updates
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
      showAlert, currentAlert
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