import React, { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';

interface ChatListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelect: (job: Job) => void;
}

export const ChatListPanel: React.FC<ChatListPanelProps> = ({ isOpen, onClose, onChatSelect }) => {
    const { user, t, language, messages } = useUser();
    const { jobs } = useJobs();
    const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});

    // Get active chat jobs
    const chatJobs = jobs.filter(j =>
        j.status === 'IN_PROGRESS' &&
        (j.posterId === user.id || j.bids.some(b => b.workerId === user.id && b.status === 'ACCEPTED'))
    );

    // Fetch summaries when panel opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchLastMessages = async () => {
            // We fetch the last message for each active chat to show a preview
            // This avoids fetching the entire message history globally
            for (const job of chatJobs) {
                const { data } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('job_id', job.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (data) {
                    const msg: ChatMessage = {
                        id: data.id,
                        jobId: data.job_id,
                        senderId: data.sender_id,
                        text: data.text,
                        timestamp: new Date(data.created_at).getTime()
                    };
                    setLastMessagesMap(prev => ({ ...prev, [job.id]: msg }));
                }
            }
        };

        fetchLastMessages();
    }, [isOpen, chatJobs.length]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto border-l border-gray-100">
                <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {t.chats || 'Chats'}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{chatJobs.length}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <XCircle size={22} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    {chatJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <p>{language === 'en' ? 'No active chats' : 'कोई सक्रिय चैट नहीं'}</p>
                        </div>
                    ) : (
                        chatJobs.map(job => {
                            // Logic to pick the NEWEST message between Live (Realtime) and Database (fetched summary)
                            const liveLastMsg = messages.filter(m => m.jobId === job.id).slice(-1)[0];
                            const fetchedLastMsg = lastMessagesMap[job.id];

                            let lastMsg: ChatMessage | undefined = undefined;

                            if (liveLastMsg && fetchedLastMsg) {
                                lastMsg = liveLastMsg.timestamp > fetchedLastMsg.timestamp ? liveLastMsg : fetchedLastMsg;
                            } else {
                                lastMsg = liveLastMsg || fetchedLastMsg;
                            }

                            const otherPerson = job.posterId === user.id
                                ? job.bids.find(b => b.status === 'ACCEPTED')?.workerName || 'Worker'
                                : job.posterName;

                            const otherPersonPhoto = job.posterId === user.id
                                ? job.bids.find(b => b.status === 'ACCEPTED')?.workerPhoto
                                : job.posterPhoto;

                            return (
                                <button
                                    key={job.id}
                                    onClick={() => { onClose(); onChatSelect(job); }}
                                    className="w-full p-4 bg-white rounded-2xl border border-gray-100 hover:bg-emerald-50/50 hover:border-emerald-100 text-left transition-all shadow-sm hover:shadow-md group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold overflow-hidden border border-emerald-200">
                                            {otherPersonPhoto ? (
                                                <img src={otherPersonPhoto} alt={otherPerson} className="w-full h-full object-cover" />
                                            ) : (
                                                otherPerson.charAt(0)
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className="font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{otherPerson}</h4>
                                                {lastMsg && <span className="text-[10px] font-bold text-gray-400">{new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                            </div>
                                            <p className="text-xs font-medium text-emerald-600 truncate mb-0.5">{job.title}</p>
                                            {lastMsg ? (
                                                <p className="text-sm text-gray-500 truncate">{lastMsg.translatedText || lastMsg.text}</p>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">Start chatting...</p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
