# Push Notification Bugs - Complete Analysis

## Architecture Overview

**Current System**:
```
DB Trigger → Notification Insert → Supabase Realtime → Frontend → LocalNotification
```

**Problem**: LocalNotifications only work when app process is alive!

---

## 🐛 BUG 1: Push Notifications NEVER Work When App Killed

**Location**: `UserContextDB.tsx` line 466-482

**Current Code**:
```typescript
if (Capacitor.isNativePlatform() && shouldSendPushNotification()) {
  LocalNotifications.schedule({...}); // ❌ Only works when app alive
}
```

**Problem**:
- LocalNotifications are LOCAL - they require the app process to be running
- When app is killed (not even in background), Realtime subscription is DEAD
- No way to receive notifications when app completely closed

**Impact**: Worker never sees bid acceptance notification if app was closed

**Solution Required**: 
- FCM (Firebase Cloud Messaging) for true push delivery
- Trigger calls Edge Function → Edge Function calls FCM → FCM delivers to device
- This works even when app is killed

---

## 🐛 BUG 2: FCM Registered But Never Used

**Location**: `pushService.ts` line 28-29

**Code**:
```typescript
await PushNotifications.register();  // ✅ Registers with FCM
```

**But**: Token is saved to DB (`profiles.push_token`) but **never used to send pushes**!

**Current**: Token sits in database unused
**Missing**: Backend calls to Edge Function to send FCM messages

**Solution**:
- DB Triggers need to call Edge Function after inserting notification
- Edge Function (`send-push-notification`) already exists but isn't triggered!

---

## 🐛 BUG 3: Edge Function Not Connected to Triggers

**Location**: `supabase/functions/send-push-notification/index.ts` - EXISTS but unused

**Problem**: 
- Edge Function is fully implemented (FCM v1 + Legacy support)
- But NO trigger calls it
- Notifications only delivered via Realtime (app must be open)

**Solution**: Add `pg_net` HTTP call in triggers:
```sql
-- After INSERT notification:
PERFORM net.http_post(
  'https://[project].supabase.co/functions/v1/send-push-notification',
  headers := '{"Authorization": "Bearer [service-key]"}',
  body := json_build_object('userId', recipient_id, 'title', 'Title', 'body', 'Message')
);
```

---

## 🐛 BUG 4: setupPushListeners Never Called

**Location**: `pushService.ts` line 67-84

**Code**:
```typescript
export const setupPushListeners = (
    onNotificationReceived: (notification: PushNotificationSchema) => void,
    onNotificationClicked: (notification: ActionPerformed) => void
) => {...}
```

**Problem**: This function EXISTS but is never called in the app!

**Why It Matters**:
- When FCM push arrives while app is open, `pushNotificationReceived` fires
- When user taps FCM push, `pushNotificationActionPerformed` fires
- Neither is handled because listeners not setup

---

## 🐛 BUG 5: Duplicate LocalNotification Listeners

**Location**: `UserContextDB.tsx` line 531 AND line 554

**Issue**:
```typescript
// Line 531
LocalNotifications.addListener('localNotificationActionPerformed', ...);

// Line 554
LocalNotifications.removeAllListeners(); // Removes on unmount
```

**Problem**: 
- If component remounts, listeners are added again
- No check if listener already exists
- Could cause multiple handlers for same event

---

## 🐛 BUG 6: appIsActive Initial State Wrong

**Location**: `appStateService.ts` line 4

**Code**:
```typescript
let appIsActive = true;  // ❌ Assumes foreground
```

**Problem**: 
- When app starts from notification tap, it might be in background
- Initial state assumes foreground = wrong
- First notification might not trigger push correctly

---

## 🐛 BUG 7: No Retry for Failed LocalNotifications

**Location**: `UserContextDB.tsx` line 482

**Code**:
```typescript
.catch(err => console.error('[LocalNotification] Error:', err));
```

**Problem**: 
- If LocalNotification fails, it's just logged
- No retry mechanism
- Notification lost silently

---

## 🐛 BUG 8: Web Push Not Implemented

**Problem**: 
- Web app has NO push notification support
- No Service Worker for web push
- Notifications only work when tab is open

**Impact**: Web users miss all notifications when tab closed

---

## 🐛 BUG 9: Notification ID Collision Risk

**Location**: `UserContextDB.tsx` line 471

**Code**:
```typescript
id: Math.floor(Date.now() % 100000000), // Integer ID required
```

**Problem**:
- If two notifications within same 100ms → same ID
- Could cause notification replacement instead of addition
- Should use unique counter or combined with random

---

## 🐛 BUG 10: Missing Push for Chat Unlock

**Problem**:
- When poster messages unpaid worker
- Worker gets "Pay ₹50 to unlock" notification
- But this is only in-app (LocalNotification)
- If app closed, worker never knows poster is waiting!

**Impact**: Worker might never pay because they don't know employer is waiting

---

## Priority Fix Order

### P0 - Critical (Business Impact)
1. **BUG 3**: Connect Edge Function to triggers
2. **BUG 2**: Actually USE the FCM tokens
3. **BUG 10**: Push for chat unlock prompt

### P1 - High
4. **BUG 1**: True background push delivery
5. **BUG 4**: Setup FCM listeners

### P2 - Medium
6. **BUG 6**: App state initial value
7. **BUG 9**: Notification ID uniqueness

### P3 - Low
8. **BUG 5**: Duplicate listener prevention
9. **BUG 7**: Retry mechanism
10. **BUG 8**: Web push (future feature)

---

## Immediate Fix SQL (Trigger → Edge Function)

```sql
-- Add this to each notification trigger AFTER the INSERT

-- For new bid notification:
PERFORM net.http_post(
  url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
  headers := json_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
  )::jsonb,
  body := json_build_object(
    'userId', v_job.poster_id,
    'title', 'New Bid: ₹' || NEW.amount || ' 🔔',
    'body', v_worker_name || ' wants to work on "' || v_job.title || '". Review now!',
    'data', json_build_object('jobId', NEW.job_id::TEXT, 'type', 'new_bid')
  )::jsonb
);
```

**Note**: Requires `pg_net` extension and environment variables configured in Supabase.

---

## Testing After Fixes

1. **Kill app completely** (swipe away)
2. **Have another user trigger notification**
3. **Expected**: Device shows system notification
4. **Tap notification** → App opens to correct screen
