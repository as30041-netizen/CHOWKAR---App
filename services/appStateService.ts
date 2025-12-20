import { App as CapacitorApp, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let appIsActive = true;
let isLoggedIn = false;

// Track app foreground/background state
export const initializeAppStateTracking = () => {
    if (!Capacitor.isNativePlatform()) {
        console.log('[AppState] Not on native platform, skipping state tracking');
        return;
    }

    CapacitorApp.addListener('appStateChange', (state: AppState) => {
        appIsActive = state.isActive;
        console.log('[AppState] App is now:', appIsActive ? 'FOREGROUND' : 'BACKGROUND');
    });

    console.log('[AppState] State tracking initialized');
};

// Update login state (call when user logs in/out)
export const setAppLoginState = (loggedIn: boolean) => {
    isLoggedIn = loggedIn;
    console.log('[AppState] Login state:', loggedIn ? 'LOGGED IN' : 'LOGGED OUT');
};

// Check if we should send push notification
export const shouldSendPushNotification = (): boolean => {
    // Only send push if:
    // 1. User is logged in AND
    // 2. App is in background/minimized

    if (!isLoggedIn) {
        console.log('[AppState] NO PUSH: User not logged in');
        return false;
    }

    if (appIsActive) {
        console.log('[AppState] NO PUSH: App is in foreground (use in-app notification)');
        return false;
    }

    console.log('[AppState] ✅ SEND PUSH: App in background + user logged in');
    return true;
};

// Get current app state
export const getAppState = () => ({
    isActive: appIsActive,
    isLoggedIn: isLoggedIn,
    shouldSendPush: shouldSendPushNotification()
});

// Cleanup (call on app unmount)
export const cleanupAppStateTracking = async () => {
    if (Capacitor.isNativePlatform()) {
        await CapacitorApp.removeAllListeners();
    }
};
