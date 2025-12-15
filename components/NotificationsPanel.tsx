import React from 'react';
import { XCircle, CheckCircle2, Bell } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { supabase } from '../lib/supabase';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onJobClick: (job: any) => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, onJobClick }) => {
    const { user, notifications, setNotifications, t, language } = useUser();
    const { jobs } = useJobs();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white h-full shadow-xl animate-slide-in-right overflow-y-auto">
                <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">{t.notifications}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <XCircle size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    {notifications.filter(n => n.userId === user.id).length === 0 ? (
                        <p className="text-center text-gray-400 py-8">{language === 'en' ? 'No notifications yet' : 'अभी तक कोई सूचना नहीं'}</p>
                    ) : (
                        notifications.filter(n => n.userId === user.id).map(notif => (
                            <div
                                key={notif.id}
                                className={`p-4 rounded-xl border ${notif.read ? 'bg-white border-gray-100' : 'bg-emerald-50 border-emerald-200'}`}
                                onClick={async () => {
                                    if (!notif.read) {
                                        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
                                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                                    }
                                    if (notif.relatedJobId) {
                                        const job = jobs.find(j => j.id === notif.relatedJobId);
                                        if (job) {
                                            onClose();
                                            onJobClick(job);
                                        }
                                    }
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notif.type === 'SUCCESS' ? 'bg-green-100 text-green-600' :
                                        notif.type === 'ERROR' ? 'bg-red-100 text-red-600' :
                                            notif.type === 'WARNING' ? 'bg-yellow-100 text-yellow-600' :
                                                'bg-blue-100 text-blue-600'
                                        }`}>
                                        {notif.type === 'SUCCESS' ? <CheckCircle2 size={20} /> :
                                            notif.type === 'ERROR' ? <XCircle size={20} /> :
                                                <Bell size={20} />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-sm">{notif.title}</h4>
                                        <p className="text-gray-600 text-sm mt-0.5">{notif.message}</p>
                                        <p className="text-xs text-gray-400 mt-1">{new Date(notif.timestamp).toLocaleString()}</p>
                                    </div>
                                    {!notif.read && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
