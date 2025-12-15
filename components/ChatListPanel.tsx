import React from 'react';
import { XCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job } from '../types';

interface ChatListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelect: (job: Job) => void;
}

export const ChatListPanel: React.FC<ChatListPanelProps> = ({ isOpen, onClose, onChatSelect }) => {
    const { user, t, language, messages } = useUser();
    const { jobs } = useJobs();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white h-full shadow-xl animate-slide-in-right overflow-y-auto">
                <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">{t.chats || 'Chats'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <XCircle size={20} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    {(() => {
                        // Get jobs where user is poster or accepted worker
                        const chatJobs = jobs.filter(j =>
                            j.status === 'IN_PROGRESS' &&
                            (j.posterId === user.id || j.bids.some(b => b.workerId === user.id && b.status === 'ACCEPTED'))
                        );

                        if (chatJobs.length === 0) {
                            return <p className="text-center text-gray-400 py-8">{language === 'en' ? 'No active chats' : 'कोई सक्रिय चैट नहीं'}</p>;
                        }

                        return chatJobs.map(job => {
                            const lastMsg = messages.filter(m => m.jobId === job.id).slice(-1)[0];
                            const otherPerson = job.posterId === user.id
                                ? job.bids.find(b => b.status === 'ACCEPTED')?.workerName || 'Worker'
                                : job.posterName;

                            return (
                                <button
                                    key={job.id}
                                    onClick={() => { onClose(); onChatSelect(job); }}
                                    className="w-full p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                                            {otherPerson.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h4 className="font-bold text-gray-900 truncate">{otherPerson}</h4>
                                                {lastMsg && <span className="text-xs text-gray-400">{new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                            </div>
                                            <p className="text-sm text-gray-500 truncate">{job.title}</p>
                                            {lastMsg && <p className="text-sm text-gray-400 truncate">{lastMsg.text}</p>}
                                        </div>
                                    </div>
                                </button>
                            );
                        });
                    })()}
                </div>
            </div>
        </div>
    );
};
