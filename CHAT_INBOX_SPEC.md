# Chat Inbox - Complete Specification

## 📋 Overview
This document defines exactly how the Chat Inbox should function in CHOWKAR app.

---

## 🎯 Core Principle

**A chat should ONLY appear in the inbox when there is someone to chat with.**

---

## 📊 When Does a Chat Appear?

### For Job POSTER:
| Scenario | Chat Appears? | Who to Chat With? |
|----------|---------------|-------------------|
| Posted a job, no bids yet | ❌ NO | N/A |
| Job has bids, none accepted | ❌ NO | N/A |
| Job has ACCEPTED bid | ✅ YES | Accepted Worker |
| Job is IN_PROGRESS | ✅ YES | Accepted Worker |
| Job is COMPLETED | ✅ YES (can archive) | Worker |

### For WORKER:
| Scenario | Chat Appears? | Who to Chat With? |
|----------|---------------|-------------------|
| Browsing jobs | ❌ NO | N/A |
| Placed a bid (pending) | ❌ NO | N/A |
| Bid ACCEPTED | ✅ YES | Job Poster |
| Job is IN_PROGRESS | ✅ YES | Job Poster |
| Job is COMPLETED | ✅ YES (can archive) | Job Poster |

---

## 🔄 Data Flow

```
JOB CREATED
    ↓
WORKER PLACES BID
    ↓
POSTER ACCEPTS BID  ← Chat becomes available
    ↓
BOTH CAN CHAT
    ↓
JOB COMPLETED
    ↓
CHAT AUTO-ARCHIVED (optional)
```

---

## 📱 Inbox UI Requirements

### Chat List Item Shows:
1. **Other person's name** (worker name for poster, poster name for worker)
2. **Other person's photo** (or initial)
3. **Job title** (for context)
4. **Role badge** ("Hiring" for poster, "Job" for worker)
5. **Last message preview** (truncated)
6. **Timestamp** of last message
7. **Unread indicator** (if there are unread messages)

### Filters:
- **ALL**: All chats
- **MY JOBS**: Chats where user is the worker
- **HIRING**: Chats where user is the poster

### Actions (3-dot menu):
- **Archive**: Hide from main list (show in "Archived")
- **Delete**: Soft delete (hide messages before timestamp)

---

## 🗃️ Database Schema Required

### STEP 0: Create `chats` Table (SQL)
Run this in Supabase to support archive/delete/privacy features.

```sql
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    user1_id UUID REFERENCES profiles(id),
    user2_id UUID REFERENCES profiles(id),
    user1_archived BOOLEAN DEFAULT FALSE,
    user2_archived BOOLEAN DEFAULT FALSE,
    user1_deleted_until TIMESTAMP WITH TIME ZONE,
    user2_deleted_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(job_id, user1_id, user2_id)
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own chat metadata
CREATE POLICY "Users can see their own chats" ON chats
FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
```

### `chat_messages` table (Existing):
| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| job_id | UUID | Related job |
| sender_id | UUID | Who sent |
| receiver_id | UUID | Who receives |
| text | TEXT | Message content |
| read | BOOLEAN | Has recipient read it |
| read_at | TIMESTAMP | When read |
| is_deleted | BOOLEAN | Soft deleted |
| created_at | TIMESTAMP | When sent |

---

## 🔧 Implementation Steps

### STEP 1: Loop-Safe Filter Logic (Frontend)
**Goal**: Show chats only when there's an accepted bid, and avoid re-refetch loops.

