import React from 'react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';
import { Wallet, ClipboardList, ChevronRight, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { supabase } from '../lib/supabase';


interface WalletViewProps {
  onShowBidHistory: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onShowBidHistory }) => {
  const { user, setUser, role, transactions, setTransactions, t } = useUser();

  // TEST MODE: Add money to DB
  const handleAddMoney = async () => {
    try {
      const amountToAdd = 100;

      // Use Secure RPC
      const { data, error } = await supabase
        .rpc('process_transaction', {
          p_amount: amountToAdd,
          p_type: 'CREDIT',
          p_description: 'Test Mode: Added Money'
        });

      if (error) throw error;

      // data contains { new_balance, transaction_id }
      const { new_balance, transaction_id } = data;

      // 3. Update Local State
      setUser(p => ({ ...p, walletBalance: new_balance }));

      const newTx = {
        id: transaction_id,
        userId: user.id,
        amount: amountToAdd,
        type: 'CREDIT' as const,
        description: 'Test Mode: Added Money',
        timestamp: Date.now()
      };

      setTransactions(prev => [newTx, ...prev]);

    } catch (error) {
      console.error('Error adding money:', error);
      alert(`Failed to add money: ${error.message || JSON.stringify(error)}`);
    }
  };

  return (
    <div className="p-4 animate-fade-in">
      <div className="bg-emerald-600 dark:bg-emerald-700 rounded-2xl p-6 text-white mb-6 shadow-lg relative overflow-hidden animate-pop transition-colors">
        <Wallet size={150} className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4" />
        <p className="text-emerald-100 text-sm font-medium mb-1">{t.commissionCredits}</p>
        <h2 className="text-4xl font-bold mb-4">₹{user.walletBalance || 0}</h2>
        <div className="flex gap-2">
          <button onClick={handleAddMoney} className="bg-white text-emerald-700 dark:bg-gray-900 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex flex-col items-center leading-none py-1 flex-1 transition-colors">
            <span>+ {t.addCredits}</span>
            <span className="text-[8px] opacity-70 mt-0.5">(TEST MODE)</span>
          </button>
          <button disabled className="bg-emerald-700/50 dark:bg-black/20 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex flex-col items-center justify-center leading-none py-1 flex-1 opacity-60 cursor-not-allowed">
            <span>{t.withdraw}</span>
          </button>
        </div>
      </div>
      {role === UserRole.WORKER && (
        <button onClick={onShowBidHistory} className="w-full bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between mb-6 transition-colors">
          <div className="flex items-center gap-4"><div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full text-orange-600 dark:text-orange-400"><ClipboardList size={24} /></div><div className="text-left"><h4 className="font-bold text-gray-900 dark:text-white">{t.bidHistory}</h4></div></div>
          <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />
        </button>
      )}
      <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 transition-colors"><History size={18} /> {t.transactionHistory}</h3>
      <div className="space-y-3">
        {transactions.map(tx => (
          <div key={tx.id} className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 flex justify-between items-center transition-colors">
            <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${tx.type === 'CREDIT' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>{tx.type === 'CREDIT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div><div><p className="font-bold text-gray-800 dark:text-white text-sm">{tx.description}</p><p className="text-xs text-gray-400 dark:text-gray-500">{new Date(tx.timestamp).toLocaleDateString()}</p></div></div>
            <span className={`font-bold ${tx.type === 'CREDIT' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount}</span>
          </div>
        ))}
        {transactions.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm">{t.noTransactions}</p>}
      </div>
    </div>
  );
};