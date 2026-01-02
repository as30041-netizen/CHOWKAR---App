# CHOWKAR Feature Completeness & Polish Plan

## 🎯 Goal
Ensure every major feature (Notifications, Chat, Jobs, Bids, Wallet) has a complete "lifecycle" of user actions, plugging all UX gaps so users never feel stuck or limited.

## 📊 Feature Audit & Missing Actions

### 1. 🔔 Notifications System
*Current State:* Can view, mark read, delete, and clear all.
*Missing Actions:*
- [x] **Delete Single**: Trash icon implemented.
- [x] **Clear All**: "Clear All" button implemented (Database & Local).
- [x] **Mark All Read**: "Mark Read" button implemented.
- [ ] **Settings**: Toggle specific notification types (e.g., "Mute Marketing").

### 2. 💬 Chat System
*Current State:* Send text/voice, translation.
*Missing Actions:*
- [ ] **Delete Message**: Long press -> "Delete for me" / "Delete for everyone" (within 10 mins).
- [ ] **Copy Text**: Long press -> Copy.
- [ ] **Archive Chat**: Swipe chat in list to archive (hide from main view).
- [ ] **Block/Report**: "Block User" option in chat menu for safety.
- [ ] **Online Status**: "Last seen" or green dot indicator.

### 3. 📝 Job Management
*Current State:* Post, Edit (limited), Close.
*Missing Actions:*
- [ ] **Cancel Job**: "Cancel Job" button for Open jobs (refunds logic needed?).
- [ ] **Repost/Duplicate**: "Post Similar Job" button on completed/expired jobs.
- [ ] **Share Job**: Native share sheet to send job link to WhatsApp/Socials.

### 4. 🙋‍♂️ Bidding (Worker)
*Current State:* Place, Withdraw, Counter.
*Missing Actions:*
- [ ] **Edit Bid**: Allow editing amount/message if not yet accepted (limit: 15 mins).
- [ ] **Drafts**: Auto-save typed bid if modal is closed accidentally.

### 5. 💰 Wallet
*Current State:* View balance, Add money (test), View all transactions.
*Missing Actions:*
- [ ] **Filter History**: Filter by 'Credit' / 'Debit' / 'Date Range'.
- [ ] **Compact View**: Group transactions by month.

---

## 🛠️ Implementation Plan

### Phase 1: Notification Polish (High Impact, Low Effort) - ✅ DONE
1.  **Add `deleteNotification` RPC**: ✅ Implemented in `SUPABASE_SCHEMA_UPDATES.sql`.
2.  **UI Update**: ✅ "Clear All" & "Mark Read" added to `NotificationsPanel`.
3.  **Gestures**: Trash icon used instead of Swipe (Clean & Simple).

### Phase 2: Chat Lifecycle (Medium Effort)
1.  **Message Actions Menu**: Add long-press menu on chat bubbles.
2.  **DB Updates**: Add `is_deleted` and `deleted_by` columns to `chat_messages`.
3.  **Chat Options**: Add "Three dots" menu in `ChatInterface` header for Block/Report.

### Phase 3: Job & Bid Control (Medium Effort)
1.  **Cancel Job Logic**: Create `cancel_job` RPC that checks for active bids/funds.
2.  **Edit Bid Logic**: update `create_bid` RLS to allow updates within time window.

---

## 🎨 UX/UI Enhancements

- **Empty States**: "No Notifications? Good news is no news!" (illustration).
- **Loading Skeletons**: Use shimmer effects instead of spinners for Cards/Lists.
- **Haptic Feedback**: Vibrate on success (Bid Placed, Job Posted) using Capacitor Haptics.
- **Toast consistency**: Standardize all success/error messages to top-center toasts.

## 📝 Success Criteria
- User can delete any specific item (msg, notif, job) they created.
- User can undo destructive actions (3-second "Undo" toast).
- Zero "dead ends" in the UI.

---

**Next Steps:**
Shall we start with **Phase 1 (Notifications Polish)** since it's the requested feature and easiest to implement?
