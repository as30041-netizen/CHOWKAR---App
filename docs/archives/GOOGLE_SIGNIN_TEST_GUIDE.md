# 🧪 Google Sign-In Testing Guide for CHOWKAR APK

## ✅ Current Setup Status

Your Capacitor Android APK is properly configured with:

### ✅ **OAuth Flow Configuration**
- **Deep Link URL**: `in.chowkar.app://callback`
- **Capacitor Browser Plugin**: Installed and configured
- **PKCE Flow**: Enabled for native platforms
- **Deep Link Handler**: Implemented in `useDeepLinkHandler.ts`

### ✅ **Android Manifest**
- Deep link intent filters configured
- Scheme: `in.chowkar.app`
- Host: `callback`
- Alternative Capacitor scheme also configured

### ✅ **Supabase Configuration**
- PKCE flow for native platforms
- Session persistence enabled
- Auto-refresh token enabled
- Deep link detection enabled

---

## 📋 Pre-Testing Checklist

Before testing, ensure:

- [ ] **Supabase Dashboard Settings**:
  - Go to: **Authentication** → **URL Configuration**
  - Add these redirect URLs:
    ```
    https://chowkar.in
    https://your-web-domain.com
    in.chowkar.app://callback
    capacitor://localhost
    ```
  - **CRITICAL**: Make sure `in.chowkar.app://callback` is in the list!

- [ ] **Supabase RLS Policies**:
  - You mentioned you just fixed them
  - Verify `profiles` table has proper INSERT/SELECT policies
  - Check that authenticated users can create their own profiles

- [ ] **Google OAuth Provider**:
  - Ensure Google provider is enabled in Supabase
  - OAuth credentials are properly configured

---

## 🔨 Building the APK

### **Method 1: Using Android Studio (Recommended)**

```bash
# 1. Build the web app
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Wait for Gradle sync to complete
2. Go to: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build to complete
4. Click **"locate"** in the popup notification
5. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### **Method 2: Command Line**

```bash
# Build web app and sync
npm run build
npx cap sync android

# Build APK with Gradle
cd android
.\gradlew assembleDebug
cd ..
```

APK location: `android\app\build\outputs\apk\debug\app-debug.apk`

---

## 📱 Installing the APK

### **Option 1: USB Installation**

1. **Enable USB Debugging on your Android phone**:
   - Go to: **Settings** → **About Phone**
   - Tap **"Build Number"** 7 times
   - Go back → **Developer Options**
   - Enable **"USB Debugging"**

2. **Connect phone via USB**

3. **Install APK**:
```bash
adb devices  # Verify device is connected
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### **Option 2: Direct Installation**

1. Copy `app-debug.apk` to your phone (via USB, email, or cloud)
2. Open the APK file on your phone
3. Allow installation from unknown sources if prompted
4. Install the app

---

## 🧪 Testing Google Sign-In

### **Step 1: Launch the App**

1. Open the CHOWKAR app
2. You should see the landing page with "Get Started with Google" button

### **Step 2: Initiate Sign-In**

1. Click the **"Get Started with Google"** button
2. **Expected behavior**:
   - A browser window should open (using Capacitor Browser plugin)
   - You should be redirected to Google Sign-In page

### **Step 3: Sign In with Google**

1. Choose your Google account
2. Grant permissions
3. **Expected behavior**:
   - After successful authentication, the browser should close automatically
   - You should be redirected back to the CHOWKAR app
   - The app should process the OAuth callback

### **Step 4: Verify Success**

✅ **Successful Sign-In Indicators**:
- Browser closes automatically
- App shows the main interface (not landing page)
- You can see your profile in the Profile tab
- No errors in the console logs

❌ **Failed Sign-In Indicators**:
- Browser doesn't close or redirects to landing page
- App shows landing page again
- Error messages appear
- Session not persisted

---

## 🔍 Debugging

### **View Logs with ADB**

**Connect phone via USB and run**:

```bash
# View all logs
adb logcat

# Filter for relevant logs
adb logcat | findstr "chowkar auth DeepLink Auth OAuth"

# Clear logs first, then run app
adb logcat -c
adb logcat | findstr "chowkar auth DeepLink"
```

### **Key Log Messages to Look For**

**Successful Flow**:
```
[Auth] Initiating Google OAuth, redirect URL: in.chowkar.app://callback
[Auth] Platform: android
[Auth] Opening OAuth URL in Browser plugin
[DeepLink] Received URL: in.chowkar.app://callback...
[DeepLink] Handling OAuth callback
[DeepLink] Setting session from tokens
[DeepLink] Session set successfully!
[App] OAuth callback handled, refreshing auth
```

**Failed Flow**:
```
[Auth] OAuth initialization error: ...
[DeepLink] Error setting session: ...
[Auth] Failed to sign in with Google
```

### **Check Session in Chrome DevTools**

