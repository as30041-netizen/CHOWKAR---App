import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export const useDeepLinkHandler = (onAuthSuccess?: () => void) => {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            return; // Only for native apps
        }

        const handleDeepLink = async (url: string) => {
            console.log('[DeepLink] Received URL:', url);

            // Close the browser after OAuth redirect
            await Browser.close();

            // Handle the OAuth callback
            if (url.includes('in.chowkar.app://callback') || url.includes('capacitor://localhost')) {
                console.log('[DeepLink] Handling OAuth callback');

                try {
                    // Parse URL to check what we received
                    const urlObj = new URL(url);
                    const code = urlObj.searchParams.get('code');
                    const access_token = urlObj.searchParams.get('access_token');
                    const refresh_token = urlObj.searchParams.get('refresh_token');
                    const error_description = urlObj.searchParams.get('error_description');

                    // Check for errors first
                    if (error_description) {
                        console.error('[DeepLink] OAuth error:', error_description);
                        return;
                    }

                    // Handle PKCE flow (code parameter)
                    if (code) {
                        console.log('[DeepLink] PKCE flow detected - exchanging code for session');

                        // Let Supabase handle the code exchange automatically
                        // This happens when detectSessionInUrl is enabled
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                        if (error) {
                            console.error('[DeepLink] Error exchanging code:', error);
                        } else if (data.session) {
                            console.log('[DeepLink] Session set successfully from code!');
                            onAuthSuccess?.();
                        }
                    }
                    // Handle implicit flow (direct tokens)
                    else if (access_token && refresh_token) {
                        console.log('[DeepLink] Implicit flow detected - setting session from tokens');
                        const { error } = await supabase.auth.setSession({
                            access_token,
                            refresh_token,
                        });

                        if (error) {
                            console.error('[DeepLink] Error setting session:', error);
                        } else {
                            console.log('[DeepLink] Session set successfully from tokens!');
                            onAuthSuccess?.();
                        }
                    }
                    // Fallback: try to get existing session
                    else {
                        console.log('[DeepLink] No code or tokens found, checking for existing session');
                        const { data, error } = await supabase.auth.getSession();

                        if (error) {
                            console.error('[DeepLink] Error getting session:', error);
                        } else if (data.session) {
                            console.log('[DeepLink] Found existing session!');
                            onAuthSuccess?.();
                        } else {
                            console.warn('[DeepLink] No session found after OAuth callback');
                        }
                    }
                } catch (err) {
                    console.error('[DeepLink] Error handling deep link:', err);
                }
            }
        };

        // Listen for app URL open events (deep links)
        const listener = CapacitorApp.addListener('appUrlOpen', (event) => {
            handleDeepLink(event.url);
        });

        // Also check if app was opened with a URL
        CapacitorApp.getLaunchUrl().then((launchUrl) => {
            if (launchUrl?.url) {
                handleDeepLink(launchUrl.url);
            }
        });

        return () => {
            listener.remove();
        };
    }, [onAuthSuccess]);
};
