# 🔍 COMPREHENSIVE USER JOURNEY ANALYSIS
## Real-Time Notifications & Updates at Every Stage

---

## 📊 COMPLETE USER JOURNEY MAP

### **JOB POSTER JOURNEY** (Customer/Employer)

```
Stage 1: Post Job
    ↓
Stage 2: Wait for Bids
    ↓
Stage 3: Review Bids (multiple workers)
    ↓
Stage 4: Accept a Bid
    ↓
Stage 5: Chat with Worker
    ↓
Stage 6: Job Completion
    ↓
Stage 7: Leave Review
```

### **WORKER JOURNEY**

```
Stage 1: Browse Jobs
    ↓
Stage 2: Place Bid
    ↓
Stage 3: Wait for Response / Counter Offer
    ↓
Stage 4: Bid Accepted - Pay Connection Fee
    ↓
Stage 5: Chat with Poster
    ↓
Stage 6: Complete Job
    ↓
Stage 7: Leave Review
```

---

## 🎯 STAGE-BY-STAGE ANALYSIS

### **POSTER STAGE 1: Post Job**

**Action:** Poster creates a new job

**What Should Happen:**
1. ✅ Job inserted to database
2. ✅ Job appears in poster's "My Jobs" instantly
3. ✅ Job appears in workers' feed instantly (if OPEN)
4. ❌ **NO notification** needed (poster initiated action)

**Real-Time Requirements:**
```
Poster's Device → JobContext real-time:
  - postgres_changes: INSERT on jobs
  - Broadcast: new_job event
  
Workers' Devices → JobContext real-time:
  - postgres_changes: INSERT on jobs (if status = OPEN)
  - Job card appears in feed
```

**Notification Requirements:** NONE

**Current Implementation Status:**
- [ ] Check if JobContext listens to INSERT on jobs table
- [ ] Check if broadcast is sent for new jobs
- [ ] Verify jobs table in realtime publication

---

### **POSTER STAGE 2: Wait for Bids**

**Action:** Workers start bidding on the job

**What Should Happen:**
1. ✅ Bid inserted to database
2. ✅ Poster sees bid count increase on job card (1 → 2 → 3)
3. ✅ **Notification sent to poster** for each new bid
4. ✅ If app minimized: **Push notification to Android**
5. ✅ If app open: **In-app notification + bell icon +1**

**Real-Time Requirements:**
```
Worker Device → Submit Bid:
  - INSERT into bids table
  - Trigger: notify_poster_of_new_bid() fires
  
Poster Device → Real-time updates:
  - postgres_changes: INSERT on bids
  - Notification: INSERT on notifications
  - Job card updates (bid count)
  - Bell icon shows +1
```

**Notification Requirements:**
```
Type: bid_received
Title: "New Bid"
Message: "New bid of ₹500 from Rajesh on 'Plumber needed'"
related_job_id: job.id
```

**Push Notification (if app minimized):**
```
FCM Payload:
  notification:
    title: "New Bid"
    body: "New bid of ₹500 from Rajesh on 'Plumber needed'"
  data:
    jobId: job.id
    notificationId: notif.id
```

**Current Implementation Status:**
- [x] Database trigger: notify_poster_of_new_bid() ✅
- [ ] Real-time subscription for bids in JobContext
- [ ] Real-time subscription for notifications in UserContext
- [ ] Push notification via edge function
- [ ] Job card shows bid count in real-time

---

### **POSTER STAGE 3: Review Bids**

**Action:** Poster opens "View Bids" modal

**What Should Happen:**
1. ✅ Modal shows ALL bids on the job
2. ✅ If new bid arrives while modal is open, it appears **instantly**
3. ✅ Bid count updates in real-time
4. ✅ Worker details visible (name, rating, location, photo)
5. ❌ **NO additional notifications** (poster is actively viewing)

**Real-Time Requirements:**
```
ViewBidsModal → Real-time subscription:
  - Channel: bids_modal_{jobId}
  - postgres_changes: INSERT on bids (filter: job_id=eq.{jobId})
  - On INSERT: Fetch full bid details + worker profile
  - Update localJob state
  - Bid count updates
```

**Notification Requirements:** NONE (suppress - user is viewing)

**Current Implementation Status:**
- [x] ViewBidsModal has real-time subscription ✅ (we added this)
- [ ] Notification suppression when modal is open
- [ ] Bid count updates in modal header

---

### **POSTER STAGE 4: Accept a Bid**

**Action:** Poster clicks "Accept Bid"

