# ✅ Quick Pre-Flight Checklist for Google Sign-In Testing

## 🎯 Status: READY TO TEST

Your CHOWKAR app is properly configured for Capacitor OAuth! Here's what's already set up:

### ✅ Configured Components

1. **Capacitor Setup**
   - ✅ App ID: `in.chowkar.app`
   - ✅ Deep link scheme configured
   - ✅ Browser plugin installed
   - ✅ App plugin installed

2. **OAuth Flow**
   - ✅ Deep link handler: `hooks/useDeepLinkHandler.ts`
   - ✅ Auth service with Capacitor support
   - ✅ PKCE flow for native platforms
   - ✅ Session persistence enabled

3. **Android Configuration**
   - ✅ AndroidManifest.xml with deep link intent filters
   - ✅ Scheme: `in.chowkar.app://callback`
   - ✅ Capacitor alternative scheme configured

---

## 🔥 CRITICAL: Supabase Configuration

**BEFORE TESTING**, verify in Supabase Dashboard:

### Step 1: Add Redirect URLs

1. Go to: [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your CHOWKAR project
3. Navigate to: **Authentication** → **URL Configuration**
4. In **Redirect URLs** section, add:
   ```
   https://chowkar.in
   in.chowkar.app://callback
   capacitor://localhost
   ```
5. Click **Save**

### Step 2: Verify RLS Policies

Run this in **SQL Editor** to check/add policies:

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- Add missing policies (if needed)
CREATE POLICY IF NOT EXISTS "Users can create own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

### Step 3: Verify Google OAuth

1. Go to: **Authentication** → **Providers**
2. Ensure **Google** is enabled
3. Verify OAuth credentials are configured

---

## 🚀 Build & Test Steps

### Quick Build Commands

```powershell
# 1. Build the web app
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

### In Android Studio

1. Wait for **Gradle sync** to complete (bottom right)
2. Go to: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. Wait for build (~1-5 minutes)
4. Click **"locate"** in the notification
5. APK location: `android\app\build\outputs\apk\debug\app-debug.apk`

### Install on Phone

**Option 1: If ADB installed**
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

**Option 2: Manual Install**
1. Copy `app-debug.apk` to phone
2. Open file and install
3. Allow installation from unknown sources if prompted

---

## 🧪 Testing Process

### Test Flow

1. **Launch app** → Should show landing page
2. **Click "Get Started with Google"** → Browser should open
3. **Sign in with Google** → Choose account, grant permissions
4. **Browser should close** → Returns to app automatically
5. **App shows main interface** → Home, Wallet, Profile tabs visible
6. **Check Profile tab** → Your Google account info should display

### Monitor Logs (If you have ADB)

```powershell
# View filtered logs
adb logcat | findstr "Auth DeepLink chowkar"
```

### Expected Success Logs

```
[Auth] Initiating Google OAuth, redirect URL: in.chowkar.app://callback
[Auth] Platform: android
[Auth] Opening OAuth URL in Browser plugin
[DeepLink] Received URL: in.chowkar.app://callback...
[DeepLink] Handling OAuth callback
[DeepLink] Session set successfully!
```

---

## ❌ Troubleshooting

### Issue: Browser doesn't close after sign-in

**Fix**: 
- Ensure `in.chowkar.app://callback` is in Supabase redirect URLs
- Rebuild APK after adding redirect URL

### Issue: "Failed to sign in" error

**Fix**:
- Check Supabase RLS policies (run SQL above)
- Verify Google OAuth is enabled in Supabase

### Issue: Returns to landing page

**Fix**:
- Check logs for errors
- Verify deep link handler is working
- Ensure session persistence is enabled

---

## 📊 Success Indicators

You'll know it works when:

✅ Browser opens with Google sign-in
✅ Browser closes automatically after signing in
✅ App shows main interface (not landing page)
✅ Profile tab shows your name and email
✅ No error messages
✅ Reopening app keeps you logged in

---

## 🎯 Test Right Now!

If you've already:
- ✅ Added redirect URLs to Supabase
- ✅ Verified RLS policies
- ✅ Built the APK
- ✅ Installed on your phone

**Then you're ready to test!** 🚀

Just open the app and click "Get Started with Google"!

---

## 📞 Quick Help

**If it works**: Great! Test other features (post job, place bid, etc.)

**If it doesn't work**: 
1. Check Supabase redirect URLs
2. View logs with: `adb logcat | findstr "Auth DeepLink"`
3. Check Supabase Users table (should show new user after sign-in)

---

**Ready? Let's test! 🎉**
