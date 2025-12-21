# Frontend Architecture Audit

> **Status**: ✅ Audited on 2025-12-21
> **Scope**: App.tsx, Contexts, Services

## 1. Key Components (`App.tsx`)
*   **Routing**: Uses `React Router` with `Suspense` lazy loading for all pages (`Home`, `Profile`, `Wallet`). Good for performance.
*   **Auth protection**: Guards are implemented within `AppContent` via `isLoggedIn` check, diverting to `LandingPage`.
*   **Deep Linking**: `useDeepLinkHandler` serves as the entry point for OAuth callbacks.
*   **Navigation Logic**: `pushService` and `LocalNotifications` listeners are correctly wired up to open robust modals (ViewBids, Chat).

## 2. State Management
### `JobContextDB.tsx`
*   **Sync Strategy**: Uses a **Hybrid** approach (Supabase Realtime Broadcast + `postgres_changes`).
*   **Optimization**:
    *   `dbJobToAppJob` / `dbBidToAppBid` transformers ensure type safety.
    *   `fetchJobs` uses pagination (limit 100) and separates Job vs Bid fetching to avoid massive joins.
*   **Risk**: The `addBid` optimistic update logic (Line 346) relies on `id` matching. If DB generates a different ID than the temp one, the rollback logic might fail to find the item.
    *   *Mitigation*: The `createBid` does NOT return the new ID currently (Line 255). It should return the `id` so the context can swap the temp ID for the real one.

### `UserContextDB.tsx`
*   **Auth**: Persistent logic using `localStorage` flags (`chowkar_isLoggedIn`) to prevent "flash of login screen".
*   **Notifications**: Centralized deduplication logic (Line 424) prevents notification spam.
*   **Performance**: Fetches profile, transactions, notifications in parallel (`Promise.all`).

## 3. Services
### `pushService.ts`
*   **Logic**: Standard Capacitor Push implementation.
*   **Gap**: `registerPushNotifications` saves token to `profiles` table directly. If RLS forbids `UPDATE` of other users' tokens, this is fine (User updates own token).
*   **Error Handling**: Graceful degradation if not on native platform.

### `jobService.ts`
*   **RPC Usage**: Correctly uses `cancel_job_with_refund`, `withdraw_from_job`, `check_expired_bid_deadlines`.
*   **Security**: `fetchJobContact` uses the secure RPC `get_job_contact` instead of raw select.

## 4. Findings & Fixes
*   **Issue**: `createBid` in `jobService.ts` does not return the created Bid ID data, making optimistic UI updates risky.
*   **Fix**: Update `createBid` to `select().single()` and return the ID.

## 5. Next Steps
*   Apply the `jobService.ts` fix.
*   Proceed to Integration Points audit.
