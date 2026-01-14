import { useState } from 'react';
import { useUser } from '../contexts/UserContextDB';
import { useNotification } from '../contexts/NotificationContext';
import { useJobs } from '../contexts/JobContextDB';
import { Job, JobStatus, ChatMessage } from '../types';
import { supabase, waitForSupabase } from '../lib/supabase';
import { editMessage as editMessageService } from '../services/chatService';

interface ChatState {
    isOpen: boolean;
    job: Job | null;
    receiverId?: string;
}

export const useChatHandlers = (setShowEditProfile: (show: boolean) => void, setShowChatList?: (show: boolean) => void) => {
    const {
        user, language, showAlert,
    } = useUser();

    const {
        setActiveChatId, setActiveJobId,
        markNotificationsAsReadForJob
    } = useNotification();

    const { getJobWithFullDetails } = useJobs();

    const [chatState, setChatState] = useState<ChatState>({ isOpen: false, job: null });


    const openChat = async (job: Job, receiverId?: string) => {
        // 0. CHECK PROFILE COMPLETION
        if (!user.phone || !user.location || user.location === 'Not set') {
            setShowEditProfile(true);
            showAlert(language === 'en'
                ? 'Please complete your profile (Phone & Location) to start chatting.'
                : 'चैटिंग शुरू करने के लिए कृपया अपनी प्रोफ़ाइल (फ़ोन और स्थान) पूरी करें।', 'info');
            return;
        }

        // 1. SURGICAL LOADING: If lightweight feed, fetch full details
        let jobWithBids = job;
        if (job.bids.length === 0 || (job.acceptedBidId && !job.bids.find(b => b.id === job.acceptedBidId))) {
            const fetched = await getJobWithFullDetails(job.id);
            if (fetched) jobWithBids = fetched;
        }

        // 2. CHECK STATUS
        const isHired = jobWithBids.status === JobStatus.IN_PROGRESS || jobWithBids.status === JobStatus.COMPLETED;
        const acceptedBid = jobWithBids.bids.find(b => b.id === jobWithBids.acceptedBidId);

        if (!isHired) {
            showAlert(language === 'en'
                ? 'Chat is only available after you hire a worker'
                : 'चैट केवल कामगार को नियुक्त करने के बाद ही उपलब्ध है', 'info');
            return;
        }

        // 3. VALIDATE PARTICIPANT
        const isParticipant = user.id === jobWithBids.posterId || user.id === acceptedBid?.workerId;

        if (!isParticipant) {
            showAlert(language === 'en'
                ? 'You are not a participant in this job'
                : 'आप इस जॉब में भागीदार नहीं हैं', 'error');
            return;
        }

        // Open chat
        setChatState({ isOpen: true, job: jobWithBids, receiverId });
        setActiveChatId(jobWithBids.id);
        setActiveJobId(jobWithBids.id);
        markNotificationsAsReadForJob(jobWithBids.id);
        if (setShowChatList) setShowChatList(false);
    };

    const closeChat = () => {
        setChatState({ isOpen: false, job: null });
        setActiveChatId(null);
        setActiveJobId(null);
    };

    const sendMessage = async (text: string) => {
        if (!chatState.job) return;
        const job = chatState.job;
        const isPoster = user.id === job.posterId;

        // Derive receiver ID
        let receiverId = chatState.receiverId;
        if (!receiverId) {
            const acceptedBid = job.bids?.find(b => b.id === job.acceptedBidId);
            const agreedBid = job.bids?.find(b => b.negotiationHistory?.some((h: any) => h.agreed));
            if (isPoster) receiverId = acceptedBid?.workerId || agreedBid?.workerId;
            else receiverId = job.posterId;
        }

        // Failsafe
        if (!receiverId && !isPoster) receiverId = job.posterId;
        if (!receiverId) {
            showAlert('Could not find receiver. Please refresh.', 'error');
            return;
        }


        const newMessage: ChatMessage = {
            id: 'temp_' + Date.now(),
            jobId: job.id,
            senderId: user.id,
            receiverId: receiverId || '',
            text,
            timestamp: Date.now(),
            isDeleted: false,
            read: false
        };

        // OPTIMISTIC UPDATE (Global State) - REMOVED: ChatInterface handles its own state
        // setMessages(prev => [...prev, newMessage]);

        try {
            await waitForSupabase(async () => {
                return await supabase.from('chat_messages').insert({
                    job_id: newMessage.jobId, sender_id: newMessage.senderId, receiver_id: newMessage.receiverId, text: newMessage.text
                }).select().single();
            });
        } catch (err) {
            console.error('Error sending message:', err);
        }
    };

    const updateMessage = (updatedMsg: ChatMessage) => {
        // setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        // Global state update disabled
    };

    const editMessage = async (messageId: string, newText: string) => {
        try {
            const result = await editMessageService(messageId, newText);
            if (result.success) {
                // setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: newText } : m));
            } else {
                showAlert('Failed to edit message', 'error');
            }
        } catch (error) {
            console.error('Error editing message:', error);
            showAlert('Error editing message', 'error');
        }
    };

    const deleteMessage = async (messageId: string) => {
        try {
            const { deleteMessage: serviceDelete } = await import('../services/chatService');
            const result = await serviceDelete(messageId);
            if (result.success) {
                // setMessages(prev => prev.map(m => m.id === messageId ? { ...m, text: 'This message was deleted', translatedText: undefined, isDeleted: true } : m));
            }
        } catch (error) { console.error('Error deleting message:', error); }
    };

    const translateMessage = async (messageId: string, text: string) => {
        try {
            const { translateText } = await import('../services/geminiService');
            const translated = await translateText(text, language === 'en' ? 'hi' : 'en');
            // setMessages(prev => prev.map(m => m.id === messageId ? { ...m, translatedText: translated } : m));
        } catch (err) { console.error('Translation error:', err); }
    };

    return {
        chatState,
        setChatState, // Exposed just in case, but prefer open/close
        openChat,
        closeChat,
        sendMessage,
        updateMessage, // for realtime subscription usage
        editMessage,
        deleteMessage,
        translateMessage
    };
};
