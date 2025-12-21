# CHOWKAR App Discovery Plan

> **Purpose**: Comprehensive checklist to map and understand the current app state before making further changes.
> **Last Updated**: 2025-12-21

---

## 1. User Flows & Business Logic

### 1.1 Job Posting Flow
- [ ] How does a poster create a job?
- [ ] What validations exist on job creation?
- [ ] When is the job posting fee charged (if any)?
- [ ] What happens after posting (notifications, visibility)?

### 1.2 Worker Bidding Flow
- [ ] How does a worker discover jobs?
- [ ] What's the bid submission process?
- [ ] How does counter-offer negotiation work?
- [ ] What triggers bid acceptance/rejection?

### 1.3 Payment Model
- [ ] What is the job posting fee? (currently ₹10 or ₹0?)
- [ ] What is the connection/chat unlock fee? (currently ₹20 or ₹50?)
- [ ] How/when are fees charged? (upfront vs on action)
- [ ] What refund scenarios exist?

### 1.4 Chat & Communication
- [ ] When can poster and worker start chatting?
- [ ] What's the chat unlock flow for workers?
- [ ] How does the security (message masking) work?

### 1.5 Job Lifecycle
- [ ] Job status transitions: OPEN → IN_PROGRESS → COMPLETED
- [ ] What triggers each transition?
- [ ] How does job cancellation work?
- [ ] Review/rating process after completion?

---

## 2. Database State & Schema

### 2.1 Core Tables
- [ ] `profiles` - User data structure
- [ ] `jobs` - Job posting fields
- [ ] `bids` - Bidding and negotiation
- [ ] `chat_messages` - Chat structure
- [ ] `notifications` - Notification system
- [ ] `transactions` - Payment history
- [ ] `payments` - Razorpay tracking
- [ ] `reviews` - Rating system
- [ ] `app_config` - Admin settings

### 2.2 Active Triggers (Need to Verify in Supabase)
- [ ] Which notification triggers are active?
- [ ] Are there duplicate/conflicting triggers?
- [ ] What triggers call the FCM Edge Function?

### 2.3 RPC Functions
- [ ] `accept_bid` - Bid acceptance
- [ ] `process_transaction` - Payment processing
- [ ] `mark_messages_read` - Chat read status
- [ ] Any others in use?

### 2.4 RLS Policies
- [ ] What can authenticated users see/modify?
- [ ] Any security gaps?

---

## 3. Frontend Architecture

### 3.1 Key Components
- [ ] `App.tsx` - Main app shell
- [ ] `LandingPage.tsx` - Pre-login page
- [ ] `Home.tsx` - Main dashboard
- [ ] `PostJob.tsx` - Job creation form
- [ ] `WalletPage.tsx` - Payment/transactions
- [ ] `Profile.tsx` - User profile
- [ ] Modal components (Bid, Chat, ViewBids, etc.)

### 3.2 State Management
- [ ] `UserContextDB.tsx` - User and notification state
- [ ] `JobContextDB.tsx` - Job data and real-time sync
- [ ] How do contexts interact?

### 3.3 Services
- [ ] `pushService.ts` - FCM push notifications
- [ ] `appStateService.ts` - Foreground/background detection
- [ ] `notificationNavigationService.ts` - Deep linking
- [ ] `jobService.ts` - Job CRUD operations
- [ ] `paymentService.ts` - Razorpay integration

### 3.4 Routing
- [ ] What routes exist?
- [ ] How does navigation work on mobile vs web?

---

## 4. Integration Points

### 4.1 Supabase
- [ ] Database connection
- [ ] Realtime subscriptions
- [ ] Auth (Google OAuth)
- [ ] Storage (APK, images)
- [ ] Edge Functions (push notifications)

### 4.2 Firebase/FCM
- [ ] Push notification delivery
- [ ] Service account setup
- [ ] Token management in `profiles.push_token`

### 4.3 Razorpay
- [ ] Payment flow integration
- [ ] Order creation
- [ ] Payment verification
- [ ] Webhook handling (if any)

### 4.4 Capacitor (Native)
- [ ] Platform detection
- [ ] Local notifications
- [ ] Push notifications
- [ ] Deep linking
- [ ] Safe area insets

---

## 5. Configuration & Environment

### 5.1 Environment Variables
- [ ] `.env` - What's configured?
- [ ] Supabase URL and keys
- [ ] Firebase/FCM credentials
- [ ] Razorpay API keys

### 5.2 Capacitor Config
- [ ] `capacitor.config.ts` - Native app settings
- [ ] App ID, name, webDir

### 5.3 Database Config (`app_config` table)
- [ ] `supabase_url` - For FCM calls
- [ ] `service_role_key` - For FCM auth
- [ ] `connection_fee` - Chat unlock price
- [ ] `job_posting_fee` - Posting price

---

## 6. Deployment & Build

### 6.1 Web Deployment
- [ ] Where is the web app hosted?
- [ ] How is it deployed?
- [ ] What's the production URL?

### 6.2 Android APK
- [ ] Current version in storage
- [ ] How to build new APK?
- [ ] Signing configuration

### 6.3 Git State
- [ ] Current branch status
- [ ] Pending merges
- [ ] What needs to be committed?

---

## 7. Known Issues & Pain Points

### 7.1 Current Bugs
- [ ] List all known bugs

### 7.2 UI/UX Issues
- [ ] Status bar overlap (addressed?)
- [ ] Download button showing in app (addressed?)
- [ ] Any other layout issues?

### 7.3 Notification Issues
- [ ] Push not working when killed?
- [ ] Duplicate notifications?
- [ ] Missing notifications?

### 7.4 Technical Debt
- [ ] Multiple SQL fix files (need consolidation?)
- [ ] Deprecated code to remove?
- [ ] Performance concerns?

---

## 8. SQL Files Inventory

> **Goal**: Understand which SQL files are active vs deprecated

### 8.1 Migration Files (in `supabase/migrations/`)
- [ ] `20251212133318_create_chowkar_schema.sql`
- [ ] `20251212143303_add_google_oauth_support.sql`
- [ ] `20251212160441_add_auto_profile_creation_trigger.sql`
- [ ] `20251212171406_fix_oauth_profile_creation.sql`
- [ ] `20251212172250_fix_rls_infinite_recursion.sql`

### 8.2 Root SQL Files (need to verify status)
- [ ] `NOTIFICATIONS_DEPLOYMENT_PACKAGE.sql` - Ran recently?
- [ ] `CREATE_ALL_RPC_FUNCTIONS.sql` - Current or outdated?
- [ ] `RECONCILED_NOTIFICATION_SYSTEM.sql` - What's its status?
- [ ] `FINAL_NOTIFICATION_SYSTEM.sql` - Active?
- [ ] Other SQL files in root?

---

## 9. Security & Authentication

### 9.1 Authentication Flow
- [ ] Google OAuth implementation details
- [ ] Session management (how long do sessions last?)
- [ ] Token refresh behavior
- [ ] Logout/session invalidation

### 9.2 Data Protection
- [ ] What sensitive data is stored?
- [ ] Are API keys properly secured?
- [ ] RLS policy coverage (any gaps?)
- [ ] Chat message masking (paid vs unpaid workers)

### 9.3 API Security
- [ ] Edge Function authentication
- [ ] Service role key usage
- [ ] CORS configuration

---

## 10. Localization (i18n)

### 10.1 Language Support
- [ ] Currently supported: English (en), Hindi (hi)
- [ ] How are translations managed?
- [ ] Where are translation strings stored?
- [ ] Any missing translations?

### 10.2 Locale Handling
- [ ] Currency formatting (₹)
- [ ] Date/time formatting
- [ ] Number formatting

---

## 11. AI Features

### 11.1 AI Integration
- [ ] What AI features exist? (noticed `ai_usage_count` in profiles)
- [ ] AI job description assistance?
- [ ] AI-powered search/matching?
- [ ] Usage limits and premium tiers?

---

## 12. User Onboarding

### 12.1 First-Time User Experience
- [ ] What happens after first login?
- [ ] Profile completion flow
- [ ] Role selection (Worker vs Poster)
- [ ] Tutorial or walkthrough?

### 12.2 Returning User Experience
- [ ] Session restoration
- [ ] Deep link handling
- [ ] Notification permission requests

---

## 13. Error Handling & Monitoring

### 13.1 Error Handling Strategy
- [ ] How are API errors displayed to users?
- [ ] Fallback behaviors for failures?
- [ ] Retry mechanisms?

### 13.2 Logging & Monitoring
- [ ] What logging exists? (console.log patterns)
- [ ] Any analytics integration?
- [ ] Error tracking service (Sentry, etc.)?

---

## 14. User Roles & Permissions

### 14.1 Role System
- [ ] WORKER vs POSTER - how is role determined?
- [ ] Can users switch roles?
- [ ] Role-specific features and restrictions?

### 14.2 Permission Model
- [ ] What can workers do that posters can't?
- [ ] What can posters do that workers can't?
- [ ] Admin capabilities (if any)?

---

## 15. Location & Geo Features

### 15.1 Location Services
- [ ] How is user location captured?
- [ ] Distance calculation (Haversine formula?)
- [ ] Location-based job filtering
- [ ] Map integration (Leaflet?)

### 15.2 Location Data
- [ ] Where is lat/lng stored?
- [ ] Location privacy considerations?
- [ ] Accuracy requirements?

---

## 16. Premium & Subscription Features

### 16.1 Premium Model
- [ ] What does `is_premium` unlock?
- [ ] Subscription tiers (if any)?
- [ ] How is premium purchased?

### 16.2 Feature Gating
- [ ] Free vs premium feature comparison
- [ ] Upgrade prompts and flows

---

## 17. Media & Assets

### 17.1 Image Handling
- [ ] Profile photos - upload, storage, display
- [ ] Job images - attached to job posts?
- [ ] Image optimization/compression?

### 17.2 Asset Storage
- [ ] Supabase Storage buckets
- [ ] APK storage for downloads
- [ ] CDN usage?

---

## 18. Offline & Performance

### 18.1 Offline Behavior
- [ ] What happens without internet?
- [ ] Any offline caching?
- [ ] Graceful degradation?

### 18.2 Performance
- [ ] Loading states and skeletons
- [ ] Lazy loading (Suspense usage)
- [ ] Real-time subscription efficiency
- [ ] Memory management (notification limits, etc.)

---

## 19. Testing Infrastructure

### 19.1 Existing Tests
- [ ] Unit tests?
- [ ] Integration tests?
- [ ] E2E tests?

### 19.2 Manual Testing
- [ ] Test accounts available?
- [ ] Test data setup?
- [ ] Device testing matrix?

---

## 20. Dependencies & Packages

### 20.1 Key npm Dependencies
- [ ] React version
- [ ] Capacitor version
- [ ] Supabase client version
- [ ] UI libraries (Tailwind, Lucide, etc.)

### 20.2 External Services
- [ ] Supabase (required)
- [ ] Firebase/FCM (push)
- [ ] Razorpay (payments)
- [ ] Google OAuth
- [ ] Any others?

---

## Discovery Process

### Phase 1: Answer Questions
Go through each checkbox above and document findings.

### Phase 2: Create System Diagram
Visual map of how components interact.

### Phase 3: Identify Gaps
What's misconfigured, broken, or missing?

### Phase 4: Prioritize Fixes
Rank issues by impact and effort.

### Phase 5: Create Action Plan
Sequential steps to address issues.

---

## Notes & Findings

*(Add discoveries here as we investigate)*

