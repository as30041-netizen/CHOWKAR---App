import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, Search, Filter, Phone, Briefcase, ChevronRight } from 'lucide-react';
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
    const { user, t, language, messages: liveMessages, notifications } = useUser();
    const { jobs } = useJobs();
    const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(true);

    // UX States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'AS_WORKER' | 'AS_POSTER'>('ALL');

    // 1. Get all active chat interactions
    const allChatJobs = useMemo(() => {
        return jobs.filter(j =>
            j.status === 'IN_PROGRESS' &&
            (j.posterId === user.id || j.bids.some(b => b.workerId === user.id && b.status === 'ACCEPTED'))
        );
    }, [jobs, user.id]);

    // 2. Fetch last messages for previews (only once on open or when job list changes)
    useEffect(() => {
        if (!isOpen) return;

        const fetchPreviews = async () => {
            setIsLoadingPreviews(true);
            const map: Record<string, ChatMessage> = {};

            // Parallel fetch for speed
            await Promise.all(allChatJobs.map(async (job) => {
                const { data } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('job_id', job.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (data) {
                    map[job.id] = {
                        id: data.id,
                        jobId: data.job_id,
                        senderId: data.sender_id,
                        text: data.text,
                        translatedText: data.translated_text,
                        timestamp: new Date(data.created_at).getTime()
                    };
                }
            }));

            setLastMessagesMap(map);
            setIsLoadingPreviews(false);
        };

        fetchPreviews();
    }, [isOpen, allChatJobs]);

    // 3. Filter Logic
    const filteredJobs = useMemo(() => {
        return allChatJobs.filter(job => {
            // Role Filter
            if (activeTab === 'AS_POSTER' && job.posterId !== user.id) return false;
            if (activeTab === 'AS_WORKER' && job.posterId === user.id) return false;

            // Determine display name for search
            const otherPersonName = job.posterId === user.id
                ? (job.bids.find(b => b.status === 'ACCEPTED')?.workerName || 'Worker')
                : job.posterName;

            // Search Filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return otherPersonName.toLowerCase().includes(searchLower) ||
                    job.title.toLowerCase().includes(searchLower);
            }

            return true;
        });
    }, [allChatJobs, activeTab, searchTerm, user.id]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-gray-100">

                {/* Header */}
                <div className="bg-white px-4 py-4 border-b border-gray-100 z-10 sticky top-0">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">{t.chats || 'Messages'}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <XCircle size={22} className="text-gray-400 hover:text-gray-600" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search chats or jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex p-1 bg-gray-50 rounded-lg">
                        {(['ALL', 'AS_WORKER', 'AS_POSTER'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {tab === 'ALL' ? 'All' : tab === 'AS_WORKER' ? 'My Jobs' : 'Hiring'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoadingPreviews ? (
                        // Skeleton Loading State
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-100 animate-pulse">
                                <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))
                    ) : filteredJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <Briefcase className="text-gray-300" size={32} />
                            </div>
                            <p className="text-gray-500 font-medium">No conversations found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {searchTerm ? 'Try a different search term' : 'Active jobs will appear here'}
                            </p>
                        </div>
                    ) : (
                        filteredJobs.map(job => {
                            // Determine latest message (Live vs DB)
                            const liveLastMsg = liveMessages.filter(m => m.jobId === job.id).slice(-1)[0];
                            const fetchedLastMsg = lastMessagesMap[job.id];

                            let lastMsg: ChatMessage | undefined;
                            if (liveLastMsg && fetchedLastMsg) {
                                lastMsg = liveLastMsg.timestamp > fetchedLastMsg.timestamp ? liveLastMsg : fetchedLastMsg;
                            } else {
                                lastMsg = liveLastMsg || fetchedLastMsg;
                            }

                            // Determine Other Person Details
                            const isPoster = job.posterId === user.id;
                            const acceptedBid = job.bids.find(b => b.status === 'ACCEPTED');
                            const otherPerson = isPoster
                                ? (acceptedBid?.workerName || 'Worker')
                                : job.posterName;

                            const otherPersonPhoto = isPoster
                                ? acceptedBid?.workerPhoto
                                : job.posterPhoto;

                            const otherPersonPhone = isPoster
                                ? acceptedBid?.workerPhone
                                : job.posterPhone;

                            // Formatter for time
                            const timeDisplay = lastMsg
                                ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : null;

                            const hasUnread = notifications.some(n => n.relatedJobId === job.id && !n.read && n.title === "New Message");

                            return (
                                <button
                                    key={job.id}
                                    onClick={() => { onClose(); onChatSelect(job); }}
                                    className="w-full text-left bg-white p-3 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="relative">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 border border-white shadow-sm flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                                                {otherPersonPhoto ? (
                                                    <img src={otherPersonPhoto} alt={otherPerson} className="w-full h-full object-cover" />
                                                ) : (
                                                    otherPerson.charAt(0)
                                                )}
                                            </div>
                                            {/* Online Dot (Mocked/Shared state would go here) */}
                                            {/* <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div> */}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pt-0.5">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <h4 className={`font-bold truncate pr-2 group-hover:text-emerald-700 transition-colors ${hasUnread ? 'text-gray-900' : 'text-gray-900'}`}>
                                                    {otherPerson}
                                                    {hasUnread && <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>}
                                                </h4>
                                                {timeDisplay && (
                                                    <span className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                                                        {timeDisplay}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isPoster ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                                                    }`}>
                                                    {isPoster ? 'Hiring' : 'Job'}
                                                </span>
                                                <p className="text-xs font-medium text-gray-500 truncate">{job.title}</p>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm truncate ${lastMsg ? 'text-gray-600' : 'text-emerald-600 italic'}`}>
                                                    {lastMsg
                                                        ? (lastMsg.translatedText || lastMsg.text)
                                                        : 'Start the conversation...'
                                                    }
                                                </p>

                                                {/* Hover Action Arrow */}
                                                <ChevronRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                            </div>
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
