# 🔧 Job Posting Issues & Fixes

## Issues Reported:
1. ❌ **Attach job location not working**
2. ❌ **Edit Job button not working properly**

---

## 🔍 Root Causes:

### Issue 1: Location Not Working in Capacitor
**Problem**: The geolocation API works differently in Capacitor/Android WebView
- Needs explicit permissions in AndroidManifest.xml
- Might need Capacitor Geolocation plugin for better support

### Issue 2: Edit Job Not Reading Location State
**Problem**: The PostJob page doesn't receive/use the job data from navigation state
- When you click "Edit Job", it navigates to /post with job data
- But JobPostingForm doesn't read this state to prefill the form

---

## ✅ Fix 1: Add Geolocation Permissions to Android

### Required Changes:

**File**: `android/app/src/main/AndroidManifest.xml`

Add these permissions:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

## ✅ Fix 2: Make Edit Job Work

### Problem:
JobPostingForm doesn't accept or use the `jobToEdit` prop to prefill the form.

### Solution:
Update JobPostingForm to:
1. Accept an optional `initialJob` prop
2. Prefill form fields when editing
3. Change button text to "Update" when editing
4. Call update instead of add when editing

---

## 🚀 Quick Fixes Applied:

I'll apply both fixes now...
