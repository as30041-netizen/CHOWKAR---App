import React from 'react';
import { WalletView } from '../components/WalletView';

interface WalletProps {
    onShowBidHistory: () => void;
}

export const Wallet: React.FC<WalletProps> = ({ onShowBidHistory }) => {
    return (
        <div className="pb-24">
            <WalletView onShowBidHistory={onShowBidHistory} />
        </div>
    );
};
