# State Management Audit - Chat Refactor

## Problem
Currently, `App.tsx` manages a global `messages` array and passes it to `ChatInterface`. `ChatInterface` *also* fetches its own history.
This causes:
1.  **Duplication:** Merging logic is complex and prone to bugs.
2.  **Performance issues:** App-wide re-renders on every message.
3.  ** fragility:** If parent state desyncs from child state, user sees ghost messages.

## Best Solution: Encapsulated State
`ChatInterface` becomes the single source of truth for the *active conversation*.

### Changes
1.  **ChatInterface.tsx**
    - Remove `messages` prop.
    - Internal `messages` state handles both "History Load" and "Realtime Updates".
    - Deduplication happens naturally (ID check on insert).
    
2.  **App.tsx**
    - Stop passing `messages` to `ChatInterface`.
    - Stop handling `onIncomingMessage` for chat storage (only use it for Notifications if needed).

### Verification
- Open chat -> Loads history.
- Receive message -> Appears instantly.
- Close & Reopen -> No duplicates.