**What Should Happen:**
1. ✅ Bid status: PENDING → ACCEPTED
2. ✅ Job status: OPEN → IN_PROGRESS
3. ✅ Job.accepted_bid_id = bid.id
4. ✅ **Notification sent to ACCEPTED worker**
5. ✅ **Notifications sent to REJECTED workers**
6. ✅ All workers see job status update in real-time
7. ✅ Poster sees status update in real-time

**Real-Time Requirements:**
```
Poster Device → Accept Bid:
  - UPDATE bids SET status = 'ACCEPTED' WHERE id = bid.id
  - UPDATE jobs SET status = 'IN_PROGRESS', accepted_bid_id = bid.id
  - Trigger: notify_workers_on_bid_accept() fires
  
Accepted Worker Device:
  - Notification: "Congratulations! Your bid was accepted"
  - Job card updates: status → IN_PROGRESS
  - Chat unlocks
  
Rejected Workers Devices:
  - Notification: "Job filled by another worker"
  - Job card updates: status → IN_PROGRESS (no longer open)
```

**Notification Requirements:**
```
For Accepted Worker:
  Type: bid_accepted
  Title: "Bid Accepted! 🎉"
  Message: "Your bid of ₹500 for 'Plumber needed' was accepted"
  related_job_id: job.id
  
For Rejected Workers:
  Type: bid_rejected
  Title: "Job Filled"
  Message: "'Plumber needed' was filled by another worker"
  related_job_id: job.id
```

**Current Implementation Status:**
- [ ] Trigger: notify_workers_on_bid_accept() - MISSING!
- [ ] Real-time updates for job status change
- [ ] Real-time updates for bid status change
- [ ] Notifications to all bidders

---

### **POSTER STAGE 5: Chat with Worker**

**Action:** Poster sends/receives messages

**What Should Happen:**
1. ✅ Message sent appears instantly for both
2. ✅ **Notification sent to OTHER party** when new message
3. ✅ If recipient app minimized: **Push notification**
4. ✅ If recipient app open but chat closed: **In-app notification**
5. ✅ If recipient in chat: **NO notification** (already viewing)

**Real-Time Requirements:**
```
Sender Device → Send Message:
  - INSERT into chat_messages
  - Trigger: notify_recipient_of_message() fires
  
Recipient Device → Real-time:
  - postgres_changes: INSERT on chat_messages
  - If in chat: Message appears instantly
  - If not in chat: Notification created
  - Bell icon +1
```

**Notification Requirements:**
```
Type: new_message
Title: "New Message"
Message: "Rajesh: When can you start?"
related_job_id: job.id
```

**Push Notification (if app minimized):**
```
FCM Payload:
  notification:
    title: "New Message from Rajesh"
    body: "When can you start?"
  data:
    jobId: job.id
    chatId: chat.id
```

**Current Implementation Status:**
- [ ] Trigger: notify_recipient_of_message() - CHECK IF EXISTS
- [ ] Real-time chat messages - ✅ EXISTS (UserContextDB)
- [ ] Notification suppression when chat is open (activeChatId)
- [ ] Push notification for messages

---

### **POSTER STAGE 6: Job Completion**

**Action:** Poster marks job as complete

**What Should Happen:**
1. ✅ Job status: IN_PROGRESS → COMPLETED
2. ✅ Worker wallet credited (bid amount - commission)
3. ✅ **Notification sent to worker**
4. ✅ Both see job status update in real-time
5. ✅ Review prompts shown to both

**Real-Time Requirements:**
```
Poster Device → Mark Complete:
  - UPDATE jobs SET status = 'COMPLETED'
  - RPC: complete_job_and_pay_worker()
  - Trigger: notify_on_job_completion()
  
Worker Device:
  - Notification: "Job completed! ₹450 credited"
  - Wallet balance updates in real-time
  - Job status updates
```

**Notification Requirements:**
```
For Worker:
  Type: job_completed
  Title: "Job Completed! 💰"
  Message: "₹450 has been credited to your wallet"
  related_job_id: job.id
```

**Current Implementation Status:**
- [ ] Trigger: notify_on_job_completion() - MISSING!
- [ ] Real-time wallet balance update
- [ ] Job status real-time update

---

### **POSTER STAGE 7: Leave Review**

**Action:** Poster rates the worker

**What Should Happen:**
1. ✅ Review inserted to database
2. ✅ Worker's overall rating recalculated
3. ✅ **Notification sent to worker**
4. ✅ Worker sees rating update in real-time

**Real-Time Requirements:**
```
Poster Device → Submit Review:
  - INSERT into reviews
  - Trigger: update_user_rating() (updates profiles.rating)
  - Trigger: notify_on_review()
  
Worker Device:
  - Notification: "New review from Customer"
  - Profile rating updates in real-time
```

