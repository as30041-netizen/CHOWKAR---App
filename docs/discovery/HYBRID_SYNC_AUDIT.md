# Hybrid Sync System Audit & Implementation Plan

## Objective
Ensure the application is robust against network interruptions, offline periods, and app restarts. We must strictly adhere to the **Hybrid Sync Pattern**:
> **Initial Snapshot (REST) + Realtime Delta (Socket)**

If a component *only* listens to Realtime, it is buggy (misses events while offline).
If a component *only* fetches REST, it is stale.
It must do **BOTH**, and handle **Reconnection** events.

## Audit Scope

### 1. Chat Interface (`ChatInterface.tsx`)
- [ ] **Current:** Fetches history on mount. Listens to Realtime.
- [ ] **Gap:** Does it re-fetch history if connection is lost and restored? (e.g. backgrounding app on mobile).
- [ ] **Gap:** Duplicate handling (Optimistic vs Realtime).

### 2. Inbox List (`ChatListPanel.tsx`)
- [ ] **Current:** `useEffect` fetches summaries.
- [ ] **Gap:** Does it refetch when the panel is re-opened? Yes.
- [ ] **Gap:** Does it update live indicators (Unread count) from global state?

### 3. Global Data (`UserContextDB.tsx`)
- [ ] **Current:** Fetches user data on mount.
- [ ] **Gap:** `setupRealtime` handles notifications. Does it re-fetch missed notifications on reconnect?
- [ ] **Action:** Add `window.addEventListener('focus')` or Supabase `ON_CONNNECT` listener to soft-refresh critical data.

### 4. Job Data (`JobContextDB.tsx`)
- [ ] **Current:** Fetches feeds on mount.
- [ ] **Gap:** Realtime updates for Bids/Jobs.
- [ ] **Action:** Ensure "Pull to Refresh" or "Focus Refresh" is available.

## Implementation Standard

For every critical component:

```typescript
// 1. Initial Load
useEffect(() => {
  fetchData();
}, []);

// 2. Re-fetch on Focus / Reconnect
useEffect(() => {
  const handleFocus = () => fetchData({ silent: true });
  window.addEventListener('focus', handleFocus);
  // Optional: Supabase channel on('system', 'channel_error', ...) to trigger refetch
  return () => window.removeEventListener('focus', handleFocus);
}, []);

// 3. Realtime Listener
useEffect(() => {
  const channel = supabase...on(..., (payload) => {
     // UPSERT data (don't just append blindly)
     setData(prev => upsert(prev, payload.new));
  });
  return () => channel.unsubscribe();
}, []);
```

## Execution Plan
1.  **Refactor `ChatInterface`**: Implement `upsertMessages` properly with ID replacement (fix duplicate bug) + Focus Refetch.
2.  **Harden `UserContext`**: Ensure Notifications sync on Reconnect.
3.  **Harden `JobContext`**: Ensure Bids sync on Reconnect.
