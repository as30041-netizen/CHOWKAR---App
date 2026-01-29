import { Capacitor } from '@capacitor/core';

// Deep link navigation mapping
export interface NotificationData {
    notificationId?: string;
    jobId?: string;
    chatId?: string;
    type?: string;
    bidId?: string;
    reviewId?: string;
}

// Route user based on notification type
export const handleNotificationNavigation = (
    data: NotificationData,
    navigate: (path: string) => void,
    openModal?: (type: string, id: string) => void
) => {
    console.log('[DeepLink] Handling notification tap:', data);

    if (!data) {
        console.warn('[DeepLink] No data in notification');
        return;
    }

    const { type, jobId, chatId, bidId } = data;

    switch (type) {
        case 'new_bid':
        case 'bid_received':
        case 'counter_offer':
        case 'bid_accepted':
        case 'bid_rejected':
            // Navigate to View Bids modal for this job
            if (jobId && openModal) {
                console.log('[DeepLink] Opening View Bids for job:', jobId);
                navigate('/'); // Go to home first
                setTimeout(() => openModal('viewBids', jobId), 500);
            }
            break;

        case 'new_message':
        case 'chat_message':
        case 'chat_unlocked':
            // Open chat for this job
            if (jobId && openModal) {
                console.log('[DeepLink] Opening chat for job:', jobId);
                navigate('/'); // Go to home first
                setTimeout(() => openModal('chat', jobId), 500);
            }
            break;

        case 'job_completed':
        case 'worker_ready':
        case 'job_update':
            // Open job details
            if (jobId && openModal) {
                console.log('[DeepLink] Opening job details:', jobId);
                navigate('/');
                setTimeout(() => openModal('jobDetails', jobId), 500);
            }
            break;

        case 'review_received':
            // Navigate to profile
            console.log('[DeepLink] Opening profile (review received)');
            navigate('/profile');
            break;

        case 'payment_received':


        default:
            // Generic notification - just go to home with notifications panel open
            console.log('[DeepLink] Generic notification, opening notifications panel');
            navigate('/');
            if (openModal) {
                setTimeout(() => {
                    // Trigger notifications panel (you'll need to add this)
                    const notifButton = document.querySelector('[data-notifications-button]');
                    if (notifButton) {
                        (notifButton as HTMLElement).click();
                    }
                }, 500);
            }
    }
};

// Parse notification data from various formats
export const parseNotificationData = (payload: any): NotificationData => {
    // Handle both FCM format and direct format
    const data = payload.data || payload;

    return {
        notificationId: data.notificationId || data.notification_id,
        jobId: data.jobId || data.job_id || data.related_job_id,
        chatId: data.chatId || data.chat_id,
        type: data.type || payload.notification?.tag,
        bidId: data.bidId || data.bid_id,
        reviewId: data.reviewId || data.review_id
    };
};
