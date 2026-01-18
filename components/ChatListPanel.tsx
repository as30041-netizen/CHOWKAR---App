import React, { useState, useEffect, useMemo } from 'react';
import { XCircle, Search, Filter, Phone, Briefcase, ChevronRight, MoreVertical, Archive, Trash2, FileText, Star, ArrowLeft } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { Job } from '../types';

import { useUser } from '../contexts/UserContextDB';
import { useJobs } from '../contexts/JobContextDB';
import { useSwipe } from '../hooks/useSwipe';

interface ChatListPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onChatSelect: (job: Job, receiverId: string) => void;
}

export const ChatListPanel: React.FC<ChatListPanelProps> = ({ isOpen, onClose, onChatSelect }) => {
    const { user, t, language } = useUser();
    const { notifications, clearNotificationsForJob } = useNotification();

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
    const hasFetchedRef = React.useRef(false);
    const lastFetchTimeRef = React.useRef(0);

    // Swipe to Close
    const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp } = useSwipe({
        onSwipeRight: onClose,
        threshold: 50
    });

    // Load available chats using Optimized RPC (Solves N+1 Query Problem)
    // Only fetch once when panel opens, not on every message change
    useEffect(() => {
        if (!isOpen || !user.id) {
            return;
        }

        // DEBOUNCE: Skip if fetched recently (< 5 seconds)
        const now = Date.now();
        if (hasFetchedRef.current && (now - lastFetchTimeRef.current < 5000)) {
            console.log('[ChatListPanel] Skipping fetch (throttled)');
            return;
        }

        hasFetchedRef.current = true;
        lastFetchTimeRef.current = now;

        const loadChats = async () => {
            // Only show loading spinner on FIRST load
            if (inboxChats.length === 0) setIsLoading(true);

            try {
                // Small delay to ensure Supabase client is fully ready
                await new Promise(resolve => setTimeout(resolve, 100));

                const { fetchInboxSummaries } = await import('../services/chatService');
                const { chats, error } = await fetchInboxSummaries(user.id);

                if (error) {
                    console.error('Failed to load inbox:', error);
                    hasFetchedRef.current = false;
                } else {
                    setInboxChats(chats);
                    // Optimized Prefetch: Limit to top 5 most recent chats to check specifically for updates without flooding network
                    chats.slice(0, 5).forEach((c, index) => {
                        setTimeout(() => {
                            getJobWithFullDetails(c.jobId);
                        }, 500 + (index * 200));
                    });
                }
            } catch (err) {
                console.error('Error loading inbox:', err);
                hasFetchedRef.current = false;
            } finally {
                setIsLoading(false);
            }
        };

        loadChats();
    }, [isOpen, user.id]); // Removed liveMessages.length - don't refetch on every message

    // 2. Filter Logic (Archive / Tabs / Search) 
    const filteredChats = useMemo(() => {

        return inboxChats.filter(chat => {
            // Source of truth: Server flag OR local optimistic update
            const isManuallyArchived = archivedChats.has(chat.jobId) || chat.isArchived;
            const isDeleted = deletedChats.has(chat.jobId) || chat.isDeleted;
            // Only treat COMPLETED/CANCELLED as auto-archived (not IN_PROGRESS)
            const isAutoArchived = chat.jobStatus === 'COMPLETED' || chat.jobStatus === 'CANCELLED';


            if (isDeleted) {
                return false;
            }

            if (!showArchived) {
                // Active View: Hide manually archived OR completed jobs
                if (isManuallyArchived || isAutoArchived) {
                    return false;
                }
            } else {
                // Archive View: Show ONLY manually archived OR completed jobs
                if (!isManuallyArchived && !isAutoArchived) {
                    return false;
                }
            }

            // Tabs Filter
            const posterId = chat.posterId?.toLowerCase();
            const currentUserId = user.id?.toLowerCase();

            if (activeTab === 'AS_POSTER' && posterId !== currentUserId) return false;
            if (activeTab === 'AS_WORKER' && posterId === currentUserId) return false;

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

    }, [inboxChats, activeTab, searchTerm, showArchived, archivedChats, deletedChats, user.id]);

    // Archive/Delete Helper Functions
    const handleArchiveChat = async (jobId: string) => {
        try {
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('archive_chat', { p_job_id: jobId });
            setArchivedChats(prev => new Set(prev).add(jobId));
            setActiveMenuId(null);
        } catch (error) {
            console.error('Error archiving chat:', error);
            alert('Failed to archive chat');
        }
    };

    const handleUnarchiveChat = async (jobId: string) => {
        try {
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('unarchive_chat', { p_job_id: jobId });
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
            const { safeRPC } = await import('../lib/supabase');
            await safeRPC('delete_chat', { p_job_id: jobId });

            // Also clear notifications for this job (Soft clear)
            await clearNotificationsForJob(jobId);

            // Update local state
            setDeletedChats(prev => new Set(prev).add(jobId));
            setActiveMenuId(null);
        } catch (error) {
            console.error('Error deleting chat:', error);
            alert('Failed to delete chat');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-end"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

            <div className="relative w-full sm:max-w-[360px] bg-white dark:bg-gray-900 h-full shadow-[-10px_0_30px_rgba(0,0,0,0.05)] animate-slide-in-right flex flex-col border-l border-gray-100 dark:border-gray-800 pt-safe pb-safe transition-all duration-500">

                {/* Header - Ultra Compact */}
                <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl px-4 py-3 border-b border-gray-100 dark:border-gray-800 z-10 sticky top-0 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={onClose} className="p-1.5 -ml-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 transition-all active:scale-95 md:hidden">
                            <ArrowLeft size={18} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">{t.chats || 'Messages'}</h2>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                        <input
                            type="text"
                            placeholder="Search chats or jobs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-base input-focus !pl-11 !py-3 shadow-inner bg-gray-50/50 dark:bg-gray-800/50"
                        />
                    </div>

                    {/* Filter Tabs - Modernized pill style */}
                    <div className="flex p-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-[1.5rem] border border-gray-100 dark:border-gray-800/50">
                        {(['ALL', 'AS_WORKER', 'AS_POSTER'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.25rem] transition-all duration-300 ${activeTab === tab
                                    ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-[0_4px_12px_rgba(0,0,0,0.05)] scale-[1.02]'
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
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse bg-white/50 dark:bg-gray-900/50">
                                <div className="w-14 h-14 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                                <div className="flex-1 space-y-3 pt-1">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                                    <div className="h-3 bg-gray-150 dark:bg-gray-800/50 rounded w-1/2"></div>
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
                            const fetchedLastMsg = chat.lastMessage;

                            let lastMsgText = fetchedLastMsg?.text;
                            let lastMsgTime = fetchedLastMsg?.timestamp;
                            let lastMsgIsDeleted = false; // RPC doesn't support 'is_deleted' yet, assumed false for now or text is already replaced

                            const isPoster = chat.posterId === user.id;
                            const roleLabel = isPoster ? 'Hiring' : 'Job';
                            const roleBadgeClass = isPoster ? 'badge-info' : 'badge-success';

                            // Formatter for time
                            const timeDisplay = lastMsgTime
                                ? new Date(lastMsgTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : null;

                            const hasUnread = chat.unreadCount > 0; // Use RPC count or local state? RPC provides initial, but local state handles live updates better.
                            // Let's stick to local state 'notifications' for real-time accuracy as provided by context
                            const unreadRealtime = notifications.filter(n => n.relatedJobId === chat.jobId && !n.read).length;
                            const hasUnreadRealtime = unreadRealtime > 0;

                            return (
                                <div key={chat.jobId} className="relative mb-2">
                                    <button
                                        onClick={async () => {
                                            const targetReceiverId = chat.counterpartId;
                                            let contextJob = jobs.find(j => j.id === chat.jobId);

                                            if (!contextJob) {
                                                console.log(`[ChatListPanel] Job ${chat.jobId} not in context, fetching explicitly...`);
                                                contextJob = await getJobWithFullDetails(chat.jobId);
                                            }

                                            if (contextJob) {
                                                onClose();
                                                onChatSelect(contextJob, targetReceiverId);
                                            } else {
                                                console.warn("Could not find or fetch job details for:", chat.jobId);
                                            }
                                        }}
                                        className={`w-full text-left p-5 rounded-[2rem] border transition-all duration-500 relative overflow-hidden group/card ${hasUnreadRealtime
                                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 shadow-lg shadow-emerald-500/5'
                                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            {/* Avatar Area */}
                                            <div className="relative shrink-0">
                                                <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-white dark:border-gray-800 shadow-sm flex items-center justify-center text-gray-700 dark:text-gray-300 font-black text-xl overflow-hidden transition-all duration-500 group-hover/card:scale-105 group-hover/card:rotate-3">
                                                    {chat.counterpartPhoto ? (
                                                        <img src={chat.counterpartPhoto} alt={chat.counterpartName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        chat.counterpartName.charAt(0)
                                                    )}
                                                </div>
                                                {hasUnreadRealtime && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center shadow-lg border-2 border-emerald-50 dark:border-emerald-900 animate-bounce">
                                                        {unreadRealtime > 9 ? '9+' : unreadRealtime}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Area */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-1">
                                                    <h4 className="font-black text-gray-900 dark:text-white truncate pr-2 tracking-tight transition-colors group-hover/card:text-emerald-600 dark:group-hover/card:text-emerald-400 flex items-center gap-1.5">
                                                        {chat.counterpartName}
                                                        {chat.counterpartRating && chat.counterpartRating > 0 && (
                                                            <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md text-amber-600 dark:text-amber-400 font-black border border-amber-100 dark:border-amber-800/30">
                                                                <Star size={9} fill="currentColor" strokeWidth={0} /> {chat.counterpartRating.toFixed(1)}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    {timeDisplay && (
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${hasUnreadRealtime ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                                                            {timeDisplay}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${isPoster
                                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/50'
                                                        : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50'}`}>
                                                        {roleLabel}
                                                    </span>
                                                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 truncate uppercase tracking-tighter">
                                                        {chat.jobTitle}
                                                    </p>
                                                </div>

                                                <p className={`text-sm truncate ${hasUnreadRealtime ? 'font-black text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                                                    {lastMsgText
                                                        ? (lastMsgIsDeleted ? <span className="italic opacity-40">Message deleted</span> : lastMsgText)
                                                        : <span className="text-emerald-600/50 italic">Start chatting...</span>
                                                    }
                                                </p>
                                            </div>

                                            <ChevronRight size={18} className="text-gray-300 dark:text-gray-700 opacity-0 group-hover/card:opacity-100 group-hover/card:translate-x-1 transition-all shrink-0" />
                                        </div>
                                    </button>

                                    {/* 3-Dot Menu Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuId(activeMenuId === chat.jobId ? null : chat.jobId);
                                        }}
                                        className="absolute top-4 right-4 btn-ghost !p-2 rounded-full !bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MoreVertical size={16} className="text-gray-400" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {activeMenuId === chat.jobId && (
                                        <div className="absolute top-14 right-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 py-2 z-50 min-w-[170px] animate-pop overflow-hidden">
                                            {showArchived ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleUnarchiveChat(chat.jobId);
                                                    }}
                                                    className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                                                >
                                                    <Archive size={16} />
                                                    Unarchive
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleArchiveChat(chat.jobId);
                                                    }}
                                                    className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 text-gray-700 dark:text-gray-300 transition-colors"
                                                >
                                                    <Archive size={16} />
                                                    Archive
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteChat(chat.jobId);
                                                }}
                                                className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-red-600 dark:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={16} />
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
