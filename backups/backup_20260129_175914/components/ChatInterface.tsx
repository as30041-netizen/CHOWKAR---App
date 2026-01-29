import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useNotification } from '../contexts/NotificationContext';
import { supabase, waitForSupabase } from '../lib/supabase';
import { fetchJobMessages, blockUser, unblockUser, getRelationshipStatus } from '../services/chatService';
import { fetchJobFullDetails, fetchJobContact } from '../services/jobService';
import { Job, ChatMessage, User } from '../types';
import { Send, Phone, CheckCircle, ArrowLeft, LockKeyhole, Paperclip, MoreVertical, Check, CheckCheck, Languages, Mic, MicOff, Loader2, Sparkles, Lock, Volume2, Square, Trash2, ShieldAlert, FileText, Flag, ChevronRight, Pencil, Ban, Heart, History as HistoryIcon } from 'lucide-react';
import { SafetyTipsModal, CommunityGuidelinesModal, TermsModal } from './InfoModals';
const QUICK_REPLIES_WORKER = [
  "I'm on my way",
  "I've arrived at the location",
  "How long will the work take?",
  "Please send exact location",
  "Ok, thank you"
];

const QUICK_REPLIES_POSTER = [
  "When will you reach?",
  "Please come quickly",
  "Call me when you arrive",
  "Is the work done?",
  "Ok, thanks"
];

import { ReportUserModal } from './ReportUserModal';
import { UserProfileModal } from './UserProfileModal';

