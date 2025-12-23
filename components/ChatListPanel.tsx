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
    const { user, t, language, messages: liveMessages, notifications, setNotifications } = useUser();
    const { jobs, getJobWithFullDetails } = useJobs();
    const [inboxChats, setInboxChats] = useState<import('../services/chatService').InboxChatSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // UX States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'AS_WORKER' | 'AS_POSTER'>('ALL');
    const [showArchived, setShowArchived] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set());
    const [deletedChats, setDeletedChats] = useState<Set<string>>(new Set());

    // Load available chats using Optimized RPC (Solves N+1 Query Problem)
    useEffect(() => {
        if (!isOpen || !user.id || user.id.length < 10 || user.id === 'u1') return;

        const loadChats = async () => {
            setIsLoading(true);
            try {
                // Dynamic import to avoid circular dependencies if any
                const { fetchInboxSummaries } = await import('../services/chatService');
                const { chats, error } = await fetchInboxSummaries(user.id);

                if (error) {
                    console.error('Failed to load inbox:', error);
                } else {
                    setInboxChats(chats);
                    // Also ensure these jobs are loaded in context details if user opens them later
                    chats.forEach(c => getJobWithFullDetails(c.jobId));
                }
            } catch (err) {
                console.error('Error loading inbox:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadChats();
    }, [isOpen, user.id, liveMessages.length]); // Refresh when new messages arrive live

    // 2. Filter Logic (Archive / Tabs / Search) 
    const filteredChats = useMemo(() => {
        return inboxChats.filter(chat => {
            // Check Live Messages for updates
            const isManuallyArchived = archivedChats.has(chat.jobId);
            const isDeleted = deletedChats.has(chat.jobId);
            const isCompleted = chat.jobStatus === 'COMPLETED';

            if (isDeleted) return false;

            if (!showArchived) {
                // Active: Hide manually archived OR completed
                if (isManuallyArchived || isCompleted) return false;
            } else {
                // Archive: Show manually archived OR completed
                if (!isManuallyArchived && !isCompleted) return false;
            }

            // Tabs Filter
            if (activeTab === 'AS_POSTER' && chat.posterId !== user.id) return false;
            if (activeTab === 'AS_WORKER' && chat.posterId === user.id) return false;

            // Search Filter
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return chat.counterpartName.toLowerCase().includes(searchLower) ||
                    chat.jobTitle.toLowerCase().includes(searchLower);
            }

            return true;
        })
            // Sort by timestamp (latest first)
            .sort((a, b) => {
                const timeA = a.lastMessage?.timestamp || 0;
                const timeB = b.lastMessage?.timestamp || 0;
                return timeB - timeA;
            });

    }, [inboxChats, activeTab, searchTerm, showArchived, archivedChats, deletedChats]);

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

            // Also delete related notifications
            await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user.id)
                .eq('related_job_id', jobId);

            // Update local state
            setDeletedChats(prev => new Set(prev).add(jobId));
            setNotifications(prev => prev.filter(n => n.relatedJobId !== jobId));
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

            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col border-l border-gray-100 dark:border-gray-800 pt-safe pb-safe transition-colors">

                {/* Header */}
                <div className="bg-white dark:bg-gray-900 px-4 py-4 border-b border-gray-100 dark:border-gray-800 z-10 sticky top-0 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.chats || 'Messages'}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                            <XCircle size={22} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search chats or jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex p-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        {(['ALL', 'AS_WORKER', 'AS_POSTER'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab
                                    ? 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                                    }`}
                            >
                                {tab === 'ALL' ? 'All' : tab === 'AS_WORKER' ? 'My Jobs' : 'Hiring'}
                            </button>
                        ))}
                    </div>

                    {/* Archive Toggle */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 transition-colors">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Show Archived</span>
                        <button
                            onClick={() => setShowArchived(!showArchived)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showArchived ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showArchived ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
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
                    ) : filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <Briefcase className="text-gray-300 dark:text-gray-600" size={32} />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No conversations found</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {searchTerm ? 'Try a different search term' : 'Active jobs will appear here'}
                            </p>
                        </div>
                    ) : (
                        filteredChats.map(chat => {
                            // Determine latest message (Live vs DB)
                            const liveLastMsg = liveMessages.filter(m => m.jobId === chat.jobId).slice(-1)[0];
                            const fetchedLastMsg = chat.lastMessage;

                            let lastMsgText = fetchedLastMsg?.text;
                            let lastMsgTime = fetchedLastMsg?.timestamp;
                            let lastMsgIsDeleted = false; // RPC doesn't support 'is_deleted' yet, assumed false for now or text is already replaced

                            if (liveLastMsg) {
                                // Live update wins if it exists and is newer
                                if (!fetchedLastMsg || liveLastMsg.timestamp > fetchedLastMsg.timestamp) {
                                    lastMsgText = liveLastMsg.text;
                                    lastMsgTime = liveLastMsg.timestamp;
                                    lastMsgIsDeleted = liveLastMsg.isDeleted;
                                }
                            }

                            const isPoster = chat.posterId === user.id;
                            const roleLabel = isPoster ? 'Hiring' : 'Job';
                            const roleClass = isPoster ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';

                            // Formatter for time
                            const timeDisplay = lastMsgTime
                                ? new Date(lastMsgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : null;

                            const hasUnread = chat.unreadCount > 0; // Use RPC count or local state? RPC provides initial, but local state handles live updates better.
                            // Let's stick to local state 'notifications' for real-time accuracy as provided by context
                            const unreadRealtime = notifications.filter(n => n.relatedJobId === chat.jobId && !n.read).length;
                            const hasUnreadRealtime = unreadRealtime > 0;

                            return (
                                <div key={chat.jobId} className="relative">
                                    <button
                                        onClick={() => {
                                            // Determine single authorized receiver
                                            // RPC gives us 'counterpartId' which is exactly who we talk to
                                            const targetReceiverId = chat.counterpartId;

                                            // We need to pass a full 'Job' object to onChatSelect
                                            // But we only have a summary. 
                                            // We can construct a minimal dummy Job OR verify if getJobWithFullDetails can be awaited.
                                            // Current UI expects a Job object.
                                            // Ideally we should refactor onChatSelect to take ID, but for now let's find it in 'jobs' context
                                            const contextJob = jobs.find(j => j.id === chat.jobId);

                                            if (contextJob) {
                                                onClose();
                                                onChatSelect(contextJob, targetReceiverId);
                                            } else {
                                                // Fallback: If job not in context (rare due to getJobWithFullDetails call), 
                                                // Should we block? Or try to fetch?
                                                // Use a minimal object if allowed
                                                // For now, let's rely on the pre-fetch we did in useEffect.
                                                console.warn("Job not fully loaded in context yet, attempting open anyway");
                                                // Create a partial job to satisfy type check if possible, or wait?
                                                // Just try to grab it from state again or force it.
                                                onClose();
                                                // NOTE: This might crash if onChatSelect relies on specific job fields not present.
                                                // But we synced context in useEffect, so it SHOULD be there.
                                                if (contextJob) onChatSelect(contextJob, targetReceiverId);
                                            }
                                        }}
                                        className={`w-full text-left p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 border-2 transition-all group relative overflow-hidden ${hasUnreadRealtime
                                            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-400 dark:border-emerald-800 shadow-md'
                                            : 'bg-white dark:bg-gray-900 border-transparent hover:border-gray-100 dark:hover:border-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Avatar */}
                                            <div className="relative shrink-0">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 border border-white dark:border-gray-700 shadow-sm flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold overflow-hidden">
                                                    {chat.counterpartPhoto ? (
                                                        <img src={chat.counterpartPhoto} alt={chat.counterpartName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        chat.counterpartName.charAt(0)
                                                    )}
                                                </div>
                                                {/* Unread Count Badge - positioned on avatar */}
                                                {hasUnreadRealtime && (
                                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                                        {unreadRealtime > 9 ? '9+' : unreadRealtime}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 pt-0.5">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`font-bold truncate pr-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors ${hasUnreadRealtime ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'}`}>
                                                        {chat.counterpartName}
                                                        {hasUnreadRealtime && <span className="ml-2 w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse"></span>}
                                                    </h4>
                                                    {timeDisplay && (
                                                        <div className="flex items-center gap-1">
                                                            {hasUnreadRealtime && (
                                                                <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                                                    NEW
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] font-medium whitespace-nowrap ${hasUnreadRealtime ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                                                                {timeDisplay}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${roleClass}`}>
                                                        {roleLabel}
                                                    </span>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{chat.jobTitle}</p>
                                                </div>

                                                <div className="flex items-center justify-between">
                                                    <p className={`text-sm truncate ${hasUnreadRealtime ? 'font-semibold text-gray-800 dark:text-gray-200' : (lastMsgText ? 'text-gray-600 dark:text-gray-400' : 'text-emerald-600 dark:text-emerald-400 italic')}`}>
                                                        {lastMsgText
                                                            ? (lastMsgIsDeleted ? <span className="italic text-gray-400 dark:text-gray-500">This message was deleted</span> : lastMsgText)
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
                                            setActiveMenuId(activeMenuId === chat.jobId ? null : chat.jobId);
                                        }}
                                        className="absolute top-3 right-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors z-10"
                                    >
                                        <MoreVertical size={16} className="text-gray-400 dark:text-gray-500" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {activeMenuId === chat.jobId && (
                                        <div className="absolute top-12 right-3 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 min-w-[160px]">
                                            {showArchived ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnarchiveChat(chat.jobId);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                                >
                                                    <Archive size={14} />
                                                    Unarchive
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveChat(chat.jobId);
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                                >
                                                    <Archive size={14} />
                                                    Archive
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteChat(chat.jobId);
                                                }}
                                                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 text-red-600 dark:text-red-400"
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
