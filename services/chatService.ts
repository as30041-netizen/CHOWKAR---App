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
