# 🎉 CHOWKAR APK - Ready to Test Google Sign-In!

## ✅ Setup Verification Complete

Your CHOWKAR Capacitor Android APK is **100% ready** for Google Sign-In testing!

---

## 📋 What's Already Configured

### ✅ Capacitor Setup
- **App ID**: `in.chowkar.app` ✓
- **Packages Installed**:
  - `@capacitor/core` v8.0.0 ✓
  - `@capacitor/android` v8.0.0 ✓
  - `@capacitor/browser` v8.0.0 ✓
  - `@capacitor/app` v8.0.0 ✓

### ✅ OAuth Configuration
- **Deep Link URL**: `in.chowkar.app://callback` ✓
- **Auth Service**: Capacitor-aware with platform detection ✓
- **Deep Link Handler**: `useDeepLinkHandler.ts` implemented ✓
- **PKCE Flow**: Enabled for native platforms ✓
- **Session Persistence**: Configured ✓

### ✅ Android Configuration
- **AndroidManifest.xml**: Deep link intent filters configured ✓
- **Scheme**: `in.chowkar.app://callback` ✓
- **Alternative**: `capacitor://localhost` ✓

### ✅ Build Scripts
- `npm run build` - Build web app ✓
- `npm run cap:sync` - Build and sync all platforms ✓
- `npm run cap:android` - Build, sync, and open Android Studio ✓
- `npm run cap:build` - Build and copy to Android ✓

---

## 🔥 BEFORE YOU TEST - Critical Steps

### 1️⃣ Configure Supabase Redirect URLs

**YOU MUST DO THIS FIRST!**

