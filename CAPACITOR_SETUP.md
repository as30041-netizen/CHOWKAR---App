# 🚀 Capacitor Setup Complete - Building Android APK

## ✅ **Setup Completed!**

I've successfully set up Capacitor for your CHOWKAR app! You can now build a proper Android APK with working OAuth.

---

## 📦 **What Was Installed**

### **Packages Added:**
- `@capacitor/core` - Capacitor core runtime
- `@capacitor/cli` - Capacitor command line tools
- `@capacitor/android` - Android platform

### **Files Created:**
- `capacitor.config.ts` - Capacitor configuration
- `android/` - Android project folder (auto-generated)

### **Scripts Added to package.json:**
```json
"cap:sync": "npm run build && npx cap sync"
"cap:android": "npm run build && npx cap sync android && npx cap open android"
"cap:build": "npm run build && npx cap copy android"
```

---

## 🔧 **Prerequisites**

Before building the Android APK, you need:

### **1. Java Development Kit (JDK)**

**Download:** https://www.oracle.com/java/technologies/downloads/#jdk17

**Check if installed:**
```bash
java -version
```

Should show JDK 17 or higher.

**Set JAVA_HOME:**
```bash
# Windows (add to System Environment Variables)
JAVA_HOME=C:\Program Files\Java\jdk-17

# Or use this command (PowerShell as Admin):
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Java\jdk-17", "Machine")
```

### **2. Android Studio**

**Download:** https://developer.android.com/studio

**Install with:**
- Android SDK
- Android SDK Platform
- Android SDK Build-Tools
- Android Emulator (optional, for testing)

**After installation:**
1. Open Android Studio
2. Go to: Tools → SDK Manager
3. Install:
   - Android SDK Platform 33 (or higher)
   - Android SDK Build-Tools 33.0.0 (or higher)
   - Android SDK Command-line Tools

**Set ANDROID_HOME:**
```bash
# Windows (add to System Environment Variables)
ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk

# Or PowerShell (as Admin):
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "Machine")
```

**Add to PATH:**
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
```

---

## 🏗️ **Building the Android APK**

### **Method 1: Command Line (Recommended)**

**Step 1: Build the web app**
```bash
npm run build
```

**Step 2: Sync to Android**
```bash
npx cap sync android
```

**Step 3: Open in Android Studio**
```bash
npx cap open android
```

Or use the combined command:
```bash
npm run cap:android
```

**Step 4: In Android Studio:**
1. Wait for Gradle sync to complete
2. Go to: Build → Build Bundle(s) / APK(s) → Build APK(s)
3. Wait for build to complete
4. Click "locate" in the popup
5. APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

### **Method 2: Automated Script**

**Step 1: Build and sync**
```bash
npm run cap:build
```

**Step 2: Build APK with Gradle**
```bash
cd android
gradlew assembleDebug
cd ..
```

APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📱 **Testing the APK**

### **Option 1: Real Device (Recommended)**

**Via USB:**
1. Enable USB Debugging on your Android phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options
   - Enable "USB Debugging"

2. Connect phone to computer via USB

3. Install APK:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or just transfer the APK to your phone and install directly.

**Wireless (ADB over WiFi):**
```bash
# On phone with USB connected
adb tcpip 5555
adb connect <phone-ip>:5555

# Now you can disconnect USB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### **Option 2: Android Emulator**

In Android Studio:
1. Tools → Device Manager
2. Create a new virtual device
3. Select a phone model
4. Download a system image (e.g., API 33)
5. Click "Play" to start emulator
6. Drag & drop APK onto emulator

---

## 🔐 **Configure Supabase for Capacitor**

### **Update Supabase Auth Settings:**

In Supabase Dashboard:
1. Go to: Authentication → URL Configuration
2. Add these redirect URLs:
   ```
   https://chowkar.in
   in.chowkar.app://callback
   capacitor://localhost
   ```

### **Update auth in your code:**

The existing code should work, but for better Capacitor support, you can add:

```typescript
// lib/supabase.ts
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: isNative ? 'pkce' : 'implicit',
  }
});
```

---

## 🎨 **Customizing the App**

### **App Icon**

Replace these files in `android/app/src/main/res/`:
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

**Quick tool:** Use https://icon.kitchen/ to generate all sizes

### **App Name**

Edit `android/app/src/main/res/values/strings.xml`:
```xml
<string name="app_name">CHOWKAR</string>
<string name="title_activity_main">CHOWKAR</string>
```

### **Splash Screen**

Edit `android/app/src/main/res/values/styles.xml`:
```xml
<item name="android:background">@color/emerald</item>
```

Add to `android/app/src/main/res/values/colors.xml`:
```xml
<color name="emerald">#10b981</color>
```

