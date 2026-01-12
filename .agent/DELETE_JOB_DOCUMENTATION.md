# Delete Job Feature - Current Implementation

## Overview
The delete job feature allows job posters to permanently remove their job postings from the platform.

## How It Works

### 1. **Where Is The Delete Button?**
Located in: **JobDetailsModal** (when viewing job details)

### 2. **Who Can See It?**
**Only the Job Poster** who created the job

### 3. **When Can You Delete?**

The delete button appears ONLY when **ALL** these conditions are met:

✅ **Condition 1**: `liveJob.status === JobStatus.OPEN`
   - Job must be in OPEN status
   - Cannot delete jobs that are IN_PROGRESS or COMPLETED

✅ **Condition 2**: `!liveJob.acceptedBidId`
   - No bid has been accepted yet
   - Once you accept a bid, you can NO LONGER delete

**Code Reference:**
```tsx
{liveJob.status === JobStatus.OPEN && !liveJob.acceptedBidId && (
    <button onClick={() => { if (confirm(t.deleteJobPrompt)) onDelete(liveJob.id); }}>
        <Trash2 size={20} />
    </button>
)}
```

### 4. **Delete Flow**

#### Step 1: User Clicks Delete Button
- Shows confirmation dialog: "Are you sure you want to delete this job?"

#### Step 2: User Confirms
- **Optimistic Update**: Job immediately removed from UI
- **Database Call**: DELETE request sent to Supabase

#### Step 3: Database Action
```typescript
// services/jobService.ts
await supabase
  .from('jobs')
  .delete()
  .eq('id', jobId);
```

#### Step 4: Success/Error Handling
- **✅ Success**: 
  - Job removed from state
  - Modal closes
  - Shows success alert: "Job deleted successfully"
  
- **❌ Error**:
  - Rollback: Job restored in UI
  - Shows error alert: "Failed to delete job"

### 5. **What Happens to Related Data?**

**When a job is deleted:**

✅ **Bids**: Automatically deleted (CASCADE)
- Database foreign key constraint handles this
- All bids associated with the job are removed

✅ **Notifications**: Remain (for historical record)
- Workers who bid will still see past notifications
- But the job itself is gone

✅ **Transactions**: Remain (for accounting)
- Any fees paid are not refunded
- Transaction history preserved

✅ **Images**: Currently NOT deleted
- Job images remain in storage
- ⚠️ Potential issue: orphaned images

## Current Limitations & Issues

### ⚠️ Issue 1: Can Delete Job With Bids
**Problem**: You can delete a job even if workers have placed bids (as long as no bid is accepted)

**Current Behavior:**
- Job has 5 pending bids → Can delete ✅
- Job has 1 accepted bid → Cannot delete ❌

**Should It Be:**
- Job has ANY bids → Cannot delete? (safer)
- Or current behavior is OK?

**Code Check:**
```tsx
// Edit button check
{liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && (
    <button onClick={() => onEdit(liveJob)}>Edit</button>
)}
// But delete button doesn't check bids.length!
```

### ⚠️ Issue 2: No Image Cleanup
**Problem**: When job is deleted, uploaded images are not removed from storage

**Impact**:
- Wasted storage space
- Orphaned files accumulate

**Fix Needed**:
```typescript
// Should add in deleteJob function:
if (job.image) {
  await deleteJobImage(job.image);
}
```

### ⚠️ Issue 3: No Notification to Bidders
**Problem**: Workers who placed bids are not notified when job is deleted

**Current**: Job just disappears
**Better**: Send notification: "Job you bid on has been cancelled"

## Recommendations

### 1. **Prevent Delete If Has Bids**
```typescript
// Change condition to:
{liveJob.status === JobStatus.OPEN && liveJob.bids.length === 0 && !liveJob.acceptedBidId && (
    <button onClick={() => { if (confirm(t.deleteJobPrompt)) onDelete(liveJob.id); }}>
        <Trash2 size={20} />
    </button>
)}
```

### 2. **Add Image Cleanup**
Modify `deleteJob` in `jobService.ts`:
```typescript
export const deleteJob = async (jobId: string) => {
  // 1. Get job details first
  const { data: job } = await supabase.from('jobs').select('image').eq('id', jobId).single();
  
  // 2. Delete image if exists
  if (job?.image) {
    await deleteJobImage(job.image);
  }
  
  // 3. Delete job
  await supabase.from('jobs').delete().eq('id', jobId);
};
```

### 3. **Notify Bidders**
Add notification trigger in SQL:
```sql
CREATE OR REPLACE FUNCTION notify_bidders_on_job_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  SELECT 
    worker_id,
    'Job Cancelled',
    'A job you bid on has been deleted by the poster',
    'WARNING'
  FROM bids
  WHERE job_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

## Summary

**Current State:**
✅ Basic delete works
✅ Shows only to poster
✅ Requires confirmation
✅ Optimistic UI updates
❌ Can delete with pending bids
❌ Doesn't clean up images
❌ Doesn't notify bidders

**Recommended Improvements:**
1. Prevent delete if job has ANY bids
2. Clean up associated images
3. Notify workers who placed bids
4. Consider refund logic for highlighted bids

Would you like me to implement any of these improvements?
