# Fix Google Sign-In Fullscreen Issue

## The Problem:
Google OAuth renders as a small centered modal instead of fullscreen, even though we set `presentationStyle: 'fullscreen'`.

## Root Cause:
Google detects the browser environment and serves a "compact" modal view for embedded browsers. This is their design choice for security and UX.

## Solution Options:

### Option 1: Force System Browser (Easiest)
Open Google Sign-In in the device's default browser (Chrome) instead of in-app:

**Advantages:**
- ✅ Full screen (entire browser window)
- ✅ Familiar Google experience
- ✅ Quick to implement (5 min)

**Disadvantages:**
- ❌ Leaves your app temporarily
- ❌ User sees Chrome, not your app

### Option 2: Configure Supabase for Better Mobile OAuth
Supabase has mobile-specific OAuth settings that can improve the experience.

### Option 3: Use Custom OAuth Implementation
Build a custom OAuth flow that bypasses Google's modal detection.

## Recommended: Try System Browser

This will open Google Sign-In in fullscreen Chrome:

```typescript
// In authService.ts
if (Capacitor.isNativePlatform() && data?.url) {
  // Open in system browser
  await Browser.open({
    url: data.url,
    windowName: '_system',  // Forces external browser
  });
}
```

The user signs in in Chrome, then gets redirected back to your app automatically.

**Would you like me to implement this?** It's the quickest way to get fullscreen Google Sign-In.
