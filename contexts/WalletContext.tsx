import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useUser } from './UserContextDB';

interface WalletContextType {
    walletBalance: number;
    refreshWallet: () => Promise<void>;
    isLoading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user, isAuthLoading, hasInitialized } = useUser();
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const refreshWallet = useCallback(async () => {
        // Only fetch if auth is NOT loading AND we have a valid confirmed user ID
        // AND Supabase has finished its initial session check.
        if (isAuthLoading || !hasInitialized || !user?.id) {
            return;
        }

        try {

            const { safeFetch } = await import('../services/fetchUtils');
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

            const response = await safeFetch(`${supabaseUrl}/rest/v1/wallets?user_id=eq.${user.id}&select=balance`);

            if (!response.ok) {
                throw new Error(`Wallet fetch failed: ${response.status}`);
            }

            const data = await response.json();
            if (data && data.length > 0) {
                setWalletBalance(data[0].balance);
            } else {
                setWalletBalance(0);
            }
        } catch (err) {
            console.error('[Wallet] Exception during fetch', err);
        }
    }, [user?.id, isAuthLoading, hasInitialized]);

    // 2. Realtime Subscription
    useEffect(() => {
        if (!hasInitialized || isAuthLoading || !user?.id) return;

        const channel = supabase
            .channel(`wallet_changes_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'wallets',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {

                if (payload.new && (payload.new as any).balance !== undefined) {
                    setWalletBalance((payload.new as any).balance);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, isAuthLoading, hasInitialized]);

    // 1. Initial fetch when user ID changes and auth is ready
    useEffect(() => {
        if (hasInitialized && !isAuthLoading && user?.id) {
            // Prevent multiple parallel fetches if already loading
            if (isLoading) return;

            setIsLoading(true);
            refreshWallet().finally(() => setIsLoading(false));
        } else if (hasInitialized && !isAuthLoading && !user?.id) {
            setWalletBalance(0);
        }
    }, [user?.id, isAuthLoading, hasInitialized, refreshWallet]);

    return (
        <WalletContext.Provider value={{ walletBalance, refreshWallet, isLoading }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};
