import React from 'react';
import { XCircle, CheckCircle2, Bell, Trash2, CheckCheck, Inbox, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';

import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, Notification } from '../types';
import { useSwipe } from '../hooks/useSwipe';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onJobClick: (job: Job, notif: Notification) => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, onJobClick }) => {
    const { user, t, language } = useUser();
    const {
        notifications,
        markAllAsRead,
        clearAll,
        deleteNotification,
        markAsRead
    } = useNotification();

    const { jobs, getJobWithFullDetails } = useJobs();

    // Swipe to Close
    const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp } = useSwipe({
        onSwipeRight: onClose,
        threshold: 50
    });

    const handleMarkAllRead = async () => {
        await markAllAsRead();
    };

    const handleClearAll = async () => {
        await clearAll();
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await deleteNotification(id);
    };


    if (!isOpen) return null;

    const myNotifications = notifications.filter(n => n.userId === user.id);

    return (
        <div className="fixed inset-0 z-[110] flex items-start justify-end pointer-events-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl pointer-events-auto animate-fade-in" onClick={onClose} />
            <div className="relative w-full max-w-[360px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-3xl h-full shadow-[-10px_0_30px_rgba(0,0,0,0.05)] animate-slide-left duration-500 flex flex-col pt-safe transition-all pointer-events-auto border-l border-gray-100 dark:border-gray-800">

                {/* Header Section - Ultra Compact */}
                <div className="shrink-0 z-10 px-4 py-3 flex flex-col justify-end border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-all active:scale-95 md:hidden"
                        >
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">{t.notifications}</h2>
                    </div>
                </div>

                {/* Quick Actions Bar - Compact */}
                {myNotifications.length > 0 && (
                    <div className="px-4 py-2 flex gap-2 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-800/50">
                        <button
                            onClick={handleMarkAllRead}
                            className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-emerald-100"
                        >
                            <CheckCheck size={12} strokeWidth={2.5} /> {t.markRead}
                        </button>
                        <button
                            onClick={handleClearAll}
                            className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 border border-gray-100"
                        >
                            <Trash2 size={12} strokeWidth={2.5} /> {t.clearAll}
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
                                className={`group relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer active:scale-[0.98] ${notif.read
                                    ? 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/40'
                                    : 'bg-white dark:bg-gray-900 border-emerald-500/10 dark:border-emerald-500/20 shadow-sm'}`}
                                onClick={async () => {
                                    if (!notif.read) {
                                        await markAsRead(notif.id);
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
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 group-hover:rotate-6 ${notif.type === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' :
                                        notif.type === 'ERROR' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800/50' :
                                            notif.type === 'WARNING' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50' :
                                                'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'
                                        }`}>
                                        {notif.type === 'SUCCESS' ? <CheckCircle2 size={20} strokeWidth={2.5} /> :
                                            notif.type === 'ERROR' ? <XCircle size={20} strokeWidth={2.5} /> :
                                                <Bell size={20} strokeWidth={2.5} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-gray-900 dark:text-white text-sm leading-tight pr-8">{notif.title}</h4>
                                            {!notif.read && <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse shrink-0 mt-1"></span>}
                                        </div>
                                        <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2 leading-relaxed mb-3">{notif.message}</p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-wider">{new Date(notif.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                                            {notif.relatedJobId && <div className="text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"><ArrowRight size={14} strokeWidth={3} /></div>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(notif.id, e)}
                                        className="absolute top-4 right-4 p-1.5 text-gray-300 dark:text-gray-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all z-20 opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} strokeWidth={2.5} />
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
