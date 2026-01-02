# Chat Scalability & Optimization Plan

## Problem
Currently, the app fetches **all** chat messages for **all** of the user's jobs on startup.
- **Database Burden:** High. Fetching 1000s of messages every time the user logs in or refreshes.
- **Performance:** App becomes slower as chat history grows.
- **Data Usage:** Wastes user's mobile data downloading old chats they aren't looking at.

## Recommended Solution: "Inbox + Pagination" Architecture

### 1. The "Inbox" View (Lightweight)
Instead of fetching full chat text for the main list, we should only fetch the **Summary**:
- Job Title
- Other Person Name/Photo
- **Last Message Preview** (Text & Time)
- Unread Count

**Optimization:**
Create a Database View or RPC function (e.g., `get_inbox_summary`) that returns just these 4 fields for active jobs. This reduces the initial data load by ~95%.

### 2. Paginated Chat Detail (Lazy Loading)
When the user clicks a specific job to open the `ChatInterface`:
1.  **Initial Load:** Fetch only the latest 50 messages (`page=0`).
2.  **Scroll Up:** When the user scrolls to the top, fetch the next 50 messages (`page=1`) and append them.
3.  **Real-time:** Subscribe to `INSERT` events *only* for this open chat room (which we just optimized with the Broadcast channel).

## Implementation Steps

### Phase 1: Client-Side Pagination (Client Code)
Use the newly created `services/chatService.ts` to fetch messages on demand.
1.  Remove global message fetching from `UserContextDB.tsx`.
2.  Update `ChatInterface.tsx` to use `fetchJobMessages(jobId, 0)` on mount.
3.  Add "Load Previous Messages" trigger when scrolling to top.

### Phase 2: Database Storage (Archiving)
Over time, move messages older than 3 months to a `chat_archives` table.
- Keeps the active `chat_messages` table small and fast.
- Archival can be done via a nightly Scheduled Function (Cron).

## Code Example (How to use the new service)

```typescript
// In ChatInterface.tsx

useEffect(() => {
  const loadMessages = async () => {
    const { messages } = await fetchJobMessages(job.id, 0); // Fetch latest 50
    setLocalMessages(messages);
  };
  loadMessages();
}, [job.id]);
```

This ensures that opening the app is instant, and opening a chat is fast, regardless of how long the history is.
