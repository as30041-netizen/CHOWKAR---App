# Chat UX Improvements

## Issues to Fix:
1. **Back button navigation** - Should reopen Messages panel, not go to Home
2. **Phone number visibility** - Ensure counterpart's phone is accessible
3. **Phone number validation** - Prompt users to add phone if missing

## Implementation Plan:

### 1. Back Button Fix
**Current:** `onClose={() => { setChatOpen({ isOpen: false, job: null }); ... }}`
**Problem:** Just closes chat, user lands on home page
**Solution:**  Add `onBackToMessages` prop to ChatInterface that opens ChatListPanel

### 2. Phone Number Access
**Current:** Shows phone icon only if `otherPersonPhone` exists
**Problem:** Phone might not be loaded/accessible
**Status:** Already working (line 447-450), just needs RLS verification

### 3. Phone Number Prompt
**Solution:** Add a banner in ChatInterface when current user's phone is missing
**Location:** Below job context banner

## Files to Modify:
1. `App.tsx` - Add setShowChatList callback
2. `ChatInterface.tsx` - Add back-to-messages button + phone prompt banner
3. No DB changes needed (phone field already exists in profiles)
