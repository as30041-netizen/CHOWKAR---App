import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { UserContext } from './UserContextDB';
import { Notification } from '../types';
import { supabase } from '../lib/supabase';
import { fetchUserNotifications } from '../services/notificationService';
import { registerPushNotifications, isPushSupported } from '../services/pushService';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    activeChatId: string | null;
    setActiveChatId: (id: string | null) => void;
    activeJobId: string | null;
    setActiveJobId: (id: string | null) => void;
    markNotificationsAsReadForJob: (jobId: string) => Promise<void>;
    deleteNotification: (notifId: string) => Promise<void>;
    clearNotificationsForJob: (jobId: string) => Promise<void>;
    addNotification: (userId: string, title: string, message: string, type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', relatedJobId?: string) => void;
    refreshNotifications: () => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await safeFetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: true })
            });
        } catch (e) { console.error(e); }
    };

    const clearAll = async () => {
        if (!confirm('Are you sure you want to clear all notifications?')) return;
        setNotifications([]);
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await safeFetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}`, {
                method: 'DELETE'
            });
        } catch (e) { console.error(e); }
    };

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await safeFetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: true })
            });
        } catch (e) { console.error(e); }
    };

    const { user, isLoggedIn, showAlert, isAuthLoading } = useContext(UserContext)!;

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);

    // Track active views to suppress notifications
    const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
    const activeChatIdRef = useRef<string | null>(null);
    const [activeJobId, setActiveJobIdState] = useState<string | null>(null);
    const activeJobIdRef = useRef<string | null>(null);

    const setActiveChatId = (id: string | null) => {
        setActiveChatIdState(id);
        activeChatIdRef.current = id;
    };

    const setActiveJobId = (id: string | null) => {
        setActiveJobIdState(id);
        activeJobIdRef.current = id;
    };

    // Derived state
    const unreadCount = notifications.filter(n => !n.read).length;

    // 1. Initial Fetch when User Logs In
    useEffect(() => {
        if (isLoggedIn && user.id && !isAuthLoading) {
            RefreshData();

            // Also register push if native
            if (isPushSupported()) {
                registerPushNotifications(user.id).then(({ success, token, error }) => {
                    if (success) {
                        console.log('[Push] Registered successfully:', token?.substring(0, 10) + '...');
                    } else {
                        console.warn('[Push] Registration failed:', error);
                    }
                });
            }
        } else if (!isLoggedIn) {
            setNotifications([]);
        }
    }, [isLoggedIn, user.id, isAuthLoading]);

    // 1b. Foreground Resync Logic
    useEffect(() => {
        if (!isLoggedIn || !user.id) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('[Notification] App foregrounded, refreshing list...');
                RefreshData();
            }
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [isLoggedIn, user.id]);

    const RefreshData = async () => {
        if (!user.id) return;
        setLoading(true);
        try {
            const { notifications: data, error } = await fetchUserNotifications(user.id);
            if (error) {
                console.error('[Notification] Error fetching:', error);
            } else {
                setNotifications(data);
                console.log('[Notification] Loaded:', data.length);
            }
        } finally {
            setLoading(false);
        }
    };

    // 2. Realtime Subscription (Hybrid)
    useEffect(() => {
        if (!isLoggedIn || !user.id) return;

        const handleIncomingNotification = (notifData: any) => {
            console.log('[Realtime] Notification received:', notifData);

            const relatedJobId = notifData.related_job_id || notifData.relatedJobId || undefined;

            // Suppress if viewing this chat/job
            if (relatedJobId && (relatedJobId === activeChatIdRef.current || relatedJobId === activeJobIdRef.current)) {
                console.log('[Realtime] Suppressing notification for active chat/job:', relatedJobId);
                return;
            }

            const newNotif: Notification = {
                id: notifData.id || `n${Date.now()}`,
                userId: notifData.user_id || notifData.userId || user.id,
                title: notifData.title,
                message: notifData.message,
                type: (notifData.type as any) || 'INFO',
                read: notifData.read ?? false,
                timestamp: notifData.created_at ? new Date(notifData.created_at).getTime() : Date.now(),
                relatedJobId
            };

            setNotifications(prev => {
                // Dedup by ID
                if (prev.some(n => n.id === newNotif.id)) return prev;

                // Dedup by Content (30s window) for Broadcast vs DB race
                const isDuplicateContent = prev.some(n =>
                    n.title === newNotif.title &&
                    n.message === newNotif.message &&
                    n.relatedJobId === newNotif.relatedJobId &&
                    Math.abs(n.timestamp - newNotif.timestamp) < 30000
                );
                if (isDuplicateContent) return prev;

                // Show Alert
                if (!newNotif.read) {
                    // We use setTimeout to avoid state update conflicts
                    setTimeout(() => showAlert(`${newNotif.title}: ${newNotif.message}`, 'info'), 0);

                    // REMOVED: Redundant LocalNotification.
                    // We now rely on Server-Side Push (FCM) for background notifications.
                    // When foregrounded, the In-App Alert above is sufficient.
                }

                return [newNotif, ...prev].slice(0, 100);
            });
        };

        const channel = supabase
            .channel(`user_notifications_${user.id}`)
            .on('broadcast', { event: 'new_notification' }, (payload) => {
                if (payload.payload) handleIncomingNotification(payload.payload);
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (payload.new) handleIncomingNotification(payload.new);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isLoggedIn, user.id]);

    // 3. Native Tap Handling (Deep Linking)
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
            console.log('[Tap] Notification tapped:', notificationAction);
            const { jobId, type, notificationId } = notificationAction.notification.extra || {};

            if (jobId) {
                localStorage.setItem('chowkar_pending_navigation', JSON.stringify({
                    jobId, type, timestamp: Date.now()
                }));
                if (notificationId) deleteNotification(notificationId);
            }
        });

        return () => {
            LocalNotifications.removeAllListeners();
        };
    }, []);

    // Actions
    const markNotificationsAsReadForJob = async (jobId: string) => {
        // Optimistic
        setNotifications(prev => prev.map(n =>
            n.relatedJobId === jobId ? { ...n, read: true } : n
        ));

        // DB
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            // Correct URL construction with query parameters
            const response = await safeFetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&related_job_id=eq.${jobId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ read: true })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Failed to mark notifications as read');
            }
        } catch (err) {
            console.error('Error marking read:', err);
        }
    };

    const deleteNotification = async (notifId: string) => {
        setNotifications(prev => prev.filter(n => n.id !== notifId));
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await safeFetch(`${supabaseUrl}/rest/v1/notifications?id=eq.${notifId}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
    };

    const clearNotificationsForJob = async (jobId: string) => {
        setNotifications(prev => prev.filter(n => n.relatedJobId !== jobId));
        try {
            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            await safeFetch(`${supabaseUrl}/rest/v1/notifications?user_id=eq.${user.id}&related_job_id=eq.${jobId}`, { method: 'DELETE' });
        } catch (e) { console.error(e); }
    };

    // Helper to manually add local notification (rarely used now)
    const addNotification = (userId: string, title: string, message: string, type: any = 'INFO', relatedJobId?: string) => {
        const newNotif: Notification = {
            id: `local_${Date.now()}`,
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

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            activeChatId,
            setActiveChatId,
            activeJobId,
            setActiveJobId,
            markNotificationsAsReadForJob,
            deleteNotification,
            clearNotificationsForJob,
            addNotification,
            refreshNotifications: RefreshData,
            markAllAsRead,
            clearAll,
            markAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
