import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const useDeepLinkHandler = (onAuthSuccess?: () => void) => {
    const [isHandlingLink, setIsHandlingLink] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) {
            return; // Only for native apps
        }

        const handleDeepLink = async (url: string) => {
            console.log('[DeepLink] Received URL:', url);
            setIsHandlingLink(true);

            // 1. Generic Navigation Handling (Job Pages, etc.)
            // Handle: in.chowkar.app://job/123 OR https://chowkar.in/job/123
            // Convert custom scheme to standard for parsing if needed, but simple includes check is safer first.

            if (url.includes('/job/')) {
                console.log('[DeepLink] Job URL detected, navigating...');
                // Extract path. try/catch for URL parsing
                try {
                    // Normalize scheme for parsing
                    const safeUrl = url.replace('in.chowkar.app://', 'https://chowkar.app/');
                    const urlObj = new URL(safeUrl);
                    if (urlObj.pathname?.startsWith('/job/')) {
                        navigate(urlObj.pathname);
                        setIsHandlingLink(false);
                        return;
                    }
                } catch (e) {
                    console.warn('[DeepLink] Failed to parse job URL', e);
                }
            }

            // Close the browser after OAuth redirect (if open)
            try {
                await Browser.close();
            } catch (e) {
                // Ignore error if browser wasn't open
            }

            // Handle the OAuth callback
            if (url.includes('in.chowkar.app://callback') || url.includes('capacitor://localhost')) {
                console.log('[DeepLink] Handling OAuth callback');


                try {
                    // Normalize URL to handle custom schemes for standard URL parser
                    // Sometimes custom schemes choke the URL constructor or searchParams if not formatted perfectly
                    const safeUrl = url.replace('in.chowkar.app://', 'https://chowkar.app/');
                    const urlObj = new URL(safeUrl);

                    // Search in both Search Params (?) and Hash (#)
                    let code = urlObj.searchParams.get('code');
                    let access_token = urlObj.searchParams.get('access_token');
                    let refresh_token = urlObj.searchParams.get('refresh_token');
                    let error_description = urlObj.searchParams.get('error_description');
                    const ref = urlObj.searchParams.get('ref');

                    // If not in search params, check hash
                    if (!code && !access_token && urlObj.hash) {
                        const hashParams = new URLSearchParams(urlObj.hash.substring(1)); // remove #
                        code = hashParams.get('code');
                        access_token = hashParams.get('access_token');
                        refresh_token = hashParams.get('refresh_token');
                        error_description = hashParams.get('error_description');
                    }

                    // If a referral code is present in the deep link, save it
                    if (ref) {
                        console.log('[DeepLink] Found referral code:', ref);
                        localStorage.setItem('chowkar_referred_by_code', ref);
                    }

                    // Check for errors first
                    if (error_description) {
                        console.error('[DeepLink] OAuth error:', error_description);
                        setIsHandlingLink(false);
                        return;
                    }

                    // Handle PKCE flow (code parameter)
                    if (code) {
                        console.log('[DeepLink] PKCE flow detected - exchanging code for session');

                        // Let Supabase handle the code exchange automatically
                        // We must pass the EXACT redirect URL used in the signIn call
                        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

                        if (error) {
                            console.error('[DeepLink] Error exchanging code:', error);
                            // If code invalid, maybe we already have a session? 
                            // Don't fail hard yet, let the check below happen.
                        } else if (data.session) {
                            console.log('[DeepLink] Session set successfully from code!');
                            onAuthSuccess?.();
                            // Keep isHandlingLink true for a moment to allow App to reload state
                            setTimeout(() => setIsHandlingLink(false), 1000);
                            return;
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
                            setTimeout(() => setIsHandlingLink(false), 1000);
                            return;
                        }
                    }

                    // Fallback: try to get existing session
                    // This handles cases where Supabase client might have auto-detected url from the browser switch
                    console.log('[DeepLink] Checking for existing session (Fallback)');
                    const { data, error } = await supabase.auth.getSession();

                    if (error) {
                        console.error('[DeepLink] Error getting session:', error);
                    } else if (data.session) {
                        console.log('[DeepLink] Found existing session!');
                        onAuthSuccess?.();
                    } else {
                        console.warn('[DeepLink] No session found after OAuth callback');
                    }
                } catch (err) {
                    console.error('[DeepLink] Error handling deep link:', err);
                }
            }

            setIsHandlingLink(false);
        };

        // Listen for app URL open events (deep links)
        let listenerHandle: any = null;

        CapacitorApp.addListener('appUrlOpen', (event) => {
            handleDeepLink(event.url);
        }).then(handle => {
            listenerHandle = handle;
        });

        // Also check if app was opened with a URL
        CapacitorApp.getLaunchUrl().then((launchUrl) => {
            if (launchUrl?.url) {
                handleDeepLink(launchUrl.url);
            }
        });

        return () => {
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [onAuthSuccess]);

    return { isHandlingLink };
};
