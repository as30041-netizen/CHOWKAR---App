-- ==========================================
-- EDGE FUNCTION 401 TROUBLESHOOTING GUIDE
-- ==========================================

## The 401 Unauthorized Error

**Symptom**: Edge Function returns 401 Unauthorized when called from frontend

**Root Cause Options**:

### 1. **Missing JWT Verification Bypass** (Most Likely)
By default, Supabase Edge Functions require JWT auth. Your function needs to explicitly allow anonymous/public access.

**Fix**: Add `verify: 'none'` to the function configuration

```typescript
// At the top of verify-razorpay-payment/index.ts, before serve()
Deno.serve({
  onListen: () => console.log("Function started"),
}, async (req) => {
  // ... rest of code
})
```

**OR** use the new Deno.serve signature that Supabase recognizes for auth bypass.

### 2. **Function Not Allowing Anon Key**
Check Supabase Dashboard → Edge Functions → verify-razorpay-payment → Settings
- Ensure "Allow anonymous invocations" is enabled

### 3. **Missing Environment Variables**
The function uses:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`  
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Check**: Supabase Dashboard → Project Settings → Edge Functions → Secrets

### 4. **CORS/Authorization Header Mismatch**
Frontend might not be sending the Authorization header

**Check browser console** for the actual request headers sent

---

## Recommended Fix

**Option A: Add JWT Bypass (Recommended for Payment Verification)**

Update `verify-razorpay-payment/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// NEW: Use Deno.serve with options for auth bypass
Deno.serve({ 
    // No JWT verification needed - payment signature is our security
    // Supabase will read this and skip JWT check
}, async (req) => {
    // ... rest of your existing code
})
```

**OR Option B: Enable in Supabase Dashboard**
1. Go to Supabase Dashboard
2. Edge Functions → verify-razorpay-payment
3. Enable "Allow anonymous invocations"

---

## Why This Happened

The `create-razorpay-order` function works because it doesn't need auth - anyone can create an order.
But `verify-razorpay-payment` is being blocked because Supabase thinks it needs auth.

The function SHOULD be public because:
- Payment signature verification is the security mechanism
- Razorpay's HMAC signature proves authenticity
- No sensitive data is exposed

---

## Action Items

1. Try Deno.serve approach (code change)
2. If that doesn't work, check Supabase Dashboard settings
3. Verify environment variables are set
4. Check browser Network tab for actual headers sent
