# 🔔 Complete Push Notification Fix

## ✅ What's Already Set Up
1. ✅ Edge function: `supabase/functions/send-push-notification/index.ts`
2. ✅ Google services plugin configured
3. ✅ `google-services.json` exists
4. ✅ Frontend code: `pushService.ts`
5. ✅ Database: `push_token` column in profiles

## ❌ What's Missing (Causing push not to work)

### 1. Android Permissions & Configuration
### 2. Firebase Dependencies
### 3. Database Triggers to Call Edge Function
### 4. Testing & Verification

---

## Fixes Required

### Fix 1: Update AndroidManifest.xml

**File:** `android/app/src/main/AndroidManifest.xml`

**Add POST_NOTIFICATIONS permission** (required for Android 13+):

```xml
<!-- Add this BEFORE the <application> tag -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Result:** Line 56-61 should become:
```xml
<!-- Permissions -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

### Fix 2: Add Firebase Dependencies

**File:** `android/app/build.gradle`

**Add Firebase BOM and Messaging** after line 46:

```gradle
dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation project(':capacitor-android')
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
    implementation project(':capacitor-cordova-android-plugins')
    
    // Add these lines
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

---

### Fix 3: Create Database Trigger

**File:** Create `SETUP_PUSH_TRIGGERS.sql`

This trigger will call the edge function when a notification is created:

```sql
-- ============================================
-- PUSH NOTIFICATION TRIGGERS
-- ============================================

-- Drop existing if any
DROP TRIGGER IF EXISTS on_notification_send_push ON notifications;
DROP FUNCTION IF EXISTS trigger_push_notification();

-- Create function to call edge function
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Only send push for certain notification types
  -- Skip if notification is for bid (already handled by real-time)
  -- IF NEW.type IN ('bid_received', 'chat_message') THEN
  
  -- Get push token
  SELECT push_token INTO v_token
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Only proceed if user has a token
  IF v_token IS NOT NULL THEN
    -- Get Supabase URL and service key from config
    v_supabase_url := current_setting('app.settings', true)::json->>'supabase_url';
    v_service_key := current_setting('app.settings', true)::json->>'service_role_key';
    
    -- If settings not available, use environment or hardcode
    IF v_supabase_url IS NULL THEN
      -- Replace with your actual Supabase URL
      v_supabase_url := 'https://your-project.supabase.co';
    END IF;
    
    -- Call edge function via HTTP
    -- Note: This requires pg_net extension or similar
    -- For now, we'll log it and rely on client-side calling
    RAISE NOTICE 'Would send push to user % for notification %', NEW.user_id, NEW.id;
    
    -- Uncomment if pg_net is available:
    /*
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'title', NEW.title,
        'body', NEW.message,
        'data', jsonb_build_object(
          'notificationId', NEW.id,
          'jobId', NEW.related_job_id
        )
      )::text
    );
    */
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER on_notification_send_push
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION trigger_push_notification();

