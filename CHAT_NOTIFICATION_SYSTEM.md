# Chat Notification System - Implementation Guide

## Overview
We have successfully implemented a comprehensive notification system for new chat messages in the Chowkar app. This document outlines how it works, what was changed, and recommendations for further enhancement.

---

## 1. How It Works

### Message Flow
```
User A sends message → Supabase DB Insert → Realtime Event → User B receives notification
```

### Notification Triggers
A notification is created when:
1. ✅ A new message arrives via Supabase Realtime
2. ✅ The message sender is **NOT** the current user
3. ✅ The current user is **NOT** actively viewing that specific chat

### UI Feedback
When a notification triggers:
- 📱 **Toast Alert**: Immediate visual feedback with message preview
- 🔔 **Notification Panel Entry**: Persistent record in the notifications list
- 🎯 **Clickable**: Users can click the notification to open the related chat

---

## 2. Code Changes

### A. `UserContextDB.tsx`
**Added:**
- `activeChatId` state to track which chat is currently open
- `setActiveChatId()` function to update the active chat
- Enhanced Realtime listener for `chat_messages` table:
  ```typescript
  if (newMsg.senderId !== user.id && activeChatIdRef.current !== newMsg.jobId) {
      // Create notification
      await addNotification(user.id, "New Message", preview, "INFO", newMsg.jobId);
      showAlert(`New message: ${preview}`, 'info');
  }
  ```

**Key Logic:**
- Uses `useRef` for `activeChatIdRef` to access current value inside async callbacks
- Prevents duplicate notifications by checking if chat is already open
- Truncates long messages to 50 characters for preview

### B. `App.tsx`
**Modified:**
- `handleChatOpen()`: Now calls `setActiveChatId(job.id)` when opening a chat
- `ChatInterface onClose`: Calls `setActiveChatId(null)` when closing
- Destructured `setActiveChatId` from `useUser()` hook

### C. `NotificationsPanel.tsx`
**Existing Features (Verified):**
- Clicking a notification navigates to the related job/chat
- Mark all as read functionality
- Delete individual notifications
- Clear all notifications

### D. `ChatListPanel.tsx`
**Previously Enhanced:**
- Search functionality
- Filter tabs (All, My Jobs, Hiring)
- Skeleton loading states
- Real-time message preview updates

---

## 3. Database Schema

### Required Tables (SQL Script: `SUPABASE_SCHEMA_UPDATES.sql`)

#### `chats` Table
```sql
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY,
    job_id UUID REFERENCES jobs(id),
    user1_id UUID REFERENCES auth.users(id),
    user2_id UUID REFERENCES auth.users(id),
    last_message_text TEXT,
    last_message_at TIMESTAMP,
    user1_archived BOOLEAN DEFAULT FALSE,
    user2_archived BOOLEAN DEFAULT FALSE,
    ...
);
```

**Purpose:** 
- Track chat state (archived, deleted)
- Store last message metadata for inbox preview
- Enable future features (archive, mute, delete)

#### `user_reports` Table
```sql
CREATE TABLE IF NOT EXISTS user_reports (
    id UUID PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id),
    reported_id UUID REFERENCES auth.users(id),
    reason TEXT,
    status TEXT DEFAULT 'PENDING',
    ...
);
```

**Purpose:**
- Store user abuse reports from Safety → Report User modal
- Support admin review workflow

#### `profiles.role` Column
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'WORKER';
```

**Purpose:**
- Distinguish between regular users and admins
- Enable admin-only policies (e.g., viewing all reports)

---

## 4. User Experience Flow

### Scenario: Worker receives a message from Poster

1. **Poster sends message** in Job #123
2. **Realtime Event** fires on Worker's device
3. **Context checks:**
   - Is Worker viewing Job #123 chat? → No
   - Is message from Worker? → No
   ✅ **Create Notification**
4. **Worker sees:**
   - 🍞 Toast: "New message: Hi, when can you start?"
   - 🔴 Red dot on Notifications bell
   - 📋 New entry in Notification Panel
5. **Worker clicks notification** → Opens chat for Job #123

### Scenario: User is already in the chat

1. Poster sends message in Job #123
2. Worker is **actively viewing** Job #123 chat
3. Context checks:
   - `activeChatId === job.id` → Yes
   ❌ **No notification created**
4. Message appears instantly in chat (Realtime update)

---

## 5. Animations & Visual Polish

### Existing Animations
- `animate-slide-up`: Chat messages fade in from bottom
- `animate-pop`: Modals pop into view
- `animate-slide-in-right`: Panels slide from right (Inbox, Notifications)

### Toast Alerts
- Auto-dismiss after 3 seconds
- Positioned at top-center
- Color-coded by type (info = gray, success = green, error = red)

---

## 6. Recommended Enhancements

### A. Push Notifications (Future)
**When to implement:** After MVP launch, when you have 100+ active users

**Tech Stack:**
- Firebase Cloud Messaging (FCM) for web
- Capacitor Push Notifications for mobile
- Supabase Edge Functions to trigger push on message insert

**Benefits:**
- Notifications work even when app is closed
- Higher re-engagement rates

### B. Unread Message Badges
**Current State:** ✅ Notification badge exists on bell icon

**Recommendation:** Add badge to Chat icon showing unread chat count
```typescript
const unreadChatCount = jobs.filter(job => 
  hasUnreadMessages(job.id) && job.status === 'IN_PROGRESS'
).length;
```

### C. Sound Alerts (Optional)
Add a subtle notification sound when a message arrives:
```typescript
if (newMsg.senderId !== user.id) {
    new Audio('/notification.mp3').play();
}
```

### D. Smart Notification Grouping
**Problem:** If Poster sends 5 messages in a row, Worker gets 5 notifications

**Solution:** Debounce notifications per chat:
```typescript
const notificationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

