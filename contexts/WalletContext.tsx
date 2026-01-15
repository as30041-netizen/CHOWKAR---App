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
            console.log('[Wallet] Fetching balance for:', user.id);
            const { data, error } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setWalletBalance(data.balance);
            } else if (error) {
                // If it's a "no rows" error, it might be a new user or RLS block.
                // We ONLY set to 0 if we are sure it's not a temporary auth glitch.
                if (error.code === 'PGRST116') {
                    setWalletBalance(0);
                }
                console.warn('[Wallet] Fetch error:', error);
            }
        } catch (err) {
            console.error('[Wallet] Exception during fetch', err);
        }
    }, [user?.id, isAuthLoading, hasInitialized]);

    // Initial fetch when user ID changes and auth is ready
    useEffect(() => {
        if (hasInitialized && !isAuthLoading && user?.id) {
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
