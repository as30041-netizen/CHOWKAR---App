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
    const { user } = useUser();
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const refreshWallet = useCallback(async () => {
        if (!user?.id) {
            setWalletBalance(0);
            return;
        }

        try {
            // Don't set global loading state for background refreshes to avoid partial UI flickers
            // We only track it if needed for initial load logic locally
            const { data, error } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setWalletBalance(data.balance);
            } else if (error && error.code === 'PGRST116') {
                // Wallet doesn't exist yet (should be created by trigger, but fail safe)
                setWalletBalance(0);
            }
        } catch (err) {
            console.error('[Wallet] Fetch failed', err);
        }
    }, [user?.id]);

    // Initial fetch when user ID changes
    useEffect(() => {
        if (user?.id) {
            setIsLoading(true);
            refreshWallet().finally(() => setIsLoading(false));
        } else {
            setWalletBalance(0);
        }
    }, [user?.id, refreshWallet]);

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
