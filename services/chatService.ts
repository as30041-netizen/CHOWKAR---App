import { supabase } from '../lib/supabase';
import { ChatMessage } from '../types';

export const ITEMS_PER_PAGE = 50;

/**
 * Fetches messages for a specific job with pagination.
 * @param jobId The ID of the job/chat room.
 * @param page The page number (0-indexed). 0 = latest messages.
 * @returns List of messages and potential error.
 */
export const fetchJobMessages = async (jobId: string, page: number = 0) => {
    const from = page * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false }) // Fetch newest first for pagination
            .range(from, to);

        if (error) throw error;

        // Reverse back to chronological order for display
        const messages: ChatMessage[] = (data || []).reverse().map(msg => ({
            id: msg.id,
            jobId: msg.job_id,
            senderId: msg.sender_id,
            receiverId: msg.receiver_id,
            text: msg.text,
            translatedText: msg.translated_text || undefined,
            timestamp: new Date(msg.created_at).getTime(),
            isDeleted: msg.is_deleted,
            read: msg.read,
            readAt: msg.read_at ? new Date(msg.read_at).getTime() : undefined,
            mediaType: msg.media_type,
            mediaUrl: msg.media_url,
            mediaDuration: msg.media_duration
        }));

        return { messages, error: null };
    } catch (error) {
        console.error('Error fetching messages:', error);
        return { messages: [], error };
    }
};

/**
 * Fetches the latest message for a job (for Inbox preview).
 */
export const fetchLastMessage = async (jobId: string) => {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) return null;

        return {
            id: data.id,
            text: data.text,
            timestamp: new Date(data.created_at).getTime()
        };
    } catch {
        return null;
    }
};

/**
 * [OPTIMIZED] Fetch all inbox chats in a single request.
 * Replaces the N+1 pattern of fetching jobs then fetching last messages.
 */
export interface InboxChatSummary {
    jobId: string;
    jobTitle: string;
    jobStatus: string;
    posterId: string;
    acceptedBidderId: string;
    counterpartId: string;
    counterpartName: string;
    counterpartPhoto?: string;
    lastMessage?: {
        text: string;
        timestamp: number;
        senderId: string;
        isRead: boolean;
    };
    unreadCount: number;
}

export const fetchInboxSummaries = async (userId: string): Promise<{ chats: InboxChatSummary[], error?: any }> => {
    try {
        console.log('[ChatService] Fetching inbox summaries...');
        const { data, error } = await supabase.rpc('get_inbox_summaries', { p_user_id: userId });

        if (error) throw error;

        const chats: InboxChatSummary[] = (data || []).map((row: any) => ({
            jobId: row.job_id,
            jobTitle: row.job_title,
            jobStatus: row.job_status,
            posterId: row.poster_id,
            acceptedBidderId: row.accepted_bidder_id,
            counterpartId: row.counterpart_id,
            counterpartName: row.counterpart_name || 'User',
            counterpartPhoto: row.counterpart_photo || undefined,
            lastMessage: row.last_message_text ? {
                text: row.last_message_text,
                timestamp: new Date(row.last_message_time).getTime(),
                senderId: row.last_message_sender_id,
                isRead: row.last_message_is_read
            } : undefined,
            unreadCount: Number(row.unread_count || 0)
        }));

        return { chats, error: null };
    } catch (error) {
        console.error('[ChatService] Error fetching inbox summaries:', error);
        return { chats: [], error };
    }
};

export const editMessage = async (messageId: string, newText: string): Promise<{ success: boolean; error?: any }> => {
    try {
        const { error } = await supabase
            .from('chat_messages')
            .update({ text: newText })
            .eq('id', messageId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error editing message:', error);
        return { success: false, error };
    }
};

export const deleteMessage = async (messageId: string): Promise<{ success: boolean; error?: any }> => {
    try {
        // Soft delete
        const { error } = await supabase
            .from('chat_messages')
            .update({ is_deleted: true, text: 'This message was deleted', media_url: null })
            .eq('id', messageId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error deleting message:', error);
        return { success: false, error };
    }
};