interface ChatInterfaceProps {
  jobId: string;
  currentUser: User;
  onClose: () => void;
  // REMOVED: messages prop (internalized)
  onSendMessage: (text: string, customId?: string) => void;
  onCompleteJob: (job?: Job) => void;
  onTranslateMessage: (messageId: string, text: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, text: string) => void;
  isPremium?: boolean;
  remainingTries?: number;
  receiverId: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  jobId,
  currentUser,
  onClose,
  onSendMessage,
  onTranslateMessage,
  onCompleteJob,
  onEditMessage,
  onDeleteMessage,
  receiverId,
  isPremium,
  remainingTries
}) => {
  const { isLoggedIn, t, language } = useUser();
  const { markNotificationsAsReadForJob, setActiveChatId, setActiveJobId } = useNotification();

  const [job, setJob] = useState<Job | null>(null);

  // ALL useState/useRef hooks declared BEFORE any early returns (React Rules of Hooks)
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [showSafetyTips, setShowSafetyTips] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const typingTimeoutRef = useRef<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR' | 'CONNECTING'>('CONNECTING');

  // Fetch job details
  useEffect(() => {
    const fetchJobDetails = async () => {
      try {
        const { job: fetchedJob } = await fetchJobFullDetails(jobId);
        if (fetchedJob) setJob(fetchedJob);
      } catch (error) {
        console.error('Error fetching job details:', error);
      }
    };
    fetchJobDetails();
  }, [jobId]);

  // Derived Constants - use optional chaining since job might be null
  const isPoster = job?.posterId === currentUser.id;
  const acceptedBid = job?.bids?.find(b => b.id === job?.acceptedBidId);
  const agreedBid = job?.bids?.find(b => b.negotiationHistory?.some(h => h.agreed));
  const otherPersonId = receiverId || (isPoster ? (acceptedBid?.workerId || agreedBid?.workerId || '') : job?.posterId) || '';

  // Helper to safely add/update messages (Deduplication & Replacement)
  const upsertMessages = (newMsgs: ChatMessage[]) => {
    setMessages(prev => {
      const map = new Map(prev.map(m => [m.id, m]));

      newMsgs.forEach(m => {
        // DUPLICATE/OPTIMISTIC FIX:
        // If we have a 'temp_' ID that matches the content/timestamp of this new 'real' message, replace it.
        // (Heuristic: same text + timestamp within 2 seconds)
        if (!m.id.startsWith('temp_')) {
          for (const [existingId, existingMsg] of map.entries()) {
            if (existingId.startsWith('temp_') &&
              existingMsg.text === m.text &&
              Math.abs(existingMsg.timestamp - m.timestamp) < 5000) {
              map.delete(existingId); // Remove temp
            }
          }
        }
        map.set(m.id, m);
      });

      return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
    });
  };

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMessages = async (targetPage: number = 0) => {
    if (!job?.id) return; // Guard
    try {
      if (targetPage === 0) setIsLoadingHistory(true);
      else setIsLoadingMore(true);

      const { messages: historyData } = await fetchJobMessages(job.id, targetPage);

      // Check if we reached the end
      if (!historyData || historyData.length < 50) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }

      // Sort by timestamp
      const sorted = (historyData || []).sort((a, b) => a.timestamp - b.timestamp);

      if (targetPage === 0) {
        console.log(`[Chat] Loaded ${sorted.length} messages from latest (page 0)`);
        upsertMessages(sorted);
      } else {
        console.log(`[Chat] Loaded ${sorted.length} older messages (page ${targetPage})`);
        // Prepend older messages (upsert handles sorting)
        upsertMessages(sorted);
      }

      setPage(targetPage);

    } catch (error) {
      console.error('Error loading chat history:', error);
    } finally {
      setIsLoadingHistory(false);
      setIsLoadingMore(false);
    }
  };

  // Initial Load
  const { hasInitialized } = useUser();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // CRITICAL FIX: Wait for auth initialization
    if (!job?.id || !hasInitialized) return;

    setIsLoadingHistory(true);
    setLoadError(null);

    loadMessages().catch(err => {
      console.error('Initial load failed:', err);
      setLoadError('Failed to load messages');
      setIsLoadingHistory(false);
    });
  }, [job?.id, hasInitialized]);

  // HYBRID SYNC: Refetch on window focus to catch offline messages
  useEffect(() => {
    if (!job?.id) return;
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Chat] App foregrounded, refreshing messages...');
        loadMessages();
      }
    };

    window.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [job?.id]);

  // We no longer merge props.messages. We use 'messages' state directly.
  const allMessages = messages;

  // Blocking State
  const [blockingStatus, setBlockingStatus] = useState<{ iBlocked: boolean; theyBlockedMe: boolean }>({ iBlocked: false, theyBlockedMe: false });

  // Real-time Broadcast Channel
  const [channel, setChannel] = useState<any>(null);

  // Mark messages AND notifications as read when chat opens
  // Mark messages AND notifications as read when chat opens OR new messages arrive
  useEffect(() => {
    const markAsRead = async () => {
      // 0. Only run if we actually have unread messages for US (sent by other)
      const unreadCount = allMessages.filter(m => !m.read && m.senderId !== currentUser.id).length;

      if (unreadCount === 0) return; // Skip if nothing new to mark read

      try {
        // 1. DB: Mark messages as read via safeRPC
        const { safeRPC } = await import('../lib/supabase');
        await safeRPC('mark_messages_read', {
          p_job_id: job.id,
          p_user_id: currentUser.id
        });

        // 2. Local + DB: Mark notifications as read using context helper
        await markNotificationsAsReadForJob(job.id);

        console.log('[Chat] Marked messages and notifications as read for job:', job.id);
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    };

    let timeoutId: any;

    if (job?.id && currentUser.id) {
      // DEBOUNCE: Use a timeout to prevent spamming mark_messages_read RPC
      timeoutId = setTimeout(markAsRead, 2000); // Wait 2s after last message arrival

      // Set active context to suppress notification spam
      setActiveChatId(job.id);
      setActiveJobId(job.id);

      // Fetch blocking status only on mount/job change
      getRelationshipStatus(otherPersonId).then(status => {
        setBlockingStatus({ iBlocked: status.iBlocked, theyBlockedMe: status.theyBlockedMe });
      });
    }

    return () => {
      // 1. Clear any pending markAsRead timeout
      if (timeoutId) clearTimeout(timeoutId);

      // 2. Clear active context on unmount to resume normal notifications
      setActiveChatId(null);
      setActiveJobId(null);
    };
    // Trigger when job changes, or when the TOTAL message list changes (to catch new arrivals)
  }, [job?.id, currentUser.id, markNotificationsAsReadForJob, otherPersonId, allMessages.length]);

  useEffect(() => {
    if (!job?.id) return;
    const newChannel = supabase.channel(`chat_room:${job.id}`, {
      config: { presence: { key: currentUser.id } }
    });

    newChannel
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        const isOnline = Object.keys(state).includes(otherPersonId);
        setIsOtherUserOnline(isOnline);
      })
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        if (payload.senderId !== currentUser.id) {
          // 1. Update LOCAL state
          upsertMessages([payload as ChatMessage]);
          setIsOtherTyping(false);

          // 2. Notify Parent (REMOVED: Internalized state)
          // if (onIncomingMessage) onIncomingMessage(payload as ChatMessage);
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.senderId !== currentUser.id) {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
          scrollToBottom();
        }
      })
      .on('postgres_changes', {
        event: '*', // Listen for INSERT (new messages) and UPDATE (edits/deletes)
        schema: 'public',
        table: 'chat_messages',
        filter: `job_id=eq.${job.id}`
      }, (payload) => {
        // Handle insertion, deletion or edit
        const newMsg = (payload.new || payload.old) as any;
        if (newMsg) {
          const updated: ChatMessage = {
            id: newMsg.id,
            jobId: newMsg.job_id,
            senderId: newMsg.sender_id,
            text: newMsg.is_deleted ? 'This message was deleted' : newMsg.text,
            timestamp: new Date(newMsg.created_at || newMsg.timestamp).getTime(),
            translatedText: newMsg.translated_text,
            isDeleted: newMsg.is_deleted,
            read: newMsg.read,
            readAt: newMsg.read_at ? new Date(newMsg.read_at).getTime() : undefined
          };

          // Update local state
          upsertMessages([updated]);
        }
      })
      .subscribe(async (status) => {
        console.log(`[Chat] Channel status: ${status}`);
        setConnectionStatus(status as any);

        if (status === 'SUBSCRIBED') {
          await newChannel.track({ online_at: new Date().toISOString() });
        }
      });

    setChannel(newChannel);

    return () => {
      supabase.removeChannel(newChannel);
    };
  }, [job?.id, currentUser.id, otherPersonId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    // Broadcast typing (throttled logic could act here, but simple is fine for now)
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderId: currentUser.id }
      });
    }
  };

  const showLockIcon = !isPremium && (remainingTries || 0) <= 0;

  let otherPersonName = '';
  let otherPersonPhone = '';
  let otherPersonPhoto = '';

  // VISIBILITY RULES: Phone only visible for IN_PROGRESS jobs
  const isPhoneVisible = job?.status === 'IN_PROGRESS';
  const isArchived = job?.status === 'COMPLETED';

  const [securePhone, setSecurePhone] = useState('');

  useEffect(() => {
    if (isPhoneVisible && job?.id) {
      fetchJobContact(job.id).then(contact => {
        if (contact && contact.phone) setSecurePhone(contact.phone);
      }).catch(err => console.error('Failed to fetch contact info', err));
    }
  }, [job?.id, isPhoneVisible]);

  if (isPoster) {
    otherPersonName = acceptedBid?.workerName || 'Worker';
    // Use secure phone if available
    otherPersonPhone = securePhone || (isPhoneVisible ? (acceptedBid?.workerPhone || '') : '');
    otherPersonPhoto = acceptedBid?.workerPhoto || '';
  } else {
    otherPersonName = job?.posterName || 'Employer';
    otherPersonPhone = securePhone || (isPhoneVisible ? (job?.posterPhone || '') : '');
    otherPersonPhoto = job?.posterPhoto || '';
  }

  const quickReplies = isPoster ? QUICK_REPLIES_POSTER : QUICK_REPLIES_WORKER;


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Only scroll to bottom if we are on the first page (showing latest)
    // This prevents jumping to bottom when loading previous history
    if (page === 0) {
      scrollToBottom();
    }
  }, [allMessages.length, page]); // Scroll when count changes

  useEffect(() => {
    // Cleanup speech
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Helper for generating UUIDs (Polyfill for older environments if needed)
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSend = async (text: string = inputText) => {
    if (text.trim()) {
      // CRITICAL FIX: Generate UUID on client to reconcile Broadcast vs DB events
      // This prevents "Double Message" issue on receiver side
      const messageId = generateUUID();

      const tempMsg: ChatMessage = {
        id: messageId, // Use real UUID immediately
        jobId: job.id,
        senderId: currentUser.id,
        text: text,
        timestamp: Date.now()
      };

      // 1. Optimistic UI for Self
      upsertMessages([tempMsg]);
      setInputText('');
      setShowQuickReplies(false);

      // 2. Persistence (DB) - Pass ID to enforce consistency
      // Note: onSendMessage now accepts (text, customId)
      await onSendMessage(text, messageId);

      // 3. Broadcast (Instant UI for peer) - Send the SAME ID
      if (channel) {
        await channel.send({
          type: 'broadcast',
          event: 'new_message',
          payload: tempMsg
        });
      }
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      try { (window as any).recognition?.stop(); } catch (e) { }
      return;
    }

    setIsListening(true);
    try {
      const recognition = new SpeechRecognition();
      (window as any).recognition = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN'; // Default to Hindi/English mix for chat usually

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${text}` : text);
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const handleTranslateClick = async (msg: ChatMessage) => {
    setTranslatingId(msg.id);
    try {
      // 1. Get translation directly
      const { translateText } = await import('../services/geminiService');

      // Auto-detect target language: logic from App.tsx but localized
      const hasHindi = /[\u0900-\u097F]/.test(msg.text);
      const targetLang = hasHindi ? 'en' : 'hi';

      const finalTranslation = await translateText(msg.text, targetLang);

      // 2. Update local state directly
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, translatedText: finalTranslation } : m
      ));

      // 3. Also notify parent (optional, keeps sync for session messages)
      if (onTranslateMessage) {
        // We call this to trigger any other side effects, but we trust local update for UI
        onTranslateMessage(msg.id, msg.text);
      }
    } catch (error) {
      console.error('Translation failed', error);
    } finally {
      setTranslatingId(null);
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setSpeakingMessageId(null);
      return;
    }

    // Read translated text if available, otherwise original
    const textToRead = msg.translatedText || msg.text;
    const utterance = new SpeechSynthesisUtterance(textToRead);

    // Auto-detect Hindi characters to switch voice
    const hasHindiChars = /[\u0900-\u097F]/.test(textToRead);
    utterance.lang = hasHindiChars ? 'hi-IN' : 'en-IN';

    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(msg.id);
    }
  };

  // Group messages by date
  const groupedMessages = allMessages.reduce((acc, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>);

  // Show loading state if job hasn't loaded yet (after all hooks are called)
  if (!job) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <div className="text-text-primary text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading chat...</p>
          <button
            onClick={onClose}
            className="mt-4 text-text-muted text-sm hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Backdrop - allows clicking outside to close */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[90] hidden md:block animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Chat Interface - Mobile: Full Screen, Desktop: Right Drawer */}
      <div className="fixed z-[100] flex flex-col h-full bg-background
        inset-0 
        md:inset-y-0 md:right-0 md:left-auto md:w-[450px] 
        md:shadow-2xl md:border-l border-border
        animate-in slide-in-from-bottom md:slide-in-from-right duration-300 transition-colors">

        {/* Header - Premium Redesign */}
        <div className="bg-surface/95 backdrop-blur-xl px-4 py-3 shadow-sm border-b border-border flex items-center justify-between z-10 pt-safe transition-all duration-300">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="btn-ghost !p-2 rounded-full !bg-transparent hover:!bg-background text-text-secondary md:hidden"
              title="Close"
            >
              <ArrowLeft size={22} />
            </button>

            <div
              className="flex items-center gap-3 cursor-pointer group active:opacity-70 transition-opacity"
              onClick={() => setShowProfileModal(true)}
            >
              <div className="w-11 h-11 rounded-full bg-background border border-border flex items-center justify-center text-text-secondary font-bold text-lg overflow-hidden shrink-0 shadow-sm ring-2 ring-primary/5">
                {otherPersonPhoto ? (
                  <img src={otherPersonPhoto} alt={otherPersonName} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  otherPersonName.charAt(0)
                )}
              </div>
              <div className="flex flex-col justify-center">
                <h2 className="font-bold text-text-primary leading-tight text-base flex items-center gap-1.5">
                  {otherPersonName}
                  {connectionStatus !== 'SUBSCRIBED' && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      Connecting...
                    </span>
                  )}
                  <ChevronRight size={14} className="text-text-muted opacity-50 group-hover:translate-x-0.5 transition-transform" />
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOtherUserOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs text-emerald-500 font-bold uppercase tracking-wider">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-text-muted opacity-30"></span>
                      <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {otherPersonPhone ? (
              <a href={`tel:${otherPersonPhone}`} className="btn-ghost !p-2 rounded-full text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                <Phone size={18} strokeWidth={2} />
              </a>
            ) : null}
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="btn-ghost !p-2 rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
                <MoreVertical size={18} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-xl shadow-xl border border-border z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { setShowMenu(false); setShowSafetyTips(true); }} className="w-full text-left px-3 py-2.5 hover:bg-background text-xs font-medium text-text-primary flex items-center gap-2">
                      <ShieldAlert size={14} className="text-primary" /> Safety Tips
                    </button>
                    <button onClick={() => { setShowMenu(false); setShowReportModal(true); }} className="w-full text-left px-3 py-2.5 hover:bg-background text-xs font-medium text-red-600 flex items-center gap-2">
                      <Flag size={14} /> Report User
                    </button>
                    <button
                      onClick={async () => {
                        setShowMenu(false);
                        if (blockingStatus.iBlocked) {
                          if (confirm('Unblock this user?')) {
                            await unblockUser(otherPersonId);
                            setBlockingStatus(prev => ({ ...prev, iBlocked: false }));
                          }
                        } else {
                          if (confirm('Block this user? They will not be able to message you.')) {
                            await blockUser(otherPersonId);
                            setBlockingStatus(prev => ({ ...prev, iBlocked: true }));
                          }
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-background text-xs font-medium text-text-secondary flex items-center gap-2 border-t border-border"
                    >
                      <Ban size={14} className={blockingStatus.iBlocked ? "text-primary" : "text-text-muted"} />
                      {blockingStatus.iBlocked ? 'Unblock User' : 'Block User'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Job Status & Actions Banner (Safety Fix) */}
        <div className="bg-surface border-b border-border z-[5] overflow-hidden">
          <div className="px-4 py-2.5 flex justify-between items-center bg-background/30 backdrop-blur-sm">
            <div className="flex items-center gap-2 overflow-hidden text-text-secondary">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <FileText size={14} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[11px] line-clamp-1 tracking-tight">{job.title}</span>
                <span className="text-[10px] font-bold text-primary tabular-nums">₹{acceptedBid?.amount || job.budget}</span>
              </div>
            </div>

            {isPoster && job.status === 'IN_PROGRESS' && (
              <button
                onClick={() => onCompleteJob(job)}
                className="btn btn-primary !py-1.5 !px-3 !text-[10px] !h-auto font-black uppercase tracking-widest gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <CheckCircle size={14} />
                Finish Job
              </button>
            )}

            {job.status === 'COMPLETED' && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full border border-emerald-500/20">
                <CheckCircle size={12} fill="currentColor" className="text-emerald-500/20" />
                <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Phone Number Prompt Banner */}
        {(!currentUser.phone || currentUser.phone.length < 10) && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
            <Phone size={16} className="text-white flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white text-[11px] font-bold leading-tight">Add your phone number</p>
              <p className="text-white/80 text-[9px] font-medium mt-0.5">Share contact to coordinate with {otherPersonName}</p>
            </div>
            <button
              onClick={() => {
                // Navigate to profile to add phone
                onClose();
                setTimeout(() => window.location.href = '/profile', 100);
              }}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-[9px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-all active:scale-95"
            >
              ADD NOW
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-background/50 bg-opacity-10 transition-colors"
          style={{ backgroundImage: 'radial-gradient(var(--bg-pattern-color, #cbd5e1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          ref={messagesContainerRef}
        >
          {/* LOAD PREVIOUS BUTTON */}
          {hasMore && !isLoadingHistory && (
            <div className="flex justify-center py-2">
              <button
                onClick={() => loadMessages(page + 1)}
                disabled={isLoadingMore}
                className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm hover:bg-emerald-50 dark:hover:bg-gray-700 hover:text-emerald-600 transition-all flex items-center gap-2"
              >
                {isLoadingMore ? <Loader2 size={12} className="animate-spin" /> : <HistoryIcon size={12} />}
                {isLoadingMore ? 'Loading...' : 'Load Previous Messages'}
              </button>
            </div>
          )}

          {!isLoadingHistory && loadError && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="text-red-400 bg-red-500/10 p-3 rounded-full"><ShieldAlert size={24} /></div>
              <p className="text-sm font-medium text-red-500">{loadError}</p>
              <button
                onClick={() => { setIsLoadingHistory(true); setLoadError(null); loadMessages(); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoadingHistory && !loadError && allMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 opacity-50 space-y-2">
              <Sparkles size={40} className="text-emerald-300" />
              <p className="text-sm font-medium text-gray-500">Start the conversation</p>
            </div>
          )}

          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex justify-center mb-4">
                <span className="bg-gray-200/80 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                  {date === new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) ? 'Today' : date}
                </span>
              </div>

              <div className="space-y-2">
                {(msgs as ChatMessage[]).map((msg) => {
                  const isMe = msg.senderId?.toLowerCase() === currentUser.id?.toLowerCase();
                  const isThisSpeaking = speakingMessageId === msg.id;

                  // Inline Editing Mode
                  if (editingMessageId === msg.id) {
                    return (
                      <div key={msg.id} className="flex justify-end mb-4 w-full animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-3xl shadow-xl border-2 border-emerald-500/20 w-[90%] max-w-[400px]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-2 ml-1">Editing Message</p>
                          <textarea
                            className="input-base !bg-gray-50 dark:!bg-gray-900 !py-3 !px-4 w-full text-sm outline-none ring-offset-2 ring-emerald-500/50 transition-all text-gray-800 dark:text-gray-100 resize-none min-h-[80px]"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="btn btn-secondary !py-2 !px-5 !text-[10px] font-black uppercase tracking-widest"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (editText.trim() && editText !== msg.text) {
                                  onEditMessage?.(msg.id, editText);
                                }
                                setEditingMessageId(null);
                              }}
                              className="btn btn-primary !py-2 !px-6 !text-[10px] font-black uppercase tracking-widest"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex group ${isMe ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                      <div className="flex items-end gap-1 max-w-[85%]">
                        {/* Left Side Actions (For received messages) */}
                        {!isMe && (
                          <div className="flex flex-col gap-1 mb-1">
                            <button
                              onClick={() => handleTranslateClick(msg)}
                              className="p-1.5 bg-white/80 hover:bg-white rounded-full text-emerald-600 shadow-sm transition-all"
                              disabled={translatingId === msg.id}
                              title="Translate"
                            >
                              {translatingId === msg.id ? <Loader2 size={12} className="animate-spin" /> : (showLockIcon ? <Lock size={12} /> : <Languages size={12} />)}
                            </button>
                            <button
                              onClick={() => handleSpeakMessage(msg)}
                              className={`p-1.5 rounded-full shadow-sm transition-all ${isThisSpeaking ? 'bg-red-50 text-red-500' : 'bg-white/80 hover:bg-white text-gray-600'}`}
                              title="Listen"
                            >
                              {isThisSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
                            </button>
                          </div>
                        )}

                        <div
                          className={`relative px-4 py-2.5 rounded-[20px] text-[13.5px] shadow-sm transition-all duration-300 transform font-medium tracking-tight ${isMe
                            ? 'bg-primary text-white rounded-br-none shadow-primary/10'
                            : 'bg-surface text-text-primary border border-border rounded-bl-none shadow-black/5'
                            }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                          {msg.translatedText && (
                            <div className={`mt-3 pt-3 border-t ${isMe ? 'border-white/10' : 'border-gray-100 dark:border-gray-700'}`}>
                              <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                                <Sparkles size={12} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Translated</span>
                              </div>
                              <p className="leading-relaxed italic opacity-95 text-[13px]">{msg.translatedText}</p>
                            </div>
                          )}
                          <div className={`flex items-center justify-end gap-1.5 mt-2.5 text-[9px] font-black uppercase tracking-widest ${isMe ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              msg.read ? (
                                <CheckCheck size={14} className="text-white" />
                              ) : (
                                <Check size={14} className="opacity-60" />
                              )
                            )}
                          </div>
                        </div>

                        {/* Right Side Actions (For sent messages) */}
                        {isMe && (
                          <div className="flex flex-col gap-1 mb-1 items-end">
                            <button
                              onClick={() => handleSpeakMessage(msg)}
                              className={`p-1.5 rounded-full shadow-sm transition-all ${isThisSpeaking ? 'bg-red-50 text-red-500' : 'bg-white/80 hover:bg-white text-gray-600'}`}
                              title="Listen"
                            >
                              {isThisSpeaking ? <Square size={12} fill="currentColor" /> : <Volume2 size={12} />}
                            </button>
                            {onDeleteMessage && !msg.isDeleted && (
                              <button
                                onClick={() => {
                                  if (confirm('Delete message?')) onDeleteMessage(msg.id);
                                }}
                                className="p-1.5 rounded-full shadow-sm bg-white/80 hover:bg-red-50 hover:text-red-500 text-gray-400 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                title="Delete"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            {onEditMessage && !msg.isDeleted && (
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditText(msg.text);
                                }}
                                className="p-1.5 rounded-full shadow-sm bg-white/80 hover:bg-blue-50 hover:text-blue-500 text-gray-400 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                title="Edit"
                              >
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {isOtherTyping && (
            <div className="flex items-center gap-3 px-3 py-2 bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-full w-fit animate-in fade-in slide-in-from-left-4 duration-500 mt-2 ml-2 border border-white dark:border-gray-800 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></div>
              </div>
              <span className="text-[10px] text-gray-500 dark:text-gray-500 font-black uppercase tracking-[0.15em]">{otherPersonName.split(' ')[0]} typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer / Input */}
        <div
          className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-none z-20 transition-colors"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--keyboard-height, 0px))' }}
        >

          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-800">
              {quickReplies.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(reply)}
                  className="badge badge-info !bg-white dark:!bg-gray-800 border-emerald-100 dark:border-emerald-900/30 font-bold hover:scale-105 active:scale-95 transition-all shadow-sm whitespace-nowrap cursor-pointer"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <div className="p-3">
            {/* Archive Banner for COMPLETED jobs */}
            {isArchived && (
              <div className="mb-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 p-4 rounded-2xl text-center shadow-inner">
                {job.hasMyReview ? (
                  <div className="flex items-center justify-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <div className="p-2 bg-emerald-500/10 rounded-full">
                      <Heart size={20} fill="currentColor" />
                    </div>
                    <span>You've completed and reviewed this job.</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-text-primary mb-3">Job phase is over. Please share your feedback.</p>
                    <button
                      onClick={() => onCompleteJob(job)}
                      className="btn btn-primary w-full bg-amber-500 hover:bg-amber-600 !h-12 shadow-lg shadow-amber-500/20"
                    >
                      <Sparkles size={18} fill="white" />
                      Rate Your Experience
                    </button>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border opacity-40">
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Read-only Archive</p>
                </div>
              </div>
            )}

            {/* Input area - hidden for archived jobs or blocked users */}
            {!isArchived && !blockingStatus.iBlocked && !blockingStatus.theyBlockedMe && (
              <div className="flex items-end gap-3 px-1">
                <button
                  onClick={handleVoiceInput}
                  className={`p-3.5 rounded-2xl transition-all active:scale-90 shadow-sm border ${isListening ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 animate-pulse' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-800 hover:text-emerald-500'}`}
                >
                  {isListening ? <MicOff size={22} strokeWidth={2.5} /> : <Mic size={22} strokeWidth={2.5} />}
                </button>

                {isListening ? (
                  <div className="flex-1 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/20 rounded-3xl flex items-center justify-between min-h-[52px] px-6 py-3 border border-red-200 dark:border-red-800 animate-pop">
                    <div className="flex items-center gap-4">
                      <span className="text-red-600 dark:text-red-400 font-black uppercase tracking-widest text-xs animate-pulse">Listening... Speak Now</span>
                      <div className="flex gap-1 items-center h-4">
                        <div className="w-1 bg-red-500 rounded-full animate-mic-bounce h-2"></div>
                        <div className="w-1 bg-red-500 rounded-full animate-mic-bounce h-3 [animation-delay:0.2s]"></div>
                        <div className="w-1 bg-red-500 rounded-full animate-mic-bounce h-2 [animation-delay:0.4s]"></div>
                        <div className="w-1 bg-red-500 rounded-full animate-mic-bounce h-2.5 [animation-delay:0.1s]"></div>
                      </div>
                    </div>
                    <button onClick={() => setIsListening(false)} className="text-red-400 hover:text-red-600 dark:text-red-400 dark:hover:text-red-200 font-bold text-[10px] uppercase tracking-widest px-2">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-3xl flex items-center min-h-[52px] px-5 py-3 border border-gray-100 dark:border-gray-800 focus-within:border-emerald-500/50 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all shadow-inner">
                    <textarea
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type message here..."
                      className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 max-h-32 resize-none font-medium"
                      rows={1}
                      style={{ lineHeight: '1.5' }}
                    />
                  </div>
                )}

                <button
                  onClick={() => handleSend()}
                  disabled={!inputText.trim()}
                  className={`p-4 rounded-2xl transition-all duration-300 active:scale-90 shadow-lg flex items-center justify-center ${inputText.trim()
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-emerald-600/20'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }`}
                >
                  <Send size={22} strokeWidth={2.5} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                </button>
              </div>
            )}

            {(blockingStatus.iBlocked || blockingStatus.theyBlockedMe) && (
              <div className="p-4 text-center bg-gray-100 dark:bg-gray-800 rounded-2xl mx-2 mb-2">
                <p className="text-sm font-medium text-gray-500 flex items-center justify-center gap-2">
                  <Ban size={16} />
                  {blockingStatus.iBlocked ? 'You have blocked this user.' : 'You cannot reply to this conversation.'}
                </p>
                {blockingStatus.iBlocked && (
                  <button
                    onClick={async () => {
                      await unblockUser(otherPersonId);
                      setBlockingStatus(prev => ({ ...prev, iBlocked: false }));
                    }}
                    className="text-emerald-600 text-xs font-bold mt-2 uppercase tracking-wider"
                  >
                    Unblock
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <SafetyTipsModal
          isOpen={showSafetyTips}
          onClose={() => setShowSafetyTips(false)}
        />

        <ReportUserModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={otherPersonId}
          reportedUserName={otherPersonName}
          reporterUserId={currentUser.id}
          jobId={job.id}
        />

        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userId={otherPersonId}
          userName={otherPersonName}
          phoneNumber={otherPersonPhone} // Pass resolved secure phone if available
        />
      </div>
    </>
  );
};