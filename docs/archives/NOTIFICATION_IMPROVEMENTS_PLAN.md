# Chat & Notification System - MASTER IMPROVEMENT PLAN

## 📋 Overview
Complete tracking of ALL chat and notification improvements discussed in this session.

---

## 🚀 STEP-BY-STEP EXECUTION GUIDE

### ✅ STEP 1: Run Combined SQL Script (Supabase)
**File:** `RUN_ALL_CHAT_IMPROVEMENTS.sql`

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open file `RUN_ALL_CHAT_IMPROVEMENTS.sql` in VS Code
3. **Copy the ENTIRE content**
4. **Paste in Supabase SQL Editor**
5. Click **Run** (Ctrl+Enter)
6. Wait for "Success. No rows returned"

**This script includes:**
- ✅ Read receipts columns + RPC
- ✅ Media/voice notes columns
- ✅ Archive/delete RPC functions
- ✅ RLS policy fix (406 errors)
- ✅ Auto-archive trigger on job completion
- ✅ Notification cleanup function

---

### ✅ STEP 2: Create Voice Notes Storage Bucket (Supabase)
```sql
DROP POLICY IF EXISTS "Users can read messages for their jobs" ON chat_messages;

CREATE POLICY "Users can read messages for their jobs" ON chat_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = chat_messages.job_id
    AND (
      j.poster_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM bids b
        WHERE b.job_id = j.id
        AND b.worker_id = auth.uid()
      )
    )
  )
);
```

### Script 3: AUTO_ARCHIVE_COMPLETED_JOBS.sql ❌ NOT RUN
**Location:** `AUTO_ARCHIVE_COMPLETED_JOBS.sql`
**Purpose:** Auto-archive chats when job status → COMPLETED

### Script 4: Supabase Storage Setup ❌ NOT DONE
**Purpose:** Create storage bucket for voice notes
- Bucket name: `voice-notes`
- Public: false
- File size limit: 5MB
- Allowed MIME types: audio/webm, audio/mp4, audio/mpeg, audio/ogg

---

## 📊 FEATURE STATUS TRACKER

### CHAT ENHANCEMENTS

| # | Feature | Frontend | Backend | Status |
|---|---------|----------|---------|--------|
| 1 | **Read Receipts** (✓/✓✓ ticks) | ✅ Done | ❌ SQL not run | PARTIAL |
| 2 | **Archive Chats** (3-dot menu) | ✅ Done | ❌ SQL not run | PARTIAL |
| 3 | **Delete Chats** (soft delete) | ✅ Done | ❌ SQL not run | PARTIAL |
| 4 | **Voice Notes** (recording/playback) | ❌ Not started | ❌ SQL not run | NOT STARTED |

### NOTIFICATION IMPROVEMENTS

| # | Feature | Frontend | Backend | Status |
|---|---------|----------|---------|--------|
| 5 | **Real-time Notifications** (bell icon) | ✅ Done | ✅ Trigger exists | WORKING |
| 6 | **Mark Notifications Read (Chat Open)** | ✅ Done | ✅ Uses existing table | WORKING |
| 7 | **Mark Notification Read (Click)** | ✅ Done | ✅ Uses existing table | WORKING |
| 8 | **Auto-Archive on Job Complete** | N/A | ❌ SQL not run | NOT RUN |
| 9 | **Notification Cleanup (7-day)** | N/A | ❌ Optional | PLANNED |

### BUG FIXES

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 10 | 406 errors on chat preview fetch | RLS Policy update | ❌ NOT RUN |
| 11 | Notifications not appearing | Real-time subscription fix | ✅ FIXED |

---

## 🎯 IMPLEMENTATION ORDER (Step by Step)

### PHASE 1: Run All SQL Scripts (DO THIS FIRST)
- [ ] 1.1 Run `CHAT_ENHANCEMENTS.sql` in Supabase
- [ ] 1.2 Run RLS Policy Fix (Script 2 above)
- [ ] 1.3 Run `AUTO_ARCHIVE_COMPLETED_JOBS.sql`
- [ ] 1.4 Create `voice-notes` storage bucket in Supabase Dashboard

