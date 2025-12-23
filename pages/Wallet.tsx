import React from 'react';
import { WalletView } from '../components/WalletView';

interface WalletProps {
    onShowBidHistory: () => void;
    onAddMoney: () => void;
}

export const Wallet: React.FC<WalletProps> = ({ onShowBidHistory, onAddMoney }) => {
    return (
        <div className="pb-24 md:pb-6">
            <WalletView onShowBidHistory={onShowBidHistory} onAddMoney={onAddMoney} />
        </div>
    );
};