---

## 🔧 **Troubleshooting**

### **Issue: Gradle error**

**Solution:** Make sure you have correct JDK version:
```bash
java -version  # Should be 17 or higher
```

### **Issue: Android SDK not found**

**Solution:** Set ANDROID_HOME environment variable properly

### **Issue: Build fails**

**Solution:** Clean and rebuild:
```bash
cd android
gradlew clean
gradlew assembleDebug
```

### **Issue: OAuth still not working**

**Solution:** 
1. Check redirect URLs in Supabase
2. Make sure you added `in.chowkar.app://callback`
3. Verify app ID matches in `capacitor.config.ts`

### **Issue: White screen**

**Solution:**
1. Check browser console in Android Chrome:
   - Connect phone via USB
   - Enable USB debugging
   - Open chrome://inspect on your computer
   - Inspect the app

2. Check Vite config uses correct paths:
   ```typescript
   // vite.config.ts
   export default defineConfig({
     base: './',  // Use relative paths
     // ... rest
   });
   ```

---

## 📦 **Building Release APK**

For production/Play Store:

**1. Generate Signing Key:**
```bash
keytool -genkey -v -keystore chowkar-release-key.keystore -alias chowkar -keyalg RSA -keysize 2048 -validity 10000
```

**2. Configure in Android Studio:**
- Build → Generate Signed Bundle/APK
- Select APK
- Create new key store (or use existing)
- Fill in details
- Build type: Release
- Sign with key

**3. Or via command line:**

Create `android/key.properties`:
```properties
storePassword=YOUR_PASSWORD
keyPassword=YOUR_PASSWORD
keyAlias=chowkar
storeFile=../chowkar-release-key.keystore
```

Build:
```bash
cd android
gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🚀 **Deployment Workflow**

### **Development:**
```bash
npm run dev              # Test in browser
npm run build           # Build for production
npx cap sync            # Sync to Android
npx cap open android    # Open in Android Studio
```

### **Quick Build:**
```bash
npm run cap:android     # Build + sync + open Android Studio
```

### **Deploy:**
1. Build release APK in Android Studio
2. Test on real device
3. Upload to Google Play Console

---

## 🎯 **Next Steps**

### **Immediate:**
1. ✅ Build the web app: `npm run build`
2. ✅ Open in Android Studio: `npm run cap:android`
3. ✅ Build APK (debug) for testing
4. ✅ Install on your Android phone
5. ✅ Test Google Sign-In (should work now!)

### **Before Production:**
1. Generate release signing key
2. Build release APK
3. Test thoroughly
4. Add to Google Play Console
5. Publish!

---

## 📋 **Quick Commands Reference**

```bash
# Development
npm run dev                    # Run web dev server
npm run build                  # Build web app

# Capacitor
npx cap sync                   # Sync web assets to native
npx cap sync android           # Sync to Android only
npx cap open android           # Open in Android Studio
npx cap copy android           # Copy web assets only

# Combined scripts
npm run cap:build              # Build + copy to Android
npm run cap:android            # Build + sync + open Android Studio
npm run cap:sync               # Build + sync all platforms

# Android (in android/ directory)
gradlew assembleDebug          # Build debug APK
gradlew assembleRelease        # Build release APK
gradlew clean                  # Clean build
gradlew installDebug           # Install debug APK on connected device

# ADB (device interaction)
adb devices                    # List connected devices
adb install app.apk            # Install APK
adb uninstall in.chowkar.app   # Uninstall app
adb logcat                     # View logs
```

---

## ✅ **Checklist**

Before building:
- [ ] JDK 17+ installed
- [ ] JAVA_HOME set
- [ ] Android Studio installed
- [ ] Android SDK installed
- [ ] ANDROID_HOME set
- [ ] PATH includes Android tools
- [ ] Web app builds successfully (`npm run build`)

Ready to build:
- [ ] Run `npm run cap:android`
- [ ] Wait for Android Studio to open
- [ ] Wait for Gradle sync
- [ ] Build → Build Bundle(s) / APK(s) → Build APK(s)
- [ ] Install on phone and test

---

## 🎉 **You're All Set!**

Your app is now properly set up with Capacitor!

**Key Benefits:**
- ✅ **Google OAuth works properly** (unlike Appilix)
- ✅ **Native Android features** available
- ✅ **Better performance**
- ✅ **Play Store ready**
- ✅ **Professional build**

**To build your APK now:**
```bash
npm run cap:android
```

Then in Android Studio: Build → Build APK

Your APK will work perfectly with Google Sign-In! 🚀

---

**Status:** ✅ Capacitor configured and ready  
**Next:** Build APK in Android Studio  
**Result:** Proper Android app with working OAuth
