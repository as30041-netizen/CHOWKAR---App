# CHOWKAR Operations Log

This document tracks significant operational changes made to the CHOWKAR application.

---

## 2026-01-21: Authentication & Database Reset

### Changes Made

#### 1. Disabled Phone/OTP Authentication (Temporary)
- **File**: `components/AuthModal.tsx`
- **Reason**: Firebase SMS costs ($0.01-$0.34 per SMS) are too high during early development
- **Change**: Commented out phone number input and OTP flow, leaving only Google authentication
- **How to re-enable**: Uncomment the code block marked `/* TEMPORARILY DISABLED: Phone Authentication */`

#### 2. Database Cleanup
- **Script**: `sql/CLEAN_ALL_USER_DATA.sql`
- **Action**: Deleted all user data from all tables
- **Tables cleaned**:
  - `chat_messages`
  - `notifications`
  - `reviews`
  - `transactions`
  - `bids`
  - `jobs`
  - `profiles`
  - `auth.users`

### Current State
- ✅ Only Google Sign-In is available
- ✅ Database is clean (no user data)
- ✅ All table structures, indexes, RLS policies, and triggers are preserved

---

## 2026-01-21: Google Auth Fix (After Database Cleanup)

### Issue
After running `CLEAN_ALL_USER_DATA.sql`, Google Sign-In stopped working with error:
```
[Auth:Debug] Auth error detected in URL, cancelling loading state...
```

### Root Cause
The `profiles` table has `phone text NOT NULL` constraint, but:
1. The database trigger (`handle_new_user`) was missing the `phone` field
2. The client-side fallback in `authService.ts` also didn't include `phone`

### Files Fixed
- `services/authService.ts` - Added unique phone placeholder `pending_{userId}` for OAuth users
- `sql/FIX_GOOGLE_AUTH_PROFILE.sql` - Updated database trigger to include phone field

### Action Required
Run the SQL script in Supabase SQL Editor:
```sql
-- Run: sql/FIX_GOOGLE_AUTH_PROFILE.sql
```

---

### Next Steps (When Ready)
1. To re-enable phone auth: Uncomment code in `AuthModal.tsx`
2. Consider using a third-party SMS provider with Firebase Custom Auth for lower costs
3. Implement rate limiting on OTP requests to control costs

---

## Template for Future Entries

```
## YYYY-MM-DD: [Title]

### Changes Made
- [Description of change]

### Reason
- [Why this change was made]

### Files Affected
- [List of files]

### How to Revert
- [Steps to undo if needed]
```