### PHASE 2: Verify Existing Features
- [ ] 2.1 Test chat inbox loads without 406 errors
- [ ] 2.2 Test read receipts (✓ → ✓✓ when message read)
- [ ] 2.3 Test archive chat (disappears, shows in archived)
- [ ] 2.4 Test delete chat (permanently hidden)
- [ ] 2.5 Test mark notification read when chat opens
- [ ] 2.6 Test mark notification read when clicked
- [ ] 2.7 Test auto-archive when job completes

### PHASE 3: Voice Notes Implementation
- [ ] 3.1 Create `hooks/useVoiceRecorder.ts`
- [ ] 3.2 Add recording UI to ChatInterface.tsx
- [ ] 3.3 Implement audio upload to Supabase Storage
- [ ] 3.4 Add audio player component for playback
- [ ] 3.5 Update handleSendMessage for media messages

### PHASE 4: Optional Cleanup
- [ ] 4.1 Implement 7-day notification auto-delete (optional)

---

## 📁 FILES MODIFIED/CREATED

### Frontend Files:
| File | Changes Made | Additional Changes Needed |
|------|--------------|---------------------------|
| `types.ts` | ✅ Added read, media fields | None |
| `ChatInterface.tsx` | ✅ Read receipts, mark notifications read | Voice notes UI |
| `ChatListPanel.tsx` | ✅ Archive/delete 3-dot menu | None |
| `chatService.ts` | ✅ Include read/media fields in fetch | None |
| `UserContextDB.tsx` | ✅ Notification subscription debug logs | None |
| `NotificationsPanel.tsx` | ✅ Already has mark-read on click | None |
| `hooks/useVoiceRecorder.ts` | ❌ NOT CREATED | Create for voice notes |

### SQL Files:
| File | Purpose | Run Status |
|------|---------|------------|
| `CHAT_ENHANCEMENTS.sql` | Schema + RPCs | ❌ NOT RUN |
| `AUTO_ARCHIVE_COMPLETED_JOBS.sql` | Auto-archive trigger | ❌ NOT RUN |
| `FIX_CHAT_NOTIFICATIONS.sql` | Notification trigger | ✅ Already run |

---

## 🐛 KNOWN ISSUES TO FIX

1. **406 Errors** - Chat preview fetches blocked by RLS → Run Script 2
2. **Archive/Delete RPCs not available** - Functions don't exist → Run Script 1
3. **Read receipts not persisting** - Columns don't exist → Run Script 1

---

## 📝 TESTING CHECKLIST

After running all SQL scripts:

### Read Receipts:
- [ ] User A sends message → shows single tick ✓
- [ ] User B opens chat → User A sees double tick ✓✓
- [ ] Old messages show correct tick status

### Archive/Delete:
- [ ] 3-dot menu visible on each chat
- [ ] Click Archive → chat disappears
- [ ] Toggle "Show Archived" → archived chat appears
- [ ] Click Unarchive → chat returns to main list
- [ ] Click Delete → chat permanently hidden

### Notifications:
- [ ] Send message → receiver gets notification
- [ ] Open chat → bell icon count decreases
- [ ] Click notification → opens chat + marks read
- [ ] Complete job → chat auto-archives

### Voice Notes (after Phase 3):
- [ ] Tap mic icon → recording starts
- [ ] See timer/recording indicator
- [ ] Send → audio uploads
- [ ] Receiver sees audio player
- [ ] Can play audio

---

## 🚀 NEXT IMMEDIATE ACTION

**Run these SQL scripts in order:**
1. `CHAT_ENHANCEMENTS.sql`
2. RLS Policy Fix (copy from above)
3. `AUTO_ARCHIVE_COMPLETED_JOBS.sql`

Then we proceed to verification and Voice Notes!
