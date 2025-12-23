import React from 'react';
import { useUser } from '../contexts/UserContextDB';
import { UserRole } from '../types';
import { Wallet, ClipboardList, ChevronRight, History, ArrowDownLeft, ArrowUpRight, Users, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';


interface WalletViewProps {
  onShowBidHistory: () => void;
  onAddMoney: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onShowBidHistory, onAddMoney }) => {
  const { user, role, transactions, t, language } = useUser();

  return (
    <div className="p-4 animate-fade-in">
      <div className="bg-emerald-600 dark:bg-emerald-700 rounded-2xl p-6 text-white mb-6 shadow-lg relative overflow-hidden animate-pop transition-colors">
        <Wallet size={150} className="absolute right-0 top-0 opacity-10 translate-x-1/4 -translate-y-1/4" />
        <p className="text-emerald-100 text-sm font-medium mb-1">{t.commissionCredits}</p>
        <h2 className="text-4xl font-bold mb-4">₹{user.walletBalance || 0}</h2>
        <div className="flex gap-2">
          <button
            onClick={onAddMoney}
            className="bg-white text-emerald-700 dark:bg-gray-900 dark:text-emerald-400 px-4 py-3 rounded-xl text-sm font-bold shadow-sm flex items-center justify-center gap-2 flex-1 transition-all active:scale-95 hover:bg-emerald-50 dark:hover:bg-gray-800"
          >
            <ArrowDownLeft size={18} />
            <span>{t.addCredits}</span>
          </button>
        </div>
      </div>
      {/* Refer & Earn Section */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6 shadow-lg relative overflow-hidden animate-pop delay-100 transition-colors">
        <Users size={120} className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4" />
        <div className="relative z-10">
          <h3 className="text-xl font-black mb-1 flex items-center gap-2">
            {language === 'en' ? 'Refer & Earn ₹50! 🎁' : 'रेफर करें और ₹50 कमाएं! 🎁'}
          </h3>
          <p className="text-indigo-100 text-xs mb-4">
            {language === 'en'
              ? 'Get ₹50 for every friend who joins using your code!'
              : 'अपने दोस्तों को जोड़ें और हर जॉइनिंग पर ₹50 पाएं!'}
          </p>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-indigo-100 font-bold mb-0.5">
                {language === 'en' ? 'Your Code' : 'आपका कोड'}
              </p>
              <p className="text-lg font-black tracking-widest leading-none">{user.referralCode || '...'}</p>
            </div>
            <button
              onClick={async () => {
                const shareText = language === 'en'
                  ? `Hey! Join CHOWKAR and get ₹100 instantly in your wallet to find work or hire workers! Use my code: ${user.referralCode}\n\nDownload now: `
                  : `हेल्लो! CHOWKAR जॉइन करें और पाएँ ₹100 तुरंत! मेरा कोड उपयोग करें: ${user.referralCode}\n\nअभी डाउनलोड करें: `;

                const shareUrl = `https://chowkar.in/?ref=${user.referralCode}`;

                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'Join CHOWKAR',
                      text: shareText,
                      url: shareUrl
                    });
                  } catch (err) {
                    console.warn('Share failed', err);
                  }
                } else {
                  // Fallback: Copy to clipboard
                  navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                  alert(language === 'en' ? 'Link copied to clipboard!' : 'लिंक कॉपी हो गया!');
                }
              }}
              className="bg-white text-indigo-600 px-4 py-2 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 active:scale-95 transition-all"
            >
              <Share2 size={14} />
              {language === 'en' ? 'SHARE' : 'शेयर करें'}
            </button>
          </div>
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