```typescript
// 1. Get potentially relevant jobs (no message-state dependency)
const relevantJobs = useMemo(() => {
    return jobs.filter(j => {
        const isPoster = j.posterId === user.id;
        const isBidder = j.bids.some(b => b.workerId === user.id);
        const hasAcceptedBid = j.bids.some(b => b.status === 'ACCEPTED');

        // Only show if there's an accepted bid (Poster or Worker)
        if (!hasAcceptedBid) return false;

        // User must be one of the participants
        const isAcceptedWorker = j.bids.some(b => b.status === 'ACCEPTED' && b.workerId === user.id);
        if (!isPoster && !isAcceptedWorker) return false;

        // Apply Database-level Archive/Delete filters
        if (deletedChats.has(j.id)) return false;
        if (!showArchived && archivedChats.has(j.id)) return false;
        if (showArchived && !archivedChats.has(j.id)) return false;

        return true;
    });
}, [jobs, user.id, showArchived, archivedChats, deletedChats]);

// 2. Final display list (after search/tabs)
const allChatJobs = useMemo(() => {
    return relevantJobs.filter(job => {
        if (activeTab === 'AS_POSTER' && job.posterId !== user.id) return false;
        if (activeTab === 'AS_WORKER' && job.posterId === user.id) return false;
        if (searchTerm && !job.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });
}, [relevantJobs, activeTab, searchTerm]);
```

### STEP 2: Determine Chat Partner & UI Labels
Satisfies UI requirements for name, photo, and role badge.

```typescript
const getChatDetails = (job: Job, userId: string) => {
  const isPoster = job.posterId === userId;
  if (isPoster) {
    const acceptedBid = job.bids.find(b => b.status === 'ACCEPTED');
    return {
      partnerName: acceptedBid?.workerName || 'Worker',
      partnerPhoto: acceptedBid?.workerPhoto,
      roleLabel: 'Hiring',
      roleClass: 'bg-blue-50 text-blue-600'
    };
  } else {
    return {
      partnerName: job.posterName || 'Poster',
      partnerPhoto: job.posterPhoto,
      roleLabel: 'Job',
      roleClass: 'bg-orange-50 text-orange-600'
    };
  }
};
```

### STEP 3: Load Archive/Delete States from Database
```typescript
useEffect(() => {
  const loadStates = async () => {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    
    const archived = new Set();
    const deleted = new Set();
    
    data?.forEach(chat => {
      const isUser1 = chat.user1_id === user.id;
      if (isUser1 && chat.user1_archived) archived.add(chat.job_id);
      if (!isUser1 && chat.user2_archived) archived.add(chat.job_id);
      if (isUser1 && chat.user1_deleted_until) deleted.add(chat.job_id);
      if (!isUser1 && chat.user2_deleted_until) deleted.add(chat.job_id);
    });
    
    setArchivedChats(archived);
    setDeletedChats(deleted);
  };
  loadStates();
}, [user.id]);
```

---

## ✅ Verification Checklist

### Basic Functionality:
- [ ] Poster sees empty inbox before any bid is accepted
- [ ] Poster sees chat after accepting a bid
- [ ] Worker sees empty inbox before their bid is accepted
- [ ] Worker sees chat after their bid is accepted
- [ ] Both can exchange messages
- [ ] Messages appear in real-time

### Archive/Delete:
- [ ] Archive hides chat from main list
- [ ] "Show Archived" toggle works
- [ ] Unarchive returns chat to main list
- [ ] Delete hides chat even after refresh
- [ ] Deleted chats stay deleted

### Display:
- [ ] Correct other person's name shown
- [ ] Job title shown
- [ ] Last message preview shown
- [ ] Timestamp shown
- [ ] Unread indicator works

---

## 🚀 Implementation Order

1. **Step 0**: Create `chats` table and RLS policies.
2. **Step 1**: Implement Loop-Safe filter logic in `ChatListPanel.tsx`.
3. **Step 2**: Apply UI Requirement labels (Hiring/Job) and partner logic.
4. **Step 3**: Verify Archive/Delete persist after page refresh.
5. **Step 4**: Complete Unread indicators and Notifications integration.
6. **Step 5**: Voice Notes Extension.

---

## 📝 Notes

- Keep it simple: No chat until bid is accepted
- The filter should be straightforward
- Archive/delete should persist in database
- UI should clearly show who you're chatting with
