# 📱 APK Build & Deployment Guide

## Prerequisites
- [x] All SQL scripts run successfully
- [x] Manual testing completed (see TESTING_GUIDE.md)
- [x] No critical bugs found
- [ ] Production environment variables configured

---

## Step 1: Update Version Number

Before building, update the app version:

### Edit `package.json`:
```json
{
  "name": "chowkar",
  "version": "2.0.0",  // ← Update this
  "description": "Job marketplace for rural India"
}
```

### Edit `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        versionCode 2          // ← Increment this
        versionName "2.0.0"    // ← Match package.json
    }
}
```

---

## Step 2: Configure Environment Variables

### Edit `.env`:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Razorpay Configuration
VITE_RAZORPAY_KEY_ID=your_razorpay_key

# Build Configuration
NODE_ENV=production
```

### Verify Variables:
```bash
# Check they're loaded
npm run dev
# Open browser console
console.log(import.meta.env.VITE_SUPABASE_URL)
```

---

## Step 3: Clean Build

Remove old build artifacts:

```bash
# Clean npm cache
npm cache clean --force

# Remove node_modules
Remove-Item -Recurse -Force node_modules

# Fresh install
npm install

# Clean Capacitor
npm run cap:clean
```

---

## Step 4: Build Web Assets

Build the optimized web bundle:

```bash
# Production build
npm run build

# Output should show:
# ✓ built in XXXms
# dist/index.html
# dist/assets/*.js (minified)
```

**Verify build:**
```bash
# Check dist folder was created
dir dist

# Serve locally to test
npm run preview
# Visit http://localhost:4173
```

---

## Step 5: Sync Capacitor

Copy web assets to Android project:

```bash
npm run cap:sync

# This does:
# 1. Copies dist/ → android/app/src/main/assets/public/
# 2. Updates Capacitor plugins
# 3. Creates/updates capacitor.config.json
```

**Verify sync:**
```bash
# Check Android assets exist
dir android\app\src\main\assets\public
```

---

## Step 6: Build APK

### Debug APK (Testing):
```bash
cd android
.\gradlew assembleDebug
cd ..
```

**Output location:**
`android\app\build\outputs\apk\debug\app-debug.apk`

### Release APK (Production):
```bash
cd android
.\gradlew assembleRelease
cd ..
```

**Output location:**
`android\app\build\outputs\apk\release\app-release-unsigned.apk`

---

## Step 7: Sign APK (Production Only)

### Generate Keystore (First Time):
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore chowkar-release-key.jks -alias chowkar -keyalg RSA -keysize 2048 -validity 10000
```

**Save these credentials securely:**
- Keystore password
- Key alias: `chowkar`
- Key password

### Sign the APK:
```bash
cd android\app\build\outputs\apk\release
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore C:\path\to\chowkar-release-key.jks app-release-unsigned.apk chowkar
```

### Align the APK:
```bash
zipalign -v 4 app-release-unsigned.apk chowkar-v2.0.0.apk
```

**Final APK:** `chowkar-v2.0.0.apk`

---

## Step 8: Test APK on Device

### Install Debug APK:
```bash
# Via ADB
adb install android\app\build\outputs\apk\debug\app-debug.apk

# Or transfer to device and install manually
```

### Test Checklist:
- [ ] App opens without crashing
- [ ] OAuth sign-in works
- [ ] Camera permissions granted
- [ ] Location permissions granted
- [ ] Job posting works
- [ ] Push notifications received
- [ ] Payment flow works
- [ ] No visual glitches

---

## Step 9: Deploy to Play Store (Optional)

### Prerequisites:
- Google Play Developer account ($25 one-time fee)
- Signed release APK
- App assets (icon, screenshots, description)

### Upload Steps:
1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Fill in store listing:
   - App name: CHOWKAR
   - Description: "(Copy from README.md)"
   - Screenshots: (Take from testing)
4. Upload APK under "Production" track
5. Submit for review

**Review time:** 1-7 days

---

## Troubleshooting

### Build Errors:

**Error: "Task assembleDebug failed"**
```bash
# Clean gradle cache
cd android
.\gradlew clean
.\gradlew assembleDebug
```

**Error: "Unable to find capacitor.config.json"**
```bash
# Re-sync Capacitor
npm run cap:sync
```

**Error: "Duplicate resources"**
- Check for duplicate files in `public/` folder
- Remove unused images/assets

### APK Install Errors:

**"App not installed"**
- Uninstall old version first
- Check Android version compatibility (min SDK 22)

**"Parse error"**
- Re-sign the APK
- Verify APK isn't corrupted

### Runtime Errors:

**App crashes on launch**
- Check logcat: `adb logcat`
- Verify all environment variables are set
- Check Supabase URL is accessible from device

**OAuth doesn't redirect back**
- Verify redirect URL in Supabase: `in.chowkar.app://callback`
- Check `AndroidManifest.xml` has correct intent filter

---

## CI/CD Automation (Advanced)

### GitHub Actions Workflow

Create `.github/workflows/build.yml`:

```yaml
name: Build APK

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Install dependencies
        run: npm ci
      - name: Build web
        run: npm run build
      - name: Sync Capacitor
        run: npm run cap:sync
      - name: Build APK
        run: |
          cd android
          ./gradlew assembleRelease
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: app-release
          path: android/app/build/outputs/apk/release/
```

---

## Post-Deployment

### Monitor Performance:
- Enable Firebase Crashlytics
- Set up Sentry error tracking
- Monitor Supabase logs for RPC errors

### User Feedback:
- Set up in-app feedback form
- Monitor Play Store reviews
- Create support email: support@chowkar.app

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2025-12-20 | Security hardening, chat enhancements, performance optimizations |
| 1.0.0 | 2025-12-XX | Initial release |

---

## Quick Reference

```bash
# Complete build flow (one-liner)
npm run build && npm run cap:sync && cd android && .\gradlew assembleDebug && cd ..

# Check build output
dir android\app\build\outputs\apk\debug

# Install on device
adb install android\app\build\outputs\apk\debug\app-debug.apk

# View logs
adb logcat | findstr "Capacitor"
```

---

**Need Help?** Check TESTING_GUIDE.md for common issues.
