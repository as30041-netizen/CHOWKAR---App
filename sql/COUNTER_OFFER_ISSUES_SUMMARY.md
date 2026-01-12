# Counter Offer Issues - Summary & Fixes

## 🐛 Issues Identified

### 1. **Duplicate Notifications** ✅ FIXED
- **Problem**: Worker receives 2 identical notifications when poster sends a counter
- **Root Cause**: Possible multiple triggers or trigger firing multiple times
- **Fix**: `FIX_COUNTER_DUPLICATE_AND_SELF_NOTIFY.sql`
  - Drops all duplicate triggers
  - Adds history length check to prevent re-triggering  
  - Only fires when negotiation_history grows

### 2. **Self-Notification** ✅ FIXED  
- **Problem**: Worker receives "Employer countered with ₹220" when WORKER sent the counter
- **Root Cause**: Trigger not correctly reading `negotiation_history->-1->>'by'` field
- **Fix**: `FIX_COUNTER_DUPLICATE_AND_SELF_NOTIFY.sql`
  - Properly extracts `by` field from last negotiation entry
  - If POSTER countered → Notifies WORKER
  - If WORKER countered → Notifies POSTER
  - Added debug logging to trace execution

### 3. **Incorrect Turn Indicator** ⚠️ REQUIRES FRONTEND FIX
- **Problem**: Job card shows "WORKER COUNTERED - YOUR TURN" when poster countered
- **Root Cause**: Frontend logic in `JobCard.tsx` line 151-156
  ```typescript
  if (job.myBidLastNegotiationBy === UserRole.WORKER || job.hasNewCounter) {
    return "Worker countered - Your turn"
  }
  ```
  This is backwards - if worker countered, it's the POSTER's turn.
  
- **Fix Needed**: Reverse the logic

## 📝 SQL Script to Run

Run this script in Supabase SQL Editor:
```
sql/FIX_COUNTER_DUPLICATE_AND_SELF_NOTIFY.sql
```

This script will:
1. ✅ Check for and remove duplicate triggers
2. ✅ Create a fixed counter offer notification function
3. ✅ Add safeguards against re-triggering
4. ✅ Correctly identify who sent the counter
5. ✅ Only notify the OTHER party

## 🧪 Test Plan

After running the SQL script:

### Test Case 1: Worker Sends Counter
1. **As Worker**: Open job with pending bid
2. **As Worker**: Send counter offer (e.g., ₹3000 → ₹3500)
3. **Expected Results**:
   - ✅ Worker receives NO notification
   - ✅ Poster receives 1 notification: "New Counter Offer 💰 - [Worker Name] proposed ₹3500"
   - ❌ UI still shows wrong turn (needs frontend fix)

### Test Case 2: Poster Sends Counter  
1. **As Poster**: Review bid and send counter offer
2. **Expected Results**:
   - ✅ Poster receives NO notification
   - ✅ Worker receives 1 notification: "Counter Offer Received 💸 - Employer countered with ₹[amount]"
   - ❌ UI may show wrong turn (needs frontend fix)

## 🔧 Frontend Fix Still Needed

The UI turn indicator logic needs to be inverted. Currently at `JobCard.tsx:151-156`:

**Current (Wrong)**:
```typescript
if (job.myBidLastNegotiationBy === UserRole.WORKER) {
  return "Worker countered - Your turn" // Shows when worker countered
}
```

**Should Be**:
```typescript
if (job.myBidLastNegotiationBy === UserRole.WORKER) {
  return "Worker countered - Their turn" // Worker needs to wait
}
// OR better:
if (job.myBidLastNegotiationBy === UserRole.POSTER) {
  return "Your counter sent - Their turn" // Poster countered, worker's turn
}
```

The logic should be:
- If last turn was WORKER → POSTER's turn (not worker's turn!)
- If last turn was POSTER → WORKER's turn (not poster's turn!)

## 📊 Summary

| Issue | Status | Fix Location |
|-------|--------|-------------|
| Duplicate Notifications | ✅ Fixed | SQL Script |
| Self-Notifications | ✅ Fixed | SQL Script |
| Wrong Turn Indicator | ⚠️ Pending | Frontend Code |