-- Verify trigger was created
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  'ACTIVE' as status
FROM pg_trigger
WHERE tgname = 'on_notification_send_push';
```

**IMPORTANT:** The pg_net extension is typically not available in Supabase. Instead, we'll use **client-side push** calling the edge function directly.

---

### Fix 4: Client-Side Push Integration

Since database triggers can't reliably call edge functions, we'll call the edge function from the app code when creating notifications.

**Update:** `contexts/UserContextDB.tsx`

Find the `addNotification` function and add push notification call:

```typescript
const addNotification = async (
  userId: string,
  title: string,
  message: string,
  type: string,
  relatedJobId?: string
) => {
  try {
    // Insert notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        related_job_id: relatedJobId,
        read: false
      })
      .select()
      .single();

    if (error) throw error;

    // Send push notification via edge function
    if (userId !== user.id) { // Don't send push to yourself
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        await fetch(`${supabase.supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId,
            title,
            body: message,
            data: {
              notificationId: data.id,
              jobId: relatedJobId || ''
            }
          })
        });
        
        console.log('[Push] Notification sent to user:', userId);
      } catch (pushError) {
        console.warn('[Push] Failed to send push notification:', pushError);
        // Don't throw - notification was created successfully
      }
    }

    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
```

---

## Deployment Steps

### Step 1: Update Android Files

1. **AndroidManifest.xml:**
   - Add `POST_NOTIFICATIONS` permission

2. **android/app/build.gradle:**
   - Add Firebase dependencies

### Step 2: Rebuild Android Project

```powershell
# Sync Capacitor
npx cap sync android

# Clean and rebuild
cd android
.\gradlew clean
.\gradlew assembleDebug
cd ..
```

### Step 3: Install and Test

```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

---

## Testing Checklist

### Test 1: Permission Request
- [ ] Open app
- [ ] Should request notification permission on first launch
- [ ] Grant permission
- [ ] Check console: `[Push] Registration successful, token: ...`

### Test 2: Token Registration
- [ ] Go to Supabase Dashboard → SQL Editor
- [ ] Run:
  ```sql
  SELECT id, name, push_token 
  FROM profiles 
  WHERE push_token IS NOT NULL;
  ```
- [ ] Verify your token appears

### Test 3: Test Push Notification
- [ ] Use another device or use Supabase SQL to insert notification:
  ```sql
  -- Replace {your-user-id} and {sender-id}
  INSERT INTO notifications (user_id, title, message, type, related_job_id)
  VALUES (
    '{your-user-id}',
    'Test Push',
    'This is a test push notification!',
    'info',
    NULL
  );
  ```

- [ ] **IMPORTANT:** Minimize or close the app
- [ ] Notification should appear on Android notification tray
- [ ] Tap notification → app should open

### Test 4: Real Scenario - New Bid
- [ ] Device A: Post a job
- [ ] Device A: Close/minimize app
- [ ] Device B: Submit a bid
- [ ] Device A: Should receive push notification
- [ ] Tap notification → should open app to View Bids

---

## Common Issues & Solutions

### Issue 1: No permission prompt
**Cause:** Android 13+ requires explicit permission  
**Fix:** Ensured POST_NOTIFICATIONS is in AndroidManifest

### Issue 2: Token not saving
**Check:**
```typescript
// In browser console / logcat
// Should see: [Push] Token saved to database
```

**Fix:** Verify profiles table has push_token column:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
```

### Issue 3: Push not received when app closed
**Possible causes:**
1. Edge function not deployed
2. FCM_SERVER_KEY not set in Supabase
3. Token invalid

**Debug:**
```sql
-- Check if edge function was called
-- Look in Supabase Edge Functions logs
```

### Issue 4: FCM_SERVER_KEY missing
**Get FCM Server Key:**
1. Go to Firebase Console
2. Project Settings → Cloud Messaging
3. Copy "Server key"
4. In Supabase Dashboard → Settings → Edge Functions → Secrets
5. Add: `FCM_SERVER_KEY` = your server key

---

## Verification SQL Queries

```sql
-- 1. Check push tokens registered
SELECT 
  p.name,
  p.push_token IS NOT NULL as has_token,
  p.created_at
FROM profiles p
ORDER BY p.created_at DESC
LIMIT 10;

-- 2. Check recent notifications
SELECT 
  n.title,
  n.message,
  n.user_id,
  p.name as recipient_name,
  p.push_token IS NOT NULL as can_receive_push,
  n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 10;

-- 3. Test edge function manually
-- Go to Supabase Dashboard → Edge Functions
-- Select send-push-notification
-- Test with:
{
  "userId": "your-user-id-here",
  "title": "Test",
  "body": "Testing push notification"
}
```

---

## Final Checklist

- [ ] AndroidManifest.xml updated with POST_NOTIFICATIONS
- [ ] build.gradle has Firebase dependencies
- [ ] google-services.json exists in android/app/
- [ ] Edge function deployed to Supabase
- [ ] FCM_SERVER_KEY set in Supabase secrets
- [ ] App rebuilt with `npx cap sync && gradlew assembleDebug`
- [ ] App requests notification permission
- [ ] Push token saves to database
- [ ] Test notification appears when app is closed

---

## Quick Deploy Commands

```powershell
# 1. Update files (AndroidManifest.xml, build.gradle)
# 2. Sync and build
npx cap sync android
cd android
.\gradlew clean assembleDebug
cd ..

# 3. Install
adb install android\app\build\outputs\apk\debug\app-debug.apk

# 4. Test
# - Open app, grant permission
# - Close app
# - Send test notification from Supabase
```

---

**Note:** The edge function `send-push-notification` is already created and looks perfect! Just need to ensure FCM_SERVER_KEY is configured in Supabase Edge Function secrets.