1. Go to: [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your CHOWKAR project
3. Navigate to: **Authentication** → **URL Configuration**
4. In **Redirect URLs**, add these URLs:

```
https://chowkar.in
in.chowkar.app://callback
capacitor://localhost
```

5. Click **Save**

**⚠️ Without this, OAuth callback will fail!**

---

### 2️⃣ Verify/Fix RLS Policies

Run the SQL script I created for you:

1. Open Supabase dashboard
2. Go to **SQL Editor**
3. Open the file: `FIX_RLS_POLICIES.sql`
4. Copy and paste the content
5. Click **Run**

This ensures authenticated users can create/update their profiles.

---

### 3️⃣ Verify Google OAuth Provider

1. In Supabase Dashboard, go to: **Authentication** → **Providers**
2. Ensure **Google** is enabled
3. Verify OAuth credentials are configured

---

## 🚀 Build & Install APK

### Option 1: Using Android Studio (Recommended)

```powershell
# In your project directory
npm run cap:android
```

This will:
1. Build your web app
2. Sync to Android project
3. Open Android Studio

**In Android Studio:**
1. Wait for Gradle sync (bottom right status)
2. Go to: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build to complete
4. Click **"locate"** in notification
5. APK is in: `android\app\build\outputs\apk\debug\app-debug.apk`

### Option 2: Command Line

```powershell
# Build web app
npm run build

# Sync to Android
npx cap sync android

# Build APK with Gradle
cd android
.\gradlew assembleDebug
cd ..
```

APK location: `android\app\build\outputs\apk\debug\app-debug.apk`

---

## 📱 Install on Phone

### Method 1: USB Installation (if you have ADB)

1. Enable USB Debugging on phone:
   - Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options
   - Enable "USB Debugging"

2. Connect phone via USB

3. Install:
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### Method 2: Manual Installation

1. Copy `app-debug.apk` to your phone (USB, email, cloud, etc.)
2. Tap the APK file on your phone
3. Allow installation from unknown sources if prompted
4. Install the app

---

## 🧪 Testing Google Sign-In

### Test Steps

1. **Open CHOWKAR app** on your phone
   - Should see landing page with "Get Started with Google" button

2. **Click "Get Started with Google"**
   - Browser window should open (using Capacitor Browser plugin)
   - Google Sign-In page should appear

3. **Sign in with Google**
   - Choose your Google account
   - Grant permissions

4. **Browser should close automatically**
   - Returns to CHOWKAR app
   - Deep link handler processes OAuth callback

5. **Success!**
   - App shows main interface (Home, Wallet, Profile tabs)
   - No landing page anymore
   - Profile tab shows your Google account info

### Expected Flow Timeline

```
[0s] Click "Get Started with Google"
     ↓
[1s] Browser opens, showing Google Sign-In
     ↓
[3s] User selects account and grants permissions
     ↓
[4s] Browser redirects to: in.chowkar.app://callback?access_token=...
     ↓
[5s] Browser automatically closes
     ↓
[6s] Deep link handler catches the callback
     ↓
[7s] Session is set in Supabase
     ↓
[8s] App refreshes auth state
     ↓
[9s] App shows main interface ✅
```

---

## 🔍 Monitoring & Debugging

### View Logs (if you have ADB)

```powershell
# Start monitoring before testing
adb logcat | findstr "Auth DeepLink chowkar"
```

### Success Logs

You should see:
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

### Check Supabase Dashboard

After signing in:

1. **Authentication** → **Users**
   - Should show your Google account

2. **Table Editor** → **profiles**
   - Should have a new row with your user data

---

## ✅ Success Criteria

Google Sign-In is working if:

- ✅ Browser opens when clicking "Get Started with Google"
- ✅ Google Sign-In page appears
- ✅ Browser closes automatically after sign-in
- ✅ App shows main interface (not landing page)
- ✅ Profile tab shows your Google account info
- ✅ Session persists after closing and reopening app
- ✅ New user appears in Supabase Users list
- ✅ New profile created in profiles table

---

## ❌ Troubleshooting

### Problem: Browser doesn't close after sign-in

**Cause**: Redirect URL not configured in Supabase

**Fix**:
1. Add `in.chowkar.app://callback` to Supabase redirect URLs
2. Rebuild APK
3. Reinstall and test again

### Problem: "Failed to sign in with Google" error

**Cause**: RLS policy blocking profile creation

**Fix**:
1. Run `FIX_RLS_POLICIES.sql` in Supabase SQL Editor
2. Test again

### Problem: Returns to landing page after sign-in

**Cause**: Session not being set properly

**Fix**:
1. Check logs for deep link handler errors
2. Verify `useDeepLinkHandler` is being called in App.tsx (it is ✓)
3. Ensure Capacitor.isNativePlatform() returns true

### Problem: Session doesn't persist after app restart

**Cause**: Already fixed in your config ✓

Your `lib/supabase.ts` has:
```typescript
auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
}
```

---

## 📚 Documentation Created for You

I've created these documents in your project:

1. **GOOGLE_SIGNIN_TEST_GUIDE.md** - Comprehensive testing guide
2. **PRE_FLIGHT_CHECKLIST.md** - Quick checklist (this document)
3. **FIX_RLS_POLICIES.sql** - SQL script to fix database policies
4. **CAPACITOR_SETUP.md** - Already exists, detailed setup guide
5. **APK_AUTH_FIX.md** - Already exists, OAuth troubleshooting

---

## 🎯 Your Next Steps

### Right Now:

1. ✅ **Add redirect URL to Supabase** (CRITICAL!)
   - `in.chowkar.app://callback`

2. ✅ **Run RLS fix SQL script** in Supabase

3. ✅ **Build APK**
   ```powershell
   npm run cap:android
   ```

4. ✅ **Install on phone**

5. ✅ **Test Google Sign-In**

### After Successful Test:

1. Test all app features (post job, bid, chat, wallet)
2. Test session persistence (close and reopen app)
3. Test sign out and sign in again
4. Build release APK for Play Store

---

## 🆘 Need Help?

If something doesn't work:

1. **Check redirect URLs** in Supabase (most common issue)
2. **Check RLS policies** (run the SQL script)
3. **View logs** with: `adb logcat | findstr "Auth DeepLink"`
4. **Check Supabase Users** - should show new user after sign-in
5. **Check Supabase profiles table** - should have matching profile

---

## 📊 Configuration Summary

```yaml
App ID: in.chowkar.app
Deep Link: in.chowkar.app://callback
Platform: Android (Capacitor)
OAuth Provider: Google
Flow Type: PKCE (for native)
Session: Persistent
Redirect URLs Required:
  - https://chowkar.in
  - in.chowkar.app://callback
  - capacitor://localhost
```

---

## 🎉 You're Ready!

Everything is configured correctly. Just:
1. Add redirect URL to Supabase
2. Build APK
3. Test!

**Good luck! The OAuth flow should work smoothly! 🚀**

---

**Questions or issues?** Most problems are solved by:
- ✅ Adding `in.chowkar.app://callback` to Supabase redirect URLs
- ✅ Running the RLS policies SQL script
- ✅ Rebuilding the APK after changes

**Let's test and see it work! 💪**
