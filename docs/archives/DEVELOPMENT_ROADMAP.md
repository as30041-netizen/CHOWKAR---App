# CHOWKAR Deep Codebase Analysis & Development Roadmap

## 🔍 Deep Technical Analysis

### 1. 🚨 Critical Security Vulnerabilities
**Severity: CRITICAL**
- **Wallet Manipulation**: The current RLS policy (`Users can update own profile`) allows authenticated users to update **all** columns in their profile, including `wallet_balance`.
    - *Risk*: A malicious user can simple send a request to set their balance to infinite.
    - *Fix*: Disable direct updates to `wallet_balance` via RLS. Restrict updates to specific columns (name, bio, etc.) or use a Database Function (RPC) for wallet transactions.
- **Client-Side Limits**: `checkFreeLimit` and `incrementAiUsage` run on the client.
    - *Risk*: Users can bypass the "Free AI Limit" by modifying client code or making direct API calls.
    - *Fix*: Move limit checking to a Supabase Edge Function or Database Trigger.

### 2. ⚡ Performance Bottlenecks
**Severity: HIGH**
- **Inefficient Job Fetching**: `fetchJobs()` retrieves **all** jobs and **all** bids from the database on load.
    - *Impact*: As the app grows to 100s of jobs, this will become incredibly slow and consume massive data.
    - *Fix*: Implement **Server-Side Pagination** (`.range(0, 10)`) and filtering logic.
- **Expensive Real-time Updates**: `JobContextDB` triggers a **full re-fetch** of all data whenever *any* change happens in the `jobs` or `bids` table.
    - *Impact*: One user placing a bid causes *everyone's* app to reload all jobs, causing server load spikes and UI glitches.
    - *Fix*: Optimistic updates for local changes; specific subscription listeners that update only the changed record.

### 3. 🏗 Code Structure & Data Integrity
**Severity: MEDIUM**
- **Manual Type Mapping**: You are manually mapping DB columns (`latitude`, `longitude`, `poster_id`) to App types (`coordinates`, `posterId`) in `dbJobToApp`.
    - *Risk*: prone to errors if field names change.
    - *Fix*: Standardize naming conventions or use a code generator (like `supabase gen types`) to match DB schema directly.
- **Context Monoliths**: `UserContextDB` handles Auth, User Data, Notifications, Chat, *and* Wallet.
    - *Impact*: Large file, hard to maintain, excessive re-renders.
    - *Fix*: Split into `AuthContext`, `ChatContext`, and `NotificationContext`.

---

## 🗺️ Detailed Development Roadmap

### Phase 1: Security & Stability (Immediate)
*Goal: Secure the platform and prevent exploit.*

1.  **Secure Wallet**:
    -   Revoke "Update" RLS for `wallet_balance` column.
    -   Create a secure RPC function `update_wallet_balance` or rely strictly on `transactions` triggers.
2.  **Fix Profile RLS**:
    -   Update RLS to specific columns: `CHECK (auth.uid() = id) AND (listing_columns_allowed)` is hard in Postgres RLS directly without complex checks.
    -   *Better approach*: Keep RLS open but use a Trigger `BEFORE UPDATE` to prevent `wallet_balance` changes from client.
3.  **Sanitize Inputs**: Ensure all text inputs (Job descriptions, Chat) are sanitized to prevent XSS (React does most of this, but good to verify).

### Phase 2: Core Workflow Improvements (Next Week)
*Goal: Fix the UX gaps identified in the workflow report.*

1.  **Implement Job Filtering on DB**: Move search/filter logic from `Home.tsx` to Supabase queries.
2.  **Detailed Bid Flow**:
    -   Add **Bid Confirmation Modal** (Worker).
    -   Add **Bid Comparison View** (Poster).
3.  **Profile Completion Gate**:
    -   Add check: If `phone` or `location` is missing -> Redirect to Edit Profile.

### Phase 3: Scalability (Post-Launch Preparation)
*Goal: Handle 1,000+ users.*

1.  **Pagination**:
    -   Update `fetchJobs` to accept `page` and `limit`.
    -   Implement "Infinite Scroll" or "Load More" on Home Screen.
2.  **Optimized Real-time**:
    -   Refactor `JobContextDB.tsx` to handle `.on('UPDATE')` payloads directly instead of calling `refreshJobs()`.

### Phase 4: Native Features (APK Specific)
1.  **Push Notifications**: Connect Supabase Realtime/Functions to OneSignal or Firebase Cloud Messaging (FCM) for deep mobile integration.
2.  **Offline Mode**: Cache jobs using `@capacitor/storage` or SQLite so users see content without internet.

## 📝 Immediate Action Plan
I recommend we start with **Phase 1 (Security)** immediately, specifically the Wallet vulnerability, as it compromises the integrity of your platform.

1.  Create `prevent_wallet_update` trigger.
2.  Refactor `UserContext` to be safer.