**Notification Requirements:**
```
Type: review_received
Title: "New Review ⭐"
Message: "Customer rated you 5 stars!"
related_job_id: job.id
```

**Current Implementation Status:**
- [ ] Trigger: update_user_rating() - CHECK IF EXISTS
- [ ] Trigger: notify_on_review() - MISSING
- [ ] Real-time rating update

---

## 🔨 WORKER JOURNEY ANALYSIS

### **WORKER STAGE 1: Browse Jobs**

**Action:** Worker scrolls job feed

**What Should Happen:**
1. ✅ All OPEN jobs visible
2. ✅ New jobs appear instantly (real-time)
3. ✅ Jobs update when status changes (OPEN → IN_PROGRESS)
4. ❌ **NO notifications** for new jobs (would be spam)

**Real-Time Requirements:**
```
Worker Device → JobContext:
  - postgres_changes: INSERT on jobs (status = OPEN)
  - postgres_changes: UPDATE on jobs
  - New job cards appear
  - Job cards update/disappear when status changes
```

**Notification Requirements:** NONE

**Current Implementation Status:**
- [ ] JobContext subscribes to INSERT on jobs
- [ ] JobContext subscribes to UPDATE on jobs
- [ ] Job feed updates in real-time

---

### **WORKER STAGE 2: Place Bid**

**Action:** Worker submits a bid

**What Should Happen:**
1. ✅ Bid inserted to database
2. ✅ **Notification sent to POSTER** ← We already have this!
3. ✅ Worker sees their bid in "My Bids"
4. ✅ Job card shows "You bid ₹500" or similar indicator
5. ❌ **NO notification to worker** (they initiated it)

**Real-Time Requirements:**
```
Worker Device → Submit Bid:
  - INSERT into bids
  - Trigger: notify_poster_of_new_bid() ✅
  
Poster Device:
  - Notification appears ✅
  - Bid count updates ✅
```

**Notification Requirements:** NONE for worker

**Current Implementation Status:**
- [x] Trigger exists ✅
- [ ] Worker sees their bid in UI
- [ ] Job card shows bid indicator

---

### **WORKER STAGE 3: Wait for Response**

**Action:** Poster sends counter offer or accepts/rejects

**What Should Happen:**

**Scenario A: Counter Offer**
1. ✅ Bid.negotiation_history updated
2. ✅ Bid.amount may change
3. ✅ **Notification sent to worker**
4. ✅ Worker sees updated bid in real-time

**Scenario B: Bid Accepted**
1. ✅ Bid.status: PENDING → ACCEPTED
2. ✅ **Notification sent to worker** (acceptance)
3. ✅ Payment prompt shown
4. ✅ Chat unlocks after payment

**Scenario C: Bid Rejected**
1. ✅ Bid.status: PENDING → REJECTED
2. ✅ **Notification sent to worker**

**Real-Time Requirements:**
```
Poster Device → Counter/Accept/Reject:
  - UPDATE bids
  - Trigger fires based on action
  
Worker Device:
  - postgres_changes: UPDATE on bids
  - Notification appears
  - Bid status updates in UI
```

**Notification Requirements:**
```
Counter Offer:
  Type: counter_offer
  Title: "Counter Offer"
  Message: "Customer offered ₹450 for 'Plumber needed'"
  
Accepted:
  Type: bid_accepted
  Title: "Bid Accepted! 🎉"
  Message: "Your bid was accepted. Pay ₹20 to unlock chat"
  
Rejected:
  Type: bid_rejected
  Title: "Bid Not Selected"
  Message: "Your bid for 'Plumber needed' was not selected"
```

**Current Implementation Status:**
- [ ] Trigger: notify_on_counter_offer() - MISSING
- [ ] Trigger: notify_on_bid_accept() - MISSING
- [ ] Trigger: notify_on_bid_reject() - MISSING
- [ ] Real-time bid status updates

---

### **WORKER STAGE 4: Pay Connection Fee**

**Action:** Worker pays to unlock chat

**What Should Happen:**
1. ✅ Wallet debited ₹20
2. ✅ Chat unlocked for both parties
3. ✅ **Notification sent to POSTER** (worker paid, ready to chat)
4. ✅ Worker sees wallet balance update in real-time

**Real-Time Requirements:**
```
Worker Device → Pay Fee:
  - RPC: pay_connection_fee()
  - Wallet balance updated
  
Both Devices:
  - Chat becomes accessible
  - Notification to poster
```

