import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, Search, Filter, Phone, Briefcase, ChevronRight, MoreVertical, Archive, Trash2, FileText } from 'lucide-react';
import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { Job, ChatMessage } from '../types';
import { supabase } from '../lib/supabase';

interface ChatListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelect: (job: Job, receiverId?: string) => void;
}

export const ChatListPanel: React.FC<ChatListPanelProps> = ({ isOpen, onClose, onChatSelect }) => {
    const { user, t, language, messages: liveMessages, notifications } = useUser();
    const { jobs } = useJobs();
    const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});
    const [isLoadingPreviews, setIsLoadingPreviews] = useState(true);

    // UX States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'AS_WORKER' | 'AS_POSTER'>('ALL');
    const [showArchived, setShowArchived] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set());
    const [deletedChats, setDeletedChats] = useState<Set<string>>(new Set());

    // 1. Get all potentially relevant jobs (before message check)
    const relevantJobs = useMemo(() => {
        return jobs.filter(j => {
            // Basic status check
            const isValidStatus = j.status === 'IN_PROGRESS' || j.status === 'COMPLETED' || j.status === 'OPEN';
            if (!isValidStatus) return false;

            // User must be involved
            const isPoster = j.posterId === user.id;
            const isBidder = j.bids.some(b => b.workerId === user.id);
            if (!isPoster && !isBidder) return false;

            // Must have accepted bid OR be IN_PROGRESS/COMPLETED
            const hasAcceptedBid = j.bids.some(b => b.status === 'ACCEPTED');
            const isActive = j.status === 'IN_PROGRESS' || j.status === 'COMPLETED';

            // Only require accepted bid for OPEN jobs
            if (j.status === 'OPEN' && !hasAcceptedBid) {
                // Check if there are live messages for this job
                const hasLiveMessages = liveMessages.some(m => m.jobId === j.id);
                if (!hasLiveMessages) return false;
            }

            // Filter archived chats unless "Show Archived" is enabled
            if (!showArchived && archivedChats.has(j.id)) return false;
            if (showArchived && !archivedChats.has(j.id)) return false;

            // Filter deleted chats completely
            if (deletedChats.has(j.id)) return false;

            return true;
        });
    }, [jobs, user.id, showArchived, archivedChats, deletedChats, liveMessages]);

    // 2. Final filtered jobs (after previews loaded)
    const allChatJobs = useMemo(() => {
        // Filter out jobs with no messages after previews are loaded
        if (isLoadingPreviews) return relevantJobs;

        return relevantJobs.filter(j => {
            const hasPreview = lastMessagesMap[j.id] !== undefined;
            const hasLiveMsg = liveMessages.some(m => m.jobId === j.id);
            const hasAcceptedBid = j.bids.some(b => b.status === 'ACCEPTED');

            // Show if has messages OR has accepted bid
            return hasPreview || hasLiveMsg || hasAcceptedBid;
        });
    }, [relevantJobs, lastMessagesMap, liveMessages, isLoadingPreviews]);

    // 3. Fetch last messages for previews (only once on open or when relevant jobs change)
    useEffect(() => {
        if (!isOpen) return;

        const fetchPreviews = async () => {
            setIsLoadingPreviews(true);
            const map: Record<string, ChatMessage> = {};

            try {
                // Parallel fetch for speed - use relevantJobs to avoid circular dependency
                await Promise.all(relevantJobs.map(async (job) => {
                    try {
                        const { data, error } = await supabase
                            .from('chat_messages')
                            .select('*')
                            .eq('job_id', job.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        if (error && error.code !== 'PGRST116') { // Ignore 'no rows found' error
                            console.warn(`Error fetching preview for job ${job.id}:`, error);
                        }

                        if (data) {
                            map[job.id] = {
                                id: data.id,
                                jobId: data.job_id,
                                senderId: data.sender_id,
                                text: data.text,
                                translatedText: data.translated_text,
                                timestamp: new Date(data.created_at).getTime(),
                                isDeleted: data.is_deleted
                            };
                        }
                    } catch (innerErr) {
                        console.error(`Failed to fetch preview for job ${job.id}`, innerErr);
                    }
                }));
            } catch (err) {
                console.error("Error in fetchPreviews:", err);
            }

            setLastMessagesMap(map);
            setIsLoadingPreviews(false);
        };

        fetchPreviews();
    }, [isOpen, relevantJobs.length]); // Only depend on length to avoid re-fetching on every render

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

    // Archive/Delete Helper Functions
    const handleArchiveChat = async (jobId: string) => {
        try {
            await supabase.rpc('archive_chat', { p_job_id: jobId });
            setArchivedChats(prev => new Set(prev).add(jobId));
            setActiveMenuId(null);
        } catch (error) {
            console.error('Error archiving chat:', error);
            alert('Failed to archive chat');
        }
    };

    const handleUnarchiveChat = async (jobId: string) => {
        try {
            await supabase.rpc('unarchive_chat', { p_job_id: jobId });
            setArchivedChats(prev => {
                const updated = new Set(prev);
                updated.delete(jobId);
                return updated;
            });
            setActiveMenuId(null);
        } catch (error) {
            console.error('Error unarchiving chat:', error);
            alert('Failed to unarchive chat');
        }
    };

    const handleDeleteChat = async (jobId: string) => {
        if (!confirm('Delete this conversation? This will hide all messages.')) return;

        try {
            await supabase.rpc('delete_chat', { p_job_id: jobId });
            setDeletedChats(prev => new Set(prev).add(jobId));
            setActiveMenuId(null);
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat');
        }
    };

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

                    {/* Archive Toggle */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <span className="text-xs font-medium text-gray-600">Show Archived</span>
                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showArchived ? 'bg-emerald-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showArchived ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
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

                            const hasUnread = notifications.some(n => n.relatedJobId === job.id && !n.read);
                            const unreadCount = notifications.filter(n => n.relatedJobId === job.id && !n.read).length;

                            return (
                                <div key={job.id} className="relative">
                                    <button
                                        onClick={() => {
                                            // Determine correct receiver ID to pass
                                            let targetReceiverId: string | undefined;
                                            if (!isPoster) {
                                                targetReceiverId = job.posterId; // Workers always chat with poster
                                            } else {
                                                // As poster, we chat with the person in the last message, 
                                                // OR the accepted worker, OR undefined (if ambiguous)
                                                if (lastMsg) {
                                                    targetReceiverId = lastMsg.senderId === user.id ? lastMsg.receiverId : lastMsg.senderId;
                                                } else if (acceptedBid) {
                                                    targetReceiverId = acceptedBid.workerId;
                                                }
                                            }
                                            onClose();
                                            onChatSelect(job, targetReceiverId);
                                        }}
                                        className={`w-full text-left p-3 rounded-2xl hover:bg-gray-50 border-2 transition-all group relative overflow-hidden ${hasUnread
                                            ? 'bg-emerald-50 border-emerald-400 shadow-md'
                                            : 'bg-white border-transparent hover:border-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 border border-white shadow-sm flex items-center justify-center text-emerald-700 font-bold overflow-hidden">
                                                    {otherPersonPhoto ? (
                                                        <img src={otherPersonPhoto} alt={otherPerson} className="w-full h-full object-cover" />
                                                    ) : (
                                                        otherPerson.charAt(0)
                                                    )}
                                                </div>
                                                {/* Unread Count Badge - positioned on avatar */}
                                                {hasUnread && unreadCount > 0 && (
                                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                                        {unreadCount > 9 ? '9+' : unreadCount}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`font-bold truncate pr-2 group-hover:text-emerald-700 transition-colors ${hasUnread ? 'text-gray-900' : 'text-gray-900'}`}>
                                                        {otherPerson}
                                                        {hasUnread && <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>}
                                                    </h4>
                                                    {timeDisplay && (
                                                        <div className="flex items-center gap-1">
                                                            {hasUnread && (
                                                                <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                                                    NEW
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] font-medium whitespace-nowrap ${hasUnread ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                                                                {timeDisplay}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isPoster ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                        {isPoster ? 'Hiring' : 'Job'}
                                                    </span>
                                                    <p className="text-xs font-medium text-gray-500 truncate">{job.title}</p>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-gray-800' : (lastMsg ? 'text-gray-600' : 'text-emerald-600 italic')}`}>
                                                        {lastMsg
                                                            ? (lastMsg.isDeleted ? <span className="italic text-gray-400">This message was deleted</span> : (lastMsg.translatedText || lastMsg.text))
                                                            : 'Start the conversation...'
                                                        }
                                                    </p>

                                                    {/* Hover Action Arrow */}
                                                    <ChevronRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                </div>
                                            </div>
                                        </div>
                                    </button>

                                    {/* 3-Dot Menu Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(activeMenuId === job.id ? null : job.id);
                                        }}
                                        className="absolute top-3 right-3 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
                                    >
                                        <MoreVertical size={16} className="text-gray-400" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {activeMenuId === job.id && (
                                        <div className="absolute top-12 right-3 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]">
                                            {showArchived ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnarchiveChat(job.id);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                                >
                                                    <Archive size={14} />
                                                    Unarchive
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveChat(job.id);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                                                >
                                                    <Archive size={14} />
                                                    Archive
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteChat(job.id);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};