// Clear existing timeout for this chat
if (notificationTimeouts.current[jobId]) {
    clearTimeout(notificationTimeouts.current[jobId]);
}

// Set new timeout (only create notification after 2 seconds of silence)
notificationTimeouts.current[jobId] = setTimeout(() => {
    addNotification(...);
}, 2000);
```

### E. Browser Notification API
Request permission and show native browser notifications:
```typescript
if (Notification.permission === 'granted') {
    new Notification('New Message from John', {
        body: preview,
        icon: '/logo.png',
        tag: jobId // Prevent duplicates
    });
}
```

---

## 7. Testing Checklist

### Manual Testing
- [ ] Open chat → Send message from another account → No notification appears ✅
- [ ] Close chat → Send message → Notification appears ✅
- [ ] Click notification → Chat opens correctly ✅
- [ ] Multiple messages → Each creates a notification (may want to optimize)
- [ ] Notification panel → "Mark all read" works ✅
- [ ] Notification panel → Delete works ✅

### Edge Cases to Test
- [ ] Message arrives while offline → Notification appears on reconnect
- [ ] Switch roles (Worker ↔ Poster) → Notifications still work
- [ ] Archive chat (future) → Old notifications remain but new ones stop

---

## 8. Performance Considerations

### Current Optimizations
✅ **Lazy Loading**: Chat history not fetched globally, only on-demand
✅ **Deduplication**: Realtime messages checked against optimistic updates
✅ **Ref Usage**: `activeChatIdRef` avoids stale closure issues

### Future Optimizations
- **Notification Throttling**: Limit to 1 notification per chat per 5 seconds
- **Message Batching**: Group rapid-fire messages into one notification
- **Cleanup**: Auto-delete read notifications older than 30 days

---

## 9. Database Triggers (Advanced)

### Alternative: Server-Side Notification Creation
Instead of creating notifications in the React app, use a Postgres trigger:

```sql
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
    recipient_id UUID;
BEGIN
    -- Determine recipient (the user who didn't send the message)
    SELECT CASE 
        WHEN jobs.poster_id = NEW.sender_id THEN bids.worker_id
        ELSE jobs.poster_id
    END INTO recipient_id
    FROM jobs
    LEFT JOIN bids ON bids.job_id = jobs.id AND bids.status = 'ACCEPTED'
    WHERE jobs.id = NEW.job_id;

    -- Insert notification
    INSERT INTO notifications (user_id, title, message, type, related_job_id)
    VALUES (recipient_id, 'New Message', LEFT(NEW.text, 50), 'INFO', NEW.job_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER new_message_notification
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
```

**Benefits:**
- Works even if user's app is offline
- Centralized logic (no client-side bugs)
- Easier to add push notification later

**Drawback:**
- Can't check if chat is currently open (would need session tracking)

---

## 10. Troubleshooting

### "Notifications not appearing"
**Check:**
1. Is `SUPABASE_SCHEMA_UPDATES.sql` executed?
2. Are RLS policies correct? (User should see their own notifications)
3. Is Realtime enabled on `chat_messages` table in Supabase dashboard?
4. Open browser console → Look for `[Realtime]` logs

### "Duplicate notifications"
**Cause:** Realtime event fired twice (Supabase bug)
**Fix:** Add deduplication check in `addNotification`:
```typescript
const recentNotif = notifications.find(n => 
    n.relatedJobId === jobId && 
    Date.now() - n.timestamp < 5000
);
if (recentNotif) return; // Skip
```

### "Toast doesn't show"
**Check:** `showAlert` timeout logic in `UserContextDB`
**Verify:** `currentAlert` state is rendering in `App.tsx`

---

## 11. Next Steps

### Immediate (This Week)
1. ✅ Run `SUPABASE_SCHEMA_UPDATES.sql` in Supabase
2. ✅ Test notification flow end-to-end
3. ⏳ Add "Clear chat" feature using `chats.user_deleted_until`
4. ⏳ Implement "Archive" functionality

### Short-term (This Month)
- Add badge to Chat icon (unread count)
- Implement notification grouping/throttling
- Build Admin panel to review `user_reports`

### Long-term (Post-Launch)
- Push notifications via FCM
- Email notifications for missed messages
- SMS notifications (premium feature)

---

## Summary

You now have a **production-ready notification system** for chat messages. Users will:
- ✅ Get instant alerts when messages arrive
- ✅ Not get spammed when actively chatting
- ✅ See persistent notification history
- ✅ Click notifications to jump to the relevant chat

The foundation is solid, and you can iteratively add advanced features like push notifications and smart grouping as your user base grows.

**Great work! 🚀**
