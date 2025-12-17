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
      <div className="bg-emerald-600 rounded-2xl p-6 text-white mb-6 shadow-lg relative overflow-hidden animate-pop">
        <Wallet size={150} className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4" />
        <p className="text-emerald-100 text-sm font-medium mb-1">{t.totalBalance}</p>
        <h2 className="text-4xl font-bold mb-4">₹{user.walletBalance}</h2>
        <button onClick={handleAddMoney} className="bg-white text-emerald-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex flex-col items-center leading-none py-1">
          <span>+ {t.addMoney}</span>
          <span className="text-[8px] opacity-70 mt-0.5">(TEST MODE)</span>
        </button>
      </div>
      {role === UserRole.WORKER && (
        <button onClick={onShowBidHistory} className="w-full bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between mb-6">
          <div className="flex items-center gap-4"><div className="bg-orange-100 p-3 rounded-full text-orange-600"><ClipboardList size={24} /></div><div className="text-left"><h4 className="font-bold text-gray-900">{t.bidHistory}</h4></div></div>
          <ChevronRight size={20} className="text-gray-400" />
        </button>
      )}
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><History size={18} /> {t.transactionHistory}</h3>
      <div className="space-y-3">
        {transactions.map(tx => (
          <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
            <div className="flex items-center gap-3"><div className={`p-2 rounded-full ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{tx.type === 'CREDIT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div><div><p className="font-bold text-gray-800 text-sm">{tx.description}</p><p className="text-xs text-gray-400">{new Date(tx.timestamp).toLocaleDateString()}</p></div></div>
            <span className={`font-bold ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount}</span>
          </div>
        ))}
        {transactions.length === 0 && <p className="text-center text-gray-400 text-sm">{t.noTransactions}</p>}
      </div>
    </div>
  );
};