# Profile & Review Feature Audit Plan

## Objective
Audit the User Profile and Review systems to ensure data privacy, correct calculation of ratings, secure data updates, and robust API usage (safeFetch).

## 1. Scope

### Profile System
*   **Reading Profiles:**
    *   Public vs Private data visibility (RLS).
    *   Performance of fetching profiles.
*   **Updating Profiles:**
    *   Security of update operations (can I update someone else's profile?).
    *   Validation of input data.
*   **Photo Management:**
    *   Upload mechanism security.

### Review System
*   **Writing Reviews:**
    *   Can users review anyone? Or only after a completed job?
    *   Validation of rating scores (1-5).
*   **Reading Reviews:**
    *   Aggregation logic (Average rating calculation).
    *   Pagination of reviews.

## 2. Checklist

### Code Safety
*   [ ] **safeFetch Coverage:** Verify all `profileService.ts` and `reviewService.ts` calls use `safeFetch`.
*   [ ] **Error Handling:** Are errors gracefully handled in the UI?

### Database & RLS
*   [ ] **Profile RLS:** Verify `profiles` table policies. Users should only edit their own. Everyone can read basics?
*   [ ] **Review RLS:** Verify `reviews` table policies.

### Business Logic
*   [ ] **Rating Aggregation:** Is the "Average Rating" calculated on the fly or stored? If stored, are triggers correct?
*   [ ] **Job Verification:** Is there a check ensuring a job actually existed before a review is left?

## 3. Execution Strategy
1.  **Code Review:** Inspect `services/*` and `components/*`.
2.  **SQL Analysis:** Inspect `sql/*` for `reviews` and `profiles` policies/triggers.
3.  **App Testing:**
    *   Try to edit another user's profile.
    *   Try to review a user without a job.
    *   Verify ratings update correctly.