1. Connect phone via USB
2. Open Chrome on your computer
3. Go to: `chrome://inspect`
4. Find your CHOWKAR app
5. Click **"inspect"**
6. In console, check:
```javascript
// Check localStorage
localStorage.getItem('chowkar_isLoggedIn')
localStorage.getItem('supabase.auth.token')

// Check session
supabase.auth.getSession()
```

---

## 🐛 Common Issues & Solutions

### **Issue 1: Browser Opens but Doesn't Close**

**Cause**: Deep link not configured properly in Supabase

**Solution**:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Ensure `in.chowkar.app://callback` is in the redirect URLs list
3. Rebuild APK and test again

### **Issue 2: "Failed to sign in with Google" Error**

**Cause**: OAuth flow issue or RLS policy blocking profile creation

**Solution**:
1. Check Supabase RLS policies for `profiles` table
2. Ensure authenticated users can INSERT their own profile:
```sql
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);
```

### **Issue 3: App Redirects Back to Landing Page**

**Cause**: Session not being set or retrieved properly

**Solution**:
1. Check if `useDeepLinkHandler` is being called (check logs)
2. Verify deep link intent filter in `AndroidManifest.xml`
3. Ensure `Capacitor.isNativePlatform()` returns `true` in APK

### **Issue 4: Profile Not Created**

**Cause**: RLS policies blocking profile creation

**Check**: Open Supabase Dashboard → Table Editor → `profiles`
- After sign-in, check if a new profile row was created
- If not, check RLS policies

**Fix**: Run this in Supabase SQL Editor:
```sql
-- Allow authenticated users to create their own profile
CREATE POLICY IF NOT EXISTS "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
```

### **Issue 5: Session Not Persisting After App Restart**

**Cause**: Storage or auto-refresh issue

**Solution**: Already configured correctly in your `lib/supabase.ts`:
```typescript
auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
}
```

---

## 📊 Test Scenarios

### **Scenario 1: Fresh Install Sign-In**
1. Install APK
2. Open app
3. Click "Get Started with Google"
4. Sign in with Google
5. ✅ Should create new profile and show main interface

### **Scenario 2: App Restart (Session Persistence)**
1. Sign in successfully
2. Force close app (swipe away from recent apps)
3. Open app again
4. ✅ Should remain logged in, no sign-in prompt

### **Scenario 3: Profile Completion**
1. Sign in with new Google account
2. Check if profile is created with basic info
3. Complete profile with phone, location
4. ✅ Profile should be updated in database

### **Scenario 4: Sign Out and Sign In Again**
1. Sign in
2. Go to Profile tab
3. Sign out
4. Sign in again
5. ✅ Should work smoothly

---

## 🔐 Verify Supabase RLS Policies

Run this in **Supabase SQL Editor** to check current policies:

```sql
-- Check existing policies on profiles table
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

**Required policies** (at minimum):

```sql
-- Allow authenticated users to view their own profile
CREATE POLICY IF NOT EXISTS "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to create their own profile
CREATE POLICY IF NOT EXISTS "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own profile
CREATE POLICY IF NOT EXISTS "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

---

## 📈 Success Criteria

Your Google Sign-In is working correctly if:

✅ Browser opens when clicking "Get Started with Google"
✅ Browser shows Google Sign-In page
✅ After signing in, browser closes automatically
✅ App shows main interface (Home, Wallet, Profile tabs)
✅ Profile tab shows your Google account info
✅ Session persists after app restart
✅ Profile is created in Supabase `profiles` table
✅ No errors in logs

---

## 🆘 Need Help?

If you encounter issues:

1. **Check logs**: Run `adb logcat | findstr "chowkar auth DeepLink"`
2. **Check Supabase dashboard**: Authentication → Users (should show new user after sign-in)
3. **Check profiles table**: Should have a new row matching the auth user
4. **Verify redirect URLs**: Must include `in.chowkar.app://callback`

**Common Signs of Success:**
- Console shows: `[DeepLink] Session set successfully!`
- Supabase Users list shows your Google account
- Profiles table has a matching row
- App doesn't redirect back to landing page

**Quick Debug Commands:**
```bash
# Clear app data and reinstall
adb uninstall in.chowkar.app
adb install android\app\build\outputs\apk\debug\app-debug.apk

# View filtered logs
adb logcat -c && adb logcat | findstr "Auth DeepLink"
```

---

## 🎯 Next Steps After Successful Test

Once Google Sign-In works:

1. **Test all user flows** (Post job, Place bid, Chat, etc.)
2. **Consider adding Phone Auth** as backup (works better for some users)
3. **Build Release APK** for Play Store:
   ```bash
   cd android
   .\gradlew assembleRelease
   ```
4. **Configure signing key** for Play Store release

---

**Status**: Ready to test! 🚀
**Expected Result**: Seamless Google Sign-In with working OAuth flow
**Good Luck!** 🎉
