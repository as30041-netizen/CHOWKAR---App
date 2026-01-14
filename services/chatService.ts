import { supabase, waitForSupabase } from '../lib/supabase';
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

    try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { safeFetch } = await import('./fetchUtils');

        console.log(`[ChatService] Fetching messages for job ${jobId}...`);

        // Use the SECURE VIEW (view_chat_messages) to handle masked deletion
        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/view_chat_messages?job_id=eq.${jobId}&order=created_at.desc&offset=${from}&limit=${ITEMS_PER_PAGE}`
        );

        if (!response.ok) {
            throw new Error(`Fetch failed: ${response.status}`);
        }

        const data = await response.json();

        // Reverse back to chronological order for display
        const messages: ChatMessage[] = (data || []).reverse().map((msg: any) => ({
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

        console.log(`[ChatService] ✅ Loaded ${messages.length} messages for job ${jobId}`);
        return { messages, error: null };
    } catch (error) {
        console.error('Error fetching messages:', error);
        return { messages: [], error };
    }
};

/**
 * Fetches the latest message for a job (for Inbox preview).
 * [OPTIMIZED] Uses safeFetch to prevent hangs.
 */
export const fetchLastMessage = async (jobId: string) => {
    try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { safeFetch } = await import('./fetchUtils');

        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/view_chat_messages?job_id=eq.${jobId}&order=created_at.desc&limit=1`,
            {
                headers: { 'Prefer': 'return=representation', 'Accept': 'application/vnd.pgrst.object+json' }
            }
        );

        if (!response.ok) return null;

        const data = await response.json();

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
    isArchived: boolean;
    isDeleted: boolean;
}

export const fetchInboxSummaries = async (userId: string): Promise<{ chats: InboxChatSummary[], error?: any }> => {
    try {
        console.log('[ChatService] Fetching inbox summaries...');

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { safeFetch } = await import('./fetchUtils');

        console.log(`[ChatService] Calling RPC for user ${userId}...`);

        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/rpc/get_inbox_summaries`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ p_user_id: userId })
            }
        );

        console.log('[ChatService] RPC response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[ChatService] RPC error:', errorText);
            throw new Error(`RPC failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`[ChatService] ✅ RPC returned ${data?.length || 0} chat threads`);

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
            unreadCount: Number(row.unread_count || 0),
            isArchived: !!row.is_archived,
            isDeleted: !!row.is_deleted
        }));

        console.log(`[ChatService] ✅ Inbox loaded: ${chats.length} chats`);
        return { chats, error: null };
    } catch (error) {
        console.error('[ChatService] Error fetching inbox summaries:', error);
        return { chats: [], error };
    }
};

export const editMessage = async (messageId: string, newText: string): Promise<{ success: boolean; error?: any }> => {
    try {
        // Use safeRPC instead of direct update to avoid client hangs
        const { safeRPC } = await import('../lib/supabase');

        // Note: We don't have an 'edit_message' RPC, but a direct UPDATE via safeFetch is better.
        // Or if we must use current client, at least use safeFetch if possible.
        // Ideally we should make an RPC, but for now let's use the REST API via safeFetch.

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const { safeFetch } = await import('./fetchUtils');

        const response = await safeFetch(
            `${supabaseUrl}/rest/v1/chat_messages?id=eq.${messageId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ text: newText })
            }
        );

        if (!response.ok) throw new Error(`Edit failed: ${response.status}`);

        return { success: true };
    } catch (error) {
        console.error('Error editing message:', error);
        return { success: false, error };
    }
};


export const deleteMessage = async (messageId: string): Promise<{ success: boolean; error?: any }> => {
    try {
        // Use safeRPC (preferred - handles authorization without blocking)
        const { safeRPC } = await import('../lib/supabase');
        const { error: rpcError } = await safeRPC('soft_delete_chat_message', { p_message_id: messageId });

        if (rpcError) {
            throw rpcError;
        }

        return { success: true };
    } catch (error) {
        console.error('Error deleting message:', error);
        return { success: false, error };
    }
};

// --- BLOCKING SYSTEM ---

export const blockUser = async (userIdToBlock: string): Promise<{ success: boolean; error?: any }> => {
    try {
        // Use safeRPC
        const { safeRPC } = await import('../lib/supabase');
        const { error } = await safeRPC('block_user', { p_blocked_id: userIdToBlock });
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error blocking user:', error);
        return { success: false, error };
    }
};

export const unblockUser = async (userIdToUnblock: string): Promise<{ success: boolean; error?: any }> => {
    try {
        const { safeRPC } = await import('../lib/supabase');
        const { error } = await safeRPC('unblock_user', { p_blocked_id: userIdToUnblock });
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error unblocking user:', error);
        return { success: false, error };
    }
};

export const getRelationshipStatus = async (otherUserId: string): Promise<{ iBlocked: boolean; theyBlockedMe: boolean; error?: any }> => {
    try {
        const { safeRPC } = await import('../lib/supabase');
        const { data, error } = await safeRPC('check_relationship_status', { p_other_user_id: otherUserId });
        if (error) throw error;

        return {
            iBlocked: data.i_blocked,
            theyBlockedMe: data.they_blocked_me
        };
    } catch (error) {
        // Silent fail (default to false) to avoid breaking chat if SQL not run
        console.warn('Error fetching relationship status (SQL might be missing):', error);
        return { iBlocked: false, theyBlockedMe: false, error };
    }
};
