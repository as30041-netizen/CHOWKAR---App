import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminConfig {
    bidFee: number;
    subscriptionPrice: number;
}

interface AdminConfigContextType {
    config: AdminConfig;
    isLoading: boolean;


}

const AdminConfigContext = createContext<AdminConfigContextType | undefined>(undefined);

export const AdminConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AdminConfig>({
        bidFee: 0,
        subscriptionPrice: 499
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase.from('global_settings').select('*');
            if (error) throw error;

            const newConfig: AdminConfig = { ...config };
            data?.forEach(setting => {
                if (setting.key === 'bid_fee') newConfig.bidFee = parseInt(setting.value);
            });
            setConfig(newConfig);
        } catch (err) {
            console.error('[AdminConfig] Fetch failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();

        // Subscribe to changes in global_settings for Realtime reactivity
        const channel = supabase
            .channel('global_settings_sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'global_settings' },
                () => {
                    console.log('[AdminConfig] Settings changed. Refreshing...');
                    fetchConfig();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);



    return (
        <AdminConfigContext.Provider value={{ config, isLoading }}>
            {children}
        </AdminConfigContext.Provider>
    );
};

export const useAdminConfig = () => {
    const context = useContext(AdminConfigContext);
    if (!context) {
        throw new Error('useAdminConfig must be used within an AdminConfigProvider');
    }
    return context;
};
