# Chat State Stability Audit

## Objective
Identify and fix potential issues in Chat Interface state management, specifically regarding message duplication, loading states, and network resilience.

## Findings

### 1. Message Deduplication
*   **Current State:** (To be filled after analysis)
*   **Risk:** Realtime subscription might push a message that is also fetched by the initial load, or pushed twice if the connection flaps.
*   **Requirement:** `setMessages` should always use a Set or `some()` check to ensure unique IDs.

### 2. Loading States
*   **Current State:** (To be filled)
*   **Risk:** rapid switching between chats might leave "ghost messages" from previous chat or show "Loading" indefinitely if errored.

## Plan
1.  **Analyze `ChatInterface.tsx`** for `setMessages` patterns.
2.  **Verify `useEffect` cleanup** (unsubscribing correctly).
3.  **Implement `deduplicateMessages` helper** if missing.
