
import { safeFetch } from './fetchUtils';
import { Notification } from '../types';

const NOTIFICATIONS_LIMIT = 50;

/**
 * Fetch notifications for a specific user using standardized safeFetch.
 */
export const fetchUserNotifications = async (userId: string): Promise<{ notifications: Notification[]; error?: string }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    try {
        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/notifications?user_id=eq.${userId}&order=created_at.desc&limit=${NOTIFICATIONS_LIMIT}`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch notifications: ${response.status}`);
        }

        const data = await response.json();

        const notifications: Notification[] = data.map((notif: any) => ({
            id: notif.id,
            userId: notif.user_id,
            title: notif.title,
            message: notif.message,
            type: notif.type as 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR',
            read: notif.read,
            timestamp: new Date(notif.created_at).getTime(),
            relatedJobId: notif.related_job_id || undefined
        }));

        return { notifications };
    } catch (error: any) {
        console.error('[NotificationService] Error:', error);
        return { notifications: [], error: error.message || 'Failed to load notifications' };
    }
};
