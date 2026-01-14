# State Management & Stability Audit Plan

## Objective
Ensure the app is robust against user actions like refreshing the page, switching browsers, and cancelling authentication flows. Fix the reported "Endless Loading" bug on auth cancellation.

## 1. Scope

### Authentication Flow
*   **Login/Logout:** Test Google Sign-In, Logout, and re-login.
*   **Cancellation:** Verify behavior when user closes the Google popup or clicks "Cancel".
*   **Redirects:** Verify handling of `code`, `access_token`, and `error` in URL parameters.

### Session Persistence
*   **Refreshes:** Ensure the user remains logged in after refreshing (`F5`).
*   **Storage:** Verify `localStorage` usage ('chowkar_user', 'chowkar_isLoggedIn').
*   **Token Refresh:** Ensure `safeFetch` handles 401s correctly (already verified in previous steps, but double-check context integration).

### Cross-Browser / Environment
*   **PWA Mode:** Verify behavior when installed as a PWA (if applicable).
*   **Mobile vs Desktop:** Ensure responsive handling of auth redirects.

## 2. Checklist

### Bug Investigation: Endless Loading
*   [ ] **Root Cause:** Suspect `UserContextDB.tsx` checks for `error=` in URL but might not be setting `isAuthLoading(false)` if an error is found.
*   [ ] **Fix:** Update initialization logic to handle `error=` param by clearing state and stopping the loader.

### State Integrity
*   [ ] **Race Conditions:** Check for multiple `useEffect` calls trying to fetch the profile simultaneously.
*   [ ] **Optimistic UI:** Verify if optimistic updates (like "Rating updated") are rolled back on failure.

## 3. Execution Strategy
1.  **Code Analysis:** Deep dive into `UserContextDB.tsx`.
2.  **Reproduction:** Simulate auth error by modifying URL manually (e.g., `?error=access_denied`).
3.  **Fix Implementation:** Patch `UserContextDB.tsx` to gracefully handle errors.
4.  **Verification:** Test refresh and cancellation scenarios.
