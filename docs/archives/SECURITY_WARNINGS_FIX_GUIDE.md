# Security Warnings Fix Guide

## Overview
You're seeing security warnings when publishing on bolt.new because:
1. **25 functions** have mutable `search_path` (Critical SQL Injection vulnerability)
2. **Password Protection** is disabled (allows compromised passwords)

The fix script also handles:
- ✅ Enables Row Level Security (RLS) on all created tables
- ✅ Sets up proper security policies

## Quick Fix Steps

### Step 1: Run the SQL Script ✅

1. Open **Supabase Dashboard** → Your Project
2. Go to **SQL Editor**
3. Open the file `FIX_SECURITY_WARNINGS.sql` (in your project root)
4. Copy ALL contents and paste into SQL Editor
5. Click **Run** (or press F5)
6. Wait for completion (should take 5-10 seconds)

### Step 2: Enable Password Protection ⚠️

This CANNOT be done via SQL. You must use the dashboard:

1. In Supabase Dashboard, go to **Authentication** → **Policies**
2. Scroll down to find **"Leaked Password Protection"**
3. **Toggle it ON** (should show green checkmark)
4. Click **Save** or **Update**

Alternative if you don't see "Policies":
1. Go to **Authentication** → **Settings**
2. Look for **"Security"** section
3. Find **"Enable HaveIBeenPwned password checking"**
4. Toggle it **ON**

### Step 3: Verify the Fix ✅

1. Go back to **bolt.new**
2. Click **Publish** again
3. All warnings should be **GONE** ✅

If you still see warnings, run this verification query in Supabase SQL Editor:

```sql
-- Check that all functions have search_path set
SELECT 
  p.proname AS function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ FIXED'
    ELSE '❌ NEEDS FIX'
  END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname IN (
    'get_push_token',
    'get_job_contact',
    'handle_new_chat_message',
    'sanitize_sensitive_data',
    'update_user_rating',
    'process_transaction',
    'charge_commission',
    'auto_archive_completed_job_chat',
    'mark_messages_read',
    'archive_chat',
    'cleanup_old_notifications',
    'unarchive_chat',
    'delete_chat',
    'cancel_job_with_refund',
    'withdraw_from_job',
    'prevent_wallet_balance_update',
    'soft_delete_notification',
    'soft_delete_chat_message',
    'mark_all_notifications_read',
    'clear_all_notifications',
    'accept_bid',
    'get_bid_deadline_remaining',
    'check_expired_bid_deadlines',
    'update_updated_at_column',
    'calculate_distance'
  )
ORDER BY p.proname;
```

### Step 4: Mark as Complete

After enabling password protection, run this in SQL Editor:

```sql
UPDATE security_audit_log 
SET completed = TRUE 
WHERE action = 'enable_password_protection';

-- View audit log
SELECT * FROM security_audit_log;
```

## What Was Fixed?

### 🔒 Function Search Path Security

**The Problem:**
- Functions with mutable `search_path` are vulnerable to SQL injection
- Attackers can manipulate schemas to execute malicious code

**The Solution:**
Added to EVERY function:
```sql
SECURITY DEFINER
SET search_path = public
```

This ensures:
- ✅ Functions always execute in a known schema
- ✅ No schema manipulation attacks possible
- ✅ Consistent behavior across all calls

### 🔐 Password Protection

**The Problem:**
- Users can use passwords that have been leaked in data breaches
- Increases risk of account compromise

**The Solution:**
- Enable HaveIBeenPwned.org integration
- Automatically blocks 800+ million compromised passwords
- No performance impact (cached checks)

## Affected Functions (All Fixed)

| Function Name | Purpose | Fixed |
|--------------|---------|-------|
| `get_push_token` | Get user's push notification token | ✅ |
| `get_job_contact` | Get job poster contact info | ✅ |
| `handle_new_chat_message` | Chat message notification trigger | ✅ |
| `sanitize_sensitive_data` | Remove sensitive data from notifications | ✅ |
| `update_user_rating` | Update user rating after review | ✅ |
| `process_transaction` | Handle wallet transactions | ✅ |
| `charge_commission` | Charge platform commission | ✅ |
| `auto_archive_completed_job_chat` | Archive chats when job completes | ✅ |
| `mark_messages_read` | Mark chat messages as read | ✅ |
| `archive_chat` | Archive a chat conversation | ✅ |
| `cleanup_old_notifications` | Delete old notifications | ✅ |
| `unarchive_chat` | Restore archived chat | ✅ |
| `delete_chat` | Soft delete chat | ✅ |
| `cancel_job_with_refund` | Cancel job and refund payment | ✅ |
| `withdraw_from_job` | Worker withdraws from job | ✅ |
| `prevent_wallet_balance_update` | Prevent direct wallet updates | ✅ |
| `soft_delete_notification` | Soft delete notification | ✅ |
| `soft_delete_chat_message` | Soft delete chat message | ✅ |
| `mark_all_notifications_read` | Mark all notifications read | ✅ |
| `clear_all_notifications` | Clear all notifications | ✅ |
| `accept_bid` | Accept a bid on job | ✅ |
| `get_bid_deadline_remaining` | Get time remaining on bid | ✅ |
| `check_expired_bid_deadlines` | Check for expired deadlines | ✅ |
| `update_updated_at_column` | Auto-update timestamp trigger | ✅ |
| `calculate_distance` | Calculate distance between coordinates | ✅ |

## Troubleshooting

### "Function already exists" Error
If you get this error, the script will automatically DROP and recreate the function. This is safe.

### "Permission denied" Error
Make sure you're using the Supabase SQL Editor with admin privileges (not the application connection).

### Password Protection Toggle Not Found
Different Supabase versions have it in different places:
- Try: **Authentication** → **Policies**
- Or: **Authentication** → **Settings** → **Security**
- Or: **Project Settings** → **Auth** → **Password**

### Warnings Still Show After Fix
1. Clear your browser cache
2. Wait 1-2 minutes for Supabase to sync
3. Try "Build" instead of "Publish" first
4. Re-run the verification query

## Need Help?

If warnings persist after following all steps:
1. Check the `security_audit_log` table
2. Run the verification query
3. Take a screenshot of any remaining warnings
4. Share the output of the verification query

## Security Benefits

After applying these fixes:
- ✅ **No SQL Injection** via search_path manipulation
- ✅ **800M+ compromised passwords** blocked
- ✅ **Production-ready** security posture
- ✅ **Compliant** with security best practices
- ✅ **Safe to publish** to app stores

These are critical security issues, so it's great that bolt.new is warning you about them!
