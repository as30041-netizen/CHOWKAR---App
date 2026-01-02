# 🔧 **FIX: "Database error saving new user"**

## 🚨 **The Problem**

Your console showed:
```
error=server_error&error_description=Database+error+saving+new+user
```

**Root Cause**: The auto-profile creation trigger was using **the wrong ID**!

---

## 🔍 **What Was Wrong**

In your existing trigger (`add_auto_profile_creation_trigger.sql`):

```sql
-- LINE 54 - WRONG! ❌
id: gen_random_uuid(),  -- Creates random UUID
auth_user_id: NEW.id,   -- Stores actual auth ID here
```

But your RLS policies check:
```sql
-- This never matches because id is random, not auth.uid()! ❌
auth.uid() = id
```

**Result**: 
- Profile `id` = random UUID (e.g., `abc123...`)
- Auth user id = different UUID (e.g., `xyz789...`)
- RLS policy checks if `auth.uid() = id` → **FAILS!**
- Supabase throws "Database error saving new user"

---

## ✅ **The Fix**

I created: **`COMPLETE_AUTH_FIX.sql`**

This script:

1. **Fixes the trigger** to use auth user ID as profile ID:
   ```sql
   id: NEW.id,          -- ✅ Same as auth user id
   auth_user_id: NEW.id -- ✅ Also stored here
   ```

2. **Simplifies RLS policies** to work with the trigger

3. **Adds service role policy** so trigger can bypass RLS

4. **Handles re-authentication** with ON CONFLICT clause

---

## 🚀 **How to Apply the Fix**

### **Step 1: Run the Complete Fix**

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Open: `COMPLETE_AUTH_FIX.sql`
4. Copy entire content
5. Paste into SQL Editor
6. Click **Run**

### **Step 2: Verify Success**

You should see two result tables:

**Trigger Check:**
| check_type | name | enabled |
|------------|------|---------|
| Trigger Check | on_auth_user_created | t |

**Policy Check:**
| check_type | name | command | roles |
|------------|------|---------|-------|
| Policy Check | Service role has full access | ALL | service_role |
| Policy Check | Users can update own profile | UPDATE | authenticated |
| Policy Check | Users can view other profiles for jobs | SELECT | authenticated |
| Policy Check | Users can view own profile | SELECT | authenticated |

---

## 🧪 **Test Again**

After running the SQL script:

1. **Uninstall old APK** from phone (important!)
   ```bash
   adb uninstall in.chowkar.app
   ```

2. **Rebuild and reinstall**
   ```bash
   npm run build
   npx cap sync android
   # Then build APK in Android Studio
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```

3. **Test Google Sign-In**
   - Open app
   - Click "Get Started with Google"
   - Sign in with Google
   - **Expected**: Browser closes, app shows main interface ✅

---

## 📊 **Expected Console Output (Success)**

After fix, you should see:
```
[Auth] Initiating Google OAuth, redirect URL: in.chowkar.app://callback
[Auth] Platform: android
[Auth] Opening OAuth URL in Browser plugin
[DeepLink] Received URL: in.chowkar.app://callback?access_token=...
[DeepLink] Handling OAuth callback
[DeepLink] Setting session from tokens
[DeepLink] Session set successfully!
[App] OAuth callback handled, refreshing auth
[Auth] Profile found, processing...
```

**No more "Database error saving new user"!** ✅

---

## 🔍 **Why This Fix Works**

### **Before Fix:**
```
Auth User ID: xyz789...
Profile ID:   abc123... (random UUID)
RLS Check:    auth.uid() = id → FALSE ❌
Result:       Database error!
```

### **After Fix:**
```
Auth User ID: xyz789...
Profile ID:   xyz789... (same as auth user!)
RLS Check:    auth.uid() = id → TRUE ✅
Result:       Profile created successfully!
```

---

## ⚠️ **Important Notes**

1. **Uninstall old APK** before testing:
   - Old sessions might be cached
   - Fresh install ensures clean test

2. **Delete test users** (optional):
   - Go to Supabase → Authentication → Users
   - Delete any test users you created during failed attempts
   - They have wrong profile IDs and won't work

3. **The trigger runs with SECURITY DEFINER**:
   - This means it bypasses RLS
   - That's why we don't need an INSERT policy for profiles
   - Normal users can't insert profiles directly (only via auth trigger)

---

## 🎯 **Summary**

**Issue**: Profile ID didn't match Auth User ID → RLS policies failed → Database error

**Fix**: Changed trigger to use Auth User ID as Profile ID → RLS policies work → Success!

**Action**: 
1. Run `COMPLETE_AUTH_FIX.sql` in Supabase
2. Rebuild APK
3. Test Google Sign-In
4. Should work now! 🎉

---

## 🆘 **If Still Not Working**

Check:
1. SQL script ran without errors
2. Trigger is enabled (check verification output)
3. 4 policies are created (check verification output)
4. Old APK was uninstalled before reinstalling
5. Using a fresh Google account (not one that failed before)

**Console should show**:
- ✅ `[DeepLink] Session set successfully!`
- ❌ NO "Database error saving new user"

---

**Ready to test? Run that SQL script and rebuild! 🚀**