**Notification Requirements:**
```
For Poster:
  Type: worker_ready
  Title: "Worker Ready"
  Message: "Rajesh paid and is ready to chat!"
  related_job_id: job.id
```

**Current Implementation Status:**
- [ ] Trigger: notify_on_payment() - MISSING
- [ ] Real-time wallet update

---

### **WORKER STAGE 5-7: Chat, Complete, Review**

Same as Poster stages 5-7 (mirror)

---

## 🔍 MISSING TRIGGERS IDENTIFIED

### 1. ❌ `notify_on_bid_accept()`
**When:** Poster accepts a bid  
**Notify:** Accepted worker + All rejected workers  
**Status:** MISSING - CRITICAL!

### 2. ❌ `notify_on_counter_offer()`
**When:** Poster sends counter offer  
**Notify:** Worker who placed the bid  
**Status:** MISSING

### 3. ❌ `notify_on_bid_reject()`
**When:** Poster explicitly rejects a bid  
**Notify:** Worker who placed the bid  
**Status:** MISSING

### 4. ❌ `notify_on_job_completion()`
**When:** Job marked as complete  
**Notify:** Worker (payment confirmed)  
**Status:** MISSING - CRITICAL!

### 5. ❌ `notify_on_review()`
**When:** Someone leaves a review  
**Notify:** Person being reviewed  
**Status:** MISSING

### 6. ❌ `notify_on_payment()`
**When:** Worker pays connection fee  
**Notify:** Poster (worker ready to start)  
**Status:** MISSING

### 7. ❓ `notify_recipient_of_message()`
**When:** New chat message  
**Notify:** Recipient (if not in chat)  
**Status:** Need to verify if exists

---

## 📋 REAL-TIME SUBSCRIPTIONS AUDIT

### JobContextDB Required Subscriptions:

```typescript
1. jobs table:
   - INSERT: New jobs appear
   - UPDATE: Job status changes reflected
   - DELETE: Jobs removed from feed
   
2. bids table:
   - INSERT: Bid counts update on job cards
   - UPDATE: Bid status changes reflected
   - DELETE: Bid counts decrease
```

**Current Status:** Need to verify

---

### UserContextDB Required Subscriptions:

```typescript
1. notifications table:
   - INSERT: New notifications appear ✅ EXISTS
   - UPDATE: Read status updates ❓
   - DELETE: Notifications removed ❓
   
2. profiles table (own):
   - UPDATE: Wallet balance, rating updates ✅ EXISTS
```

**Current Status:** Mostly exists

---

### ViewBidsModal Required Subscriptions:

```typescript
1. bids table (for specific job):
   - INSERT: New bids appear ✅ ADDED
   - UPDATE: Bid amounts/status update ✅ ADDED
   - DELETE: Bids removed ✅ ADDED
```

**Current Status:** ✅ Complete (we just added this)

---

## 🎯 COMPREHENSIVE FIX PLAN

### Phase 1: Database Triggers (HIGH PRIORITY)
Create all missing notification triggers

### Phase 2: Real-Time Subscriptions
Verify and fix all real-time subscriptions

### Phase 3: Push Notifications
Ensure edge function is called for all notification types

### Phase 4: UI Updates
Ensure all real-time changes reflect in UI

### Phase 5: Notification Suppression
Prevent duplicate notifications when user is actively viewing

---

## 📊 NOTIFICATION MATRIX

| Event | Poster Notified? | Worker Notified? | Push if Minimized? |
|-------|------------------|------------------|-------------------|
| Job Posted | ❌ No | ❌ No | N/A |
| Bid Placed | ✅ Yes | ❌ No | ✅ Yes |
| Bid Accepted | ❌ No | ✅ Yes | ✅ Yes |
| Bid Rejected | ❌ No | ✅ Yes | ✅ Yes |
| Counter Offer | ❌ No | ✅ Yes | ✅ Yes |
| Connection Fee Paid | ✅ Yes | ❌ No | ✅ Yes |
| New Message | ✅ Yes (if not in chat) | ✅ Yes (if not in chat) | ✅ Yes |
| Job Completed | ❌ No | ✅ Yes | ✅ Yes |
| Review Received | ✅ Yes | ✅ Yes | ✅ Yes |

---

## 🚀 NEXT STEPS

1. **Create all missing database triggers**
2. **Audit JobContextDB real-time subscriptions**
3. **Ensure edge function is called for all notification types**
4. **Test every stage with 2 devices**
5. **Verify push notifications work when app minimized**

This is a COMPREHENSIVE plan. Ready to implement?
