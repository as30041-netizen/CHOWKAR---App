# Database State & Schema Audit

> **Status**: ✅ Audited on 2025-12-21
> **Findings**: Mostly Healthy, Critical Schema Gap in Chat

## 1. Schema Analysis

### Core Tables
| Table | Description | Health Status | Issues |
|-------|-------------|---------------|--------|
| `profiles` | Users & Wallets | ✅ Healthy | |
| `jobs` | Job Listings | ✅ Healthy | |
| `bids` | Bids & Negotiations | ✅ Healthy | |
| `notifications` | User Alerts | ✅ Healthy | |
| `reviews` | Ratngs | ✅ Healthy | |
| `transactions` | Wallet Ledger | ✅ Healthy | |
| `chat_messages` | Messaging | ⚠️ **Action Required** | Missing `media_type`, `media_url`, `read`, `read_at` columns used in `types.ts`. |

### Type Consistency (`types.ts` vs DB)
- **User**: `rating` (dec vs num) handled by JS. `isPremium` boolean matches.
- **Job**: `status` enum matches. Dates (string vs date) handled by client.
- **Bid**: Denormalized fields (worker_name etc) match schema.
- **ChatMessage**: **MISMATCH**. TS definitions for media and read receipts have no DB backing.

## 2. Business Logic (RPCs)
| Function | Logic Check | Concurrency | Status |
|----------|-------------|-------------|--------|
| `accept_bid` | Verifies OPEN status, rejects others | Atomic (PL/PGSQL) | ✅ Verified |
| `process_transaction` | Checks balance, updates wallet | row-level lock (`FOR UPDATE`) | ✅ Verified |
| `cancel_job_with_refund` | Refunds chat fee if applicable | Transactional | ✅ Verified |
| `get_job_contact` | Restricts access to participants | Security Definer | ✅ Verified |

## 3. Triggers & Automation
- **Notifications**:
    - `notify_on_bid_accept`: Correctly notifies winner + losers.
    - `notify_on_chat_message`: Routing logic handles Poster vs Worker recipient correctly.
    - `notify_on_job_completion`: Sends context-aware success message.
- **Timestamps**:
    - `update_updated_at_column`: Applied to all core tables.

## 4. Security (RLS)
- **Blind Bidding**: Workers can ONLY see their own bids (Policy: `worker_id = auth.uid()`).
- **Chat Privacy**: Restricted to Job Poster and Accepted Worker.
- **Wallet Protection**: Users cannot update `wallet_balance` directly (only via RPC). RLS policies allow update of `profiles` by `auth.uid()`, strictly checking `auth.uid() = id`. Application logic must ensure wallet balance is not passed in the update payload.

## 5. Fix Plan
1. **Schema Patch**: Add missing columns to `chat_messages`.
2. **RPC Update**: Enhance `mark_messages_read` to handle message-level read receipts.
