import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

// Check if running on native platform
export const isPushSupported = () => Capacitor.isNativePlatform();

// Request permission and register for push notifications
export const registerPushNotifications = async (userId: string): Promise<{ success: boolean; token?: string; error?: string }> => {
    if (!isPushSupported()) {
        console.log('[Push] Not on native platform, skipping registration');
        return { success: false, error: 'Not on native platform' };
    }

    try {
        // Request permission
        let permission = await PushNotifications.checkPermissions();

        if (permission.receive !== 'granted') {
            const result = await PushNotifications.requestPermissions();
            if (result.receive !== 'granted') {
                console.log('[Push] Permission denied after request');
                return { success: false, error: 'Permission denied' };
            }
        }

        // Also ensure LocalNotifications permission for foreground alerts
        const localPermission = await LocalNotifications.checkPermissions();
        if (localPermission.display !== 'granted') {
            await LocalNotifications.requestPermissions();
        }

        // Create Notification Channel for Android 8+
        if (Capacitor.getPlatform() === 'android') {
            await PushNotifications.createChannel({
                id: 'chowkar_notifications',
                name: 'General Notifications',
                description: 'General app notifications for messages and bids',
                importance: 5, // High importance
                visibility: 1, // Public
                vibration: true,
            });
        }

        // Register with FCM/APNS
        await PushNotifications.register();

        // Wait for registration to complete and get token
        return new Promise((resolve) => {
            PushNotifications.addListener('registration', async (token: Token) => {
                console.log('[Push] Registration successful, token:', token.value);

                // Save token to database
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ push_token: token.value })
                        .eq('id', userId);

                    if (error) {
                        console.error('[Push] Failed to save token:', error);
                        resolve({ success: true, token: token.value, error: 'Token saved locally but not to DB' });
                    } else {
                        console.log('[Push] Token saved to database');
                        resolve({ success: true, token: token.value });
                    }
                } catch (err: any) {
                    resolve({ success: true, token: token.value, error: err.message });
                }
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                console.error('[Push] Registration error:', error);
                resolve({ success: false, error: error.error || 'Registration failed' });
            });
        });
    } catch (error: any) {
        console.error('[Push] Error:', error);
        return { success: false, error: error.message };
    }
};

// Set up push notification listeners
export const setupPushListeners = (
    onNotificationReceived: (notification: PushNotificationSchema) => void,
    onNotificationClicked: (notification: ActionPerformed) => void
) => {
    if (!isPushSupported()) return;

    // When notification is received while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {

        onNotificationReceived(notification);
    });

    // When user taps on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('[Push] Notification tapped:', action);
        onNotificationClicked(action);
    });
};

// Remove all listeners (call on logout)
export const removePushListeners = async () => {
    if (!isPushSupported()) return;
    await PushNotifications.removeAllListeners();
};
