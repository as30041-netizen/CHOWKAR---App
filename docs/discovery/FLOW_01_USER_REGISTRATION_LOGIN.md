# Flow 1: User Registration & Login - Deep Dive

> **Status**: DISCOVERY COMPLETE
> **Last Updated**: 2025-12-21
> **Category**: Authentication & User Onboarding

---

## Executive Summary

CHOWKAR uses **Google OAuth** as the primary (and only) authentication method. The flow differs between Web and Native (Android) platforms, with PKCE flow for native and implicit flow for web. A **database trigger** auto-creates user profiles on first login, and the frontend has multiple fallback mechanisms for session handling.

---

## 1. Authentication Method

### Question: What authentication methods are supported?

| Method | Supported | Notes |
|--------|-----------|-------|
| Google OAuth | ✅ Yes | Primary and only method |
| Email/Password | ❌ No | Not implemented |
| Phone OTP | ❌ No | Not implemented |
| Magic Link | ❌ No | Not implemented |
| Apple Sign-In | ❌ No | Not implemented |

**Source**: `services/authService.ts` - Only `signInWithGoogle()` function exists.

---

## 2. OAuth Configuration

### Question: How is OAuth configured?

| Setting | Web | Native (Android) |
|---------|-----|------------------|
| Flow Type | Implicit | PKCE |
| Redirect URL | `window.location.origin` | `in.chowkar.app://callback` |
| Browser Redirect | Automatic | Manual (via Capacitor Browser) |
| Session Detection | URL hash | Deep link handler |

**Source**: `lib/supabase.ts` lines 12-18, `services/authService.ts` lines 6-30

```typescript
// lib/supabase.ts
flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit',
```

---

## 3. Sign-In Flow (Frontend)

### Question: What happens when user clicks "Get Started"?

#### Step-by-Step Flow:

```
1. User clicks "Get Started with Google" button
   └── App.tsx: handleGoogleSignIn()

2. Set optimistic login flag
   └── localStorage.setItem('chowkar_isLoggedIn', 'true')

3. Call Supabase OAuth
   └── supabase.auth.signInWithOAuth({ provider: 'google', ... })

4. [Native Only] Open browser for OAuth
   └── Browser.open({ url: data.url, windowName: '_system' })

5. User completes Google sign-in

6. [Native Only] Deep link callback
   └── useDeepLinkHandler receives: in.chowkar.app://callback?code=...

7. Exchange code for session (PKCE)
   └── supabase.auth.exchangeCodeForSession(code)

8. onAuthStateChange fires with SIGNED_IN event

9. Session detected → isLoggedIn = true

10. Background profile sync
    └── getCurrentUser(session.user)
```

**Key Files**:
- `App.tsx` lines 200-207: `handleGoogleSignIn()`
- `services/authService.ts` lines 6-54: `signInWithGoogle()`
- `hooks/useDeepLinkHandler.ts` lines 13-84: Deep link handling
- `contexts/UserContextDB.tsx` lines 130-280: Session management

---

## 4. Profile Auto-Creation (Database)

### Question: Is a profile auto-created on first login?

**Answer**: ✅ YES, via database trigger

**Trigger Name**: `on_auth_user_created`
**Function**: `handle_new_user()`
**Table Affected**: `auth.users` → `profiles`

#### What gets created automatically:

| Field | Default Value | Source |
|-------|---------------|--------|
| `id` | Auth user ID | `NEW.id` |
| `auth_user_id` | Same as id | `NEW.id` |
| `name` | Full name or email prefix | OAuth metadata |
| `email` | User's email | OAuth |
| `phone` | Empty string `''` | N/A |
| `location` | `'Not set'` | Default |
| `wallet_balance` | `0` | Default |
| `rating` | `5.0` | Default |
| `profile_photo` | Avatar URL | OAuth metadata |
| `is_premium` | `false` | Default |
| `ai_usage_count` | `0` | Default |
| `jobs_completed` | `0` | Default |
| `skills` | `[]` (empty array) | Default |

**Source**: `supabase/migrations/20251212171406_fix_oauth_profile_creation.sql`

#### Profile Creation Fallback (Frontend):

