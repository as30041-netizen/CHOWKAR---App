# Google UPI / Payment Gateway Integration Plan

To replace the "Test Mode" Add Money button with real UPI payments (Google Pay, PhonePe, Paytm, etc.), we need to integrate a Payment Gateway. **Direct UPI Deep Linking** is possible but hard to verify automatically without a server callback.

## Recommended Approach: Razorpay (Standard for India)

Razorpay supports Google Pay (UPI) out of the box and handles the verification for you.

### 1. Account Setup
- Create a [Razorpay Account](https://razorpay.com/).
- Generate **Test API Keys** (Key ID and Key Secret).

### 2. Backend Integration (Supabase Edge Function)
We cannot process payments securely purely on the client (frontend). We need a secure environment to create "Orders".

**New Edge Function: `create-payment-order`**
- Input: `amount` (e.g., 100).
- Action: Calls Razorpay API to create an order.
- Output: `order_id`.

**New Edge Function: `verify-payment`** (Webhook or API)
- Input: `payment_id`, `order_id`, `signature`.
- Action: Verifies signature using Razorpay Secret.
- **On Success:** Runs SQL to update `profiles.wallet_balance` + adds `transaction` record.

### 3. Frontend Implementation
- Install Razorpay SDK: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
- **Update `handleAddMoney` in `WalletView.tsx`:**
    1. Call backend to get `order_id`.
    2. Open Razorpay Checkout (User sees Google Pay option).
    3. User pays.
    4. On success, call backend to `verify-payment`.

---

## Alternative: Direct UPI Deep Link (No Gateway - High Risk)
You can create a link like:
`upi://pay?pa=YOUR_UPI_ID&pn=YOUR_NAME&am=100&cu=INR`

**Pros:** No fees, direct to bank.
**Cons:**
- **No Automatic Verification:** The app **cannot know** if the user actually paid. They could cancel and say they paid.
- **Manual Approval Required:** User would have to upload a screenshot of payment, and an admin would manually add the money to their wallet.

**Recommendation:** Use **Razorpay** for automatic, secure, and professional payments.
