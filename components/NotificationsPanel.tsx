import React from 'react';
import { XCircle, CheckCircle2, Bell, Trash2, CheckCheck, Inbox, ArrowRight } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { supabase } from '../lib/supabase';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onJobClick: (job: any, notification: any) => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, onJobClick }) => {
    const { user, notifications, setNotifications, t, language } = useUser();
    const { jobs, getJobWithFullDetails } = useJobs();

    const handleMarkAllRead = async () => {
        try {
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('mark_all_notifications_read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    const handleClearAll = async () => {
        if (!confirm(t.clearAllPrompt)) return;
        try {
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('clear_all_notifications');
            setNotifications(prev => prev.filter(n => n.userId !== user.id)); // Clear current user's notifs locally
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('soft_delete_notification', { p_notification_id: id });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    if (!isOpen) return null;

    const myNotifications = notifications.filter(n => n.userId === user.id);

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-end pointer-events-none">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-white/95 dark:bg-gray-950/95 backdrop-blur-3xl h-full shadow-[-32px_0_128px_-16px_rgba(0,0,0,0.3)] animate-slide-left duration-500 flex flex-col pt-safe transition-all pointer-events-auto border-l-4 border-white/20 dark:border-gray-800/50">

                {/* Header Section */}
                <div className="shrink-0 z-10 p-8 flex justify-between items-end border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                            <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.4em] leading-none">Your Updates</h4>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">{t.notifications}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-4 rounded-[1.5rem] bg-gray-50 dark:bg-gray-900 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-90 border-2 border-gray-100 dark:border-gray-800 shadow-sm"
                    >
                        <XCircle size={28} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Quick Actions Bar */}
                {myNotifications.length > 0 && (
                    <div className="px-8 py-4 flex gap-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800/50">
                        <button
                            onClick={handleMarkAllRead}
                            className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-500 text-white rounded-2xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-95"
                        >
                            <CheckCheck size={16} strokeWidth={3} /> {t.markRead}
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 rounded-2xl hover:text-red-500 border-2 border-gray-100 dark:border-gray-800 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Trash2 size={16} strokeWidth={3} /> {t.clearAll}
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {myNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center px-10">
                            <div className="w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-[3rem] flex items-center justify-center mb-8 border-4 border-white dark:border-gray-800 shadow-glass animate-pulse-subtle">
                                <Inbox size={56} className="text-gray-200 dark:text-gray-700" strokeWidth={1} />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">All Caught Up!</h3>
                            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium leading-relaxed max-w-[240px]">
                                Your inbox is clean. We'll let you know when something important happens!
                            </p>
                        </div>
                    ) : (
                        myNotifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`group relative p-6 rounded-[2.5rem] border-4 transition-all duration-300 cursor-pointer active:scale-[0.98] ${notif.read
                                    ? 'bg-white/50 dark:bg-gray-900/30 border-white dark:border-gray-900/50 opacity-80 hover:opacity-100'
                                    : 'bg-white dark:bg-gray-900 border-emerald-500/10 dark:border-emerald-500/20 shadow-xl shadow-emerald-500/5'}`}
                                onClick={async () => {
                                    if (!notif.read) {
                                        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
                                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                    }
                                    if (notif.relatedJobId) {
                                        onClose();
                                        let job = jobs.find(j => j.id === notif.relatedJobId);
                                        if (job) onJobClick(job, notif);
                                        else {
                                            getJobWithFullDetails(notif.relatedJobId).then(fetchedJob => {
                                                if (fetchedJob) onJobClick(fetchedJob, notif);
                                            });
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-start gap-5">
                                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-glass border-4 transition-all duration-500 group-hover:rotate-6 ${notif.type === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' :
                                        notif.type === 'ERROR' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50' :
                                            notif.type === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50' :
                                                'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'
                                        }`}>
                                        {notif.type === 'SUCCESS' ? <CheckCircle2 size={32} strokeWidth={2.5} /> :
                                            notif.type === 'ERROR' ? <XCircle size={32} strokeWidth={2.5} /> :
                                                <Bell size={32} strokeWidth={2.5} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-black text-gray-900 dark:text-white text-lg leading-tight pr-8 tracking-tight">{notif.title}</h4>
                                            {!notif.read && <span className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse shrink-0"></span>}
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 leading-relaxed font-medium mb-4">{notif.message}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.2em] bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-800">{new Date(notif.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                                            {notif.relatedJobId && <div className="text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0"><ArrowRight size={18} strokeWidth={3} /></div>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(notif.id, e)}
                                        className="absolute top-6 right-6 p-2 text-gray-300 dark:text-gray-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all z-20 opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={20} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