If the trigger fails, `authService.ts` has a backup:

```typescript
// authService.ts lines 94-126
if (!profile) {
  console.log('[Auth] Profile not found, creating one...');
  await supabase.from('profiles').insert({ ... });
}
```

---

## 5. Profile Completion Requirements

### Question: What fields are required to complete profile?

| Field | Required? | When Collected? |
|-------|-----------|-----------------|
| Name | ✅ Auto-filled | From Google |
| Email | ✅ Auto-filled | From Google |
| Phone | ⚠️ Optional | User enters later |
| Location | ⚠️ Optional | User enters later |
| Profile Photo | ⚠️ Optional | From Google or upload |

**Source**: `services/authService.ts` lines 181-205 - `completeProfile()`

### Question: Can user proceed without completing profile?

**Answer**: ✅ YES

The app does not enforce profile completion. Users can use the app with:
- Phone = empty string
- Location = "Not set"

**Verification**: There's no blocking modal or enforcement logic.

---

## 6. Session Management

### Question: Where is session stored?

| Storage | Purpose |
|---------|---------|
| Supabase Auth (IndexedDB/localStorage) | Actual JWT tokens |
| `localStorage.chowkar_isLoggedIn` | Optimistic flag for quick checks |
| `localStorage.chowkar_user` | Cached user profile (optional) |

### Question: How long does session last?

**Default Supabase**: 1 hour for access token, 1 week for refresh token

| Setting | Value | Source |
|---------|-------|--------|
| Auto-refresh | ✅ Enabled | `lib/supabase.ts` line 14 |
| Persist session | ✅ Enabled | `lib/supabase.ts` line 15 |

### Question: What happens when session expires?

1. `onAuthStateChange` fires with `TOKEN_REFRESHED` event
2. Supabase auto-refreshes the token
3. User remains logged in seamlessly

**If refresh fails**:
- `onAuthStateChange` fires with `SIGNED_OUT`
- `isLoggedIn` set to `false`
- User sees landing page

---

## 7. Safety Mechanisms

### Question: What safety mechanisms exist for auth?

| Mechanism | Purpose | Timeout |
|-----------|---------|---------|
| Safety Timeout | Force app to open if auth hangs | 3 seconds |
| OAuth Redirect Delay | Wait for token processing | 4 seconds |
| Optimistic Login Flag | Prevent flash of login screen | N/A |

**Source**: `contexts/UserContextDB.tsx` lines 141-148, 196-211

```typescript
// Safety timeout - force app open after 3s
const safetyTimeout = setTimeout(() => {
  if (mounted && isAuthLoading) {
    console.warn('[Auth] Safety timeout reached...');
    setHasInitialized(true);
    setIsAuthLoading(false);
  }
}, 3000);
```

---

## 8. Deep Link Configuration

### Question: How are deep links configured?

**Android Manifest** (Intent Filters):
- Scheme: `in.chowkar.app`
- Host: `callback`
- Alternative: `capacitor://localhost`

**Supabase Dashboard** (Redirect URLs):
```
https://chowkar.in
in.chowkar.app://callback
capacitor://localhost
```

**Source**: 
- `android/app/src/main/AndroidManifest.xml`
- Supabase Authentication → URL Configuration

---

## 9. Error Handling

### Question: How are auth errors handled?

| Error Scenario | Handling |
|----------------|----------|
| OAuth init fails | Show alert, revert optimistic flag |
| Deep link error | Log to console, no user-facing error |
| Session check fails | Safety timeout kicks in after 3s |
| Profile creation fails | Return error, user sees blank profile |

**Source**: Various error handlers in `authService.ts` and `UserContextDB.tsx`

---

## 10. Logout Flow

### Question: How does logout work?

```
1. User clicks "Sign Out" button
   └── Profile.tsx or App.tsx

2. Call signOut()
   └── supabase.auth.signOut()

3. onAuthStateChange fires with SIGNED_OUT

4. Clear all state:
   - user = MOCK_USER
   - isLoggedIn = false
   - localStorage.removeItem('chowkar_isLoggedIn')
   - Clear transactions, notifications, messages

5. User sees Landing Page
```

