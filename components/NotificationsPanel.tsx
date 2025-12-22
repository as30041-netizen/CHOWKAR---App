import React from 'react';
import { XCircle, CheckCircle2, Bell, Trash2, CheckCheck } from 'lucide-react';
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
    const { jobs } = useJobs();

    const handleMarkAllRead = async () => {
        try {
            await supabase.rpc('mark_all_notifications_read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Error marking all read:', error);
        }
    };

    const handleClearAll = async () => {
        if (!confirm(t.clearAllPrompt)) return;
        try {
            await supabase.rpc('clear_all_notifications');
            setNotifications(prev => prev.filter(n => n.userId !== user.id)); // Clear current user's notifs locally
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await supabase.rpc('soft_delete_notification', { p_notification_id: id });
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    if (!isOpen) return null;

    const myNotifications = notifications.filter(n => n.userId === user.id);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
            <div className="absolute inset-0 bg-black/40 pointer-events-auto backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-xl animate-slide-in-right flex flex-col pointer-events-auto pt-safe pb-safe transition-colors">
                <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 z-10">
                    <div className="p-4 flex justify-between items-center pb-2">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.notifications}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <XCircle size={20} className="text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                    {myNotifications.length > 0 && (
                        <div className="px-4 pb-3 flex gap-2">
                            <button
                                onClick={handleMarkAllRead}
                                className="text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full font-medium active:scale-95 transition-all"
                            >
                                <CheckCheck size={14} /> {t.markRead}
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="text-xs flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-full font-medium active:scale-95 transition-all"
                            >
                                <Trash2 size={14} /> {t.clearAll}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {myNotifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            <Bell size={48} className="mb-4 opacity-20" />
                            <p>{t.noNotifications}</p>
                        </div>
                    ) : (
                        myNotifications.map(notif => (
                            <div
                                key={notif.id}
                                className={`group relative p-4 rounded-xl border transition-colors ${notif.read ? 'bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-800' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'}`}
                                onClick={async () => {
                                    if (!notif.read) {
                                        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
                                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                    }
                                    if (notif.relatedJobId) {
                                        const job = jobs.find(j => j.id === notif.relatedJobId);
                                        if (job) {
                                            onClose();
                                            onJobClick(job, notif);
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'SUCCESS' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                        notif.type === 'ERROR' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                            notif.type === 'WARNING' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                                'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                        }`}>
                                        {notif.type === 'SUCCESS' ? <CheckCircle2 size={20} /> :
                                            notif.type === 'ERROR' ? <XCircle size={20} /> :
                                                <Bell size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate pr-6">{notif.title}</h4>
                                        <p className="text-gray-600 dark:text-gray-300 text-sm mt-0.5 line-clamp-2">{notif.message}</p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(notif.id, e)}
                                        className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors z-20"
                                    >
                                        <Trash2 size={16} />
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