**Source**: 
- `services/authService.ts` lines 56-65
- `contexts/UserContextDB.tsx` lines 265-275

---

## 11. First-Time User Onboarding

### Question: Is there an onboarding flow for new users?

**Answer**: ✅ YES, but optional

| Component | Purpose |
|-----------|---------|
| `OnboardingModal.tsx` | First-time user guide |
| `localStorage.chowkar_onboarding_complete` | Tracks if shown |

**Trigger Condition** (App.tsx lines 111-117):
```typescript
if (isLoggedIn && !isAuthLoading && !user.name.includes('Mock')) {
  const hasCompletedOnboarding = localStorage.getItem('chowkar_onboarding_complete');
  if (hasCompletedOnboarding !== 'true') {
    setShowOnboarding(true);
  }
}
```

---

## 12. Push Token Registration

### Question: When is push token registered?

**Answer**: Immediately after successful login

**Flow**:
```
Login successful → fetchAllUserData() → registerPushNotifications(user.id)
```

**Source**: `contexts/UserContextDB.tsx` lines 362-371

```typescript
if (isPushSupported()) {
  registerPushNotifications(user.id).then(({ success, token, error }) => {
    if (success) {
      console.log('[Push] Registered successfully');
    }
  });
}
```

---

## 13. Related Files Summary

| File | Purpose |
|------|---------|
| `services/authService.ts` | OAuth sign-in, profile CRUD |
| `contexts/UserContextDB.tsx` | Session management, state |
| `hooks/useDeepLinkHandler.ts` | Native OAuth callback |
| `lib/supabase.ts` | Supabase client config |
| `components/OnboardingModal.tsx` | First-time user guide |
| `App.tsx` | Sign-in button handler |
| `20251212171406_fix_oauth_profile_creation.sql` | DB trigger for profile |

---

## 14. Identified Issues & Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| No email/phone backup auth | Medium | Single point of failure if Google is down |
| No profile completion enforcement | Low | Users may have incomplete profiles |
| No account deletion flow | Medium | GDPR/privacy consideration |
| No multi-device session management | Low | Can't see/revoke other sessions |

---

## 15. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER REGISTRATION & LOGIN                    │
└─────────────────────────────────────────────────────────────────┘

[Landing Page]
      │
      ▼
[Click "Get Started with Google"]
      │
      ├──────────────────────────────────────────┐
      │ WEB                                      │ NATIVE (Android)
      ▼                                          ▼
[Supabase OAuth Redirect]               [Browser.open() → Google]
      │                                          │
      ▼                                          ▼
[Google Sign-In Page]                   [Google Sign-In Page]
      │                                          │
      ▼                                          ▼
[Redirect to origin]                    [Deep Link: in.chowkar.app://callback]
      │                                          │
      ▼                                          ▼
[Hash contains tokens]                  [useDeepLinkHandler]
      │                                          │
      ▼                                          ▼
[onAuthStateChange: SIGNED_IN]          [exchangeCodeForSession()]
      │                                          │
      └──────────────────────────────────────────┘
                          │
                          ▼
              [Session Established]
                          │
                          ▼
              [Check for existing profile]
                          │
                ┌─────────┴─────────┐
                │ EXISTS            │ DOESN'T EXIST
                ▼                   ▼
        [Load profile]      [DB Trigger creates profile]
                │                   │
                └─────────┬─────────┘
                          │
                          ▼
              [Set isLoggedIn = true]
                          │
                          ▼
              [fetchAllUserData()]
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        [Jobs]    [Notifications]  [Push Token]
                          │
                          ▼
              [Check Onboarding Status]
                          │
                ┌─────────┴─────────┐
                │ NOT COMPLETE      │ COMPLETE
                ▼                   ▼
        [Show Onboarding]    [Go to Home]
```

---

## Questions for User Clarification

1. Should we add backup auth methods (email/password, phone)?
2. Should profile completion be enforced before using the app?
3. Is account deletion functionality needed?
4. Any specific session timeout requirements?

---

## Notes & Observations

- The auth system is robust with multiple fallbacks
- PKCE flow for native is more secure than implicit
- Safety timeout prevents infinite loading
- Profile creation has DB trigger + frontend fallback (belt and suspenders)

