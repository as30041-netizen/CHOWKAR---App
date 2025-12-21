# User Flows & Business Logic Discovery

> **Purpose**: Deep dive into every user flow, business rule, and logic decision in CHOWKAR.
> **Last Updated**: 2025-12-21

---

## Flow 1: User Registration & Login ✅ COMPLETE

> **Detailed Document**: [FLOW_01_USER_REGISTRATION_LOGIN.md](./FLOW_01_USER_REGISTRATION_LOGIN.md)

### Questions & Answers

| # | Question | Answer |
|---|----------|--------|
| 1.1 | What authentication methods are supported? | **Google OAuth only** (no email/password) |
| 1.2 | What happens immediately after Google OAuth completes? | PKCE code exchange (native) or hash token extraction (web), then `onAuthStateChange` fires |
| 1.3 | Is a profile auto-created on first login? | **Yes**, via DB trigger `handle_new_user()` + frontend fallback |
| 1.4 | What fields are required to complete profile? | Name (auto-filled), Email (auto-filled) - Phone/Location optional |
| 1.5 | Can user proceed without completing profile? | **Yes**, app doesn't enforce profile completion |
| 1.6 | Where is session stored (local storage, cookie)? | Supabase Auth (IndexedDB/localStorage) + `chowkar_isLoggedIn` flag |
| 1.7 | How long does session last before expiry? | 1 hour access token, auto-refreshed with refresh token |
| 1.8 | What happens when session expires? | Auto-refresh attempts; if fails, `SIGNED_OUT` event fires |

### Diagram
```
[Google Sign-In] → [Supabase Auth (PKCE/Implicit)] → [Profile Check via Trigger]
                                                            ↓
                        [Profile exists?] → Yes → [Load Profile] → [Home Screen]
                                          → No  → [Create via Trigger] → [Home Screen]
```

---

## Flow 2: Job Posting (Poster) ✅ COMPLETE

> **Detailed Document**: [FLOW_02_JOB_POSTING.md](./FLOW_02_JOB_POSTING.md)

### Questions & Answers

| # | Question | Answer |
|---|----------|--------|
| 2.1 | What fields are required to post a job? | Title, Description, Job Date, Budget |
| 2.2 | What categories are available? | 8: Farm Labor, Construction, Plumbing, Electrical, Driver, Cleaning, Delivery, Other |
| 2.3 | Is job posting fee charged upfront or later? | **Upfront** before job is created |
| 2.4 | What is the current job posting fee? | ₹10 (configurable via `app_config.job_posting_fee`) |
| 2.5 | Can a job be posted without payment? | **No** - wallet deduction or Razorpay required |
| 2.6 | What validations exist (budget range, date, etc.)? | Budget > 0, all required fields filled |
| 2.7 | Can poster add images to the job? | **Yes**, uploaded to Supabase Storage (recently fixed) |
| 2.8 | Is location required? How is it captured? | Optional, uses profile location or GPS capture |
| 2.9 | What happens after successful posting? | Form reset, navigate to home, notification sent |
| 2.10 | What notifications are sent after posting? | "Job Posted - Your job is now live!" to poster |

### Diagram
```
[Post Job Form] → [Validate] → [Check Wallet]
                                    ↓
                   [Sufficient?] → Yes → [Deduct] → [Upload Image?] → [Create Job] → [Notify Poster] → [Home]
                              → No  → [Show Razorpay] → [Pay] → [Create Job] → [Notify Poster] → [Home]
```

---

## Flow 3: Job Discovery (Worker) ✅ COMPLETE

> **Detailed Document**: [FLOW_03_JOB_DISCOVERY.md](./FLOW_03_JOB_DISCOVERY.md)

### Questions & Answers

| # | Question | Answer |
|---|----------|--------|
| 3.1 | How are jobs displayed to workers? | Grid/list of JobCards sorted by newest first |
| 3.2 | What filters are available? | Category, Location (text), Min Budget, Max Distance (slider) |
| 3.3 | How is distance calculated? | Haversine formula in `calculateDistance()` |
| 3.4 | Is there a search feature? What fields are searchable? | Yes, searches job title (case-insensitive) |
| 3.5 | Voice search - how does it work? | Web Speech API, supports Hindi + English |
| 3.6 | Are there sorting options? | **Yes** - Newest, Budget High/Low, Nearest (✅ Fixed) |
| 3.7 | How many jobs are loaded initially? Pagination? | 20 jobs initially, "Load More" button for pagination |
| 3.8 | Is there a "My Bids Only" filter? | **Yes**, toggle to show only jobs user bid on |
| 3.9 | What job details are visible before bidding? | Title, category, location, budget, distance, poster name |
| 3.10 | Can worker see poster's contact before accepting? | **No**, contact hidden until bid accepted + payment |

### Diagram
```
[Home Screen] → [Role Toggle: Worker] → [Load Jobs (20)]
                                            ↓
                    [Display JobCards] ← [Apply Filters] ← [Search/Voice/Category/FilterModal]
                            ↓
                    [Click Job] → [JobDetailsModal]
                            ↓
                    [Load More] → [Fetch next 20]
```

---

## Flow 4: Bidding (Worker) ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 4.1 | What is required to place a bid? | |
| 4.2 | Is there a minimum/maximum bid amount? | |
| 4.3 | Can worker bid below the poster's budget? | |
| 4.4 | Is a message required with bid? | |
| 4.5 | Can worker edit their bid after submission? | |
| 4.6 | Can worker withdraw their bid? When? | |
| 4.7 | What happens when bid is submitted (DB, notifications)? | |
| 4.8 | Can worker bid on multiple jobs simultaneously? | |
| 4.9 | Is there a limit on bids per worker? | |
| 4.10 | What status values exist for bids? | |

### Diagram
```
[Job Details] → [Place Bid Button] → [Bid Modal] → [Enter Amount + Message] → [Submit] → [Bid Created] → [Notify Poster]
```

---

## Flow 5: Bid Review & Negotiation (Poster) ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 5.1 | How does poster view bids on their job? | |
| 5.2 | What worker info is visible (rating, location, photo)? | |
| 5.3 | Can poster accept a bid directly? | |
| 5.4 | Can poster reject a bid? What happens to rejected bids? | |
| 5.5 | Can poster counter-offer? How? | |
| 5.6 | How is counter-offer communicated to worker? | |
| 5.7 | Is there a negotiation history? How is it stored? | |
| 5.8 | What is the maximum number of negotiation rounds? | |
| 5.9 | Can poster accept after counter-offering? | |
| 5.10 | What notifications are sent during negotiation? | |

### Diagram
```
[My Jobs] → [View Bids] → [See All Bids] → [Accept/Reject/Counter] 
                                                  ↓
                              [Counter] → [Worker Responds] → [Loop or Accept]
```

---

## Flow 6: Counter-Offer Response (Worker) ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 6.1 | How is worker notified of counter-offer? | |
| 6.2 | Where does worker view counter-offers? | |
| 6.3 | What options does worker have (Accept, Reject, Counter back)? | |
| 6.4 | Can worker counter the counter? | |
| 6.5 | What happens when worker accepts counter? | |
| 6.6 | What happens when worker rejects counter? | |
| 6.7 | Is negotiation history visible to worker? | |
| 6.8 | What's the format of negotiation_history JSONB? | |

### Diagram
```
[Notification: Counter Offer] → [View Bid] → [Accept/Reject/Counter] → [Update Bid] → [Notify Poster]
```

---

## Flow 7: Bid Acceptance & Job Start ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 7.1 | What happens when poster accepts a bid? | |
| 7.2 | Does accepting one bid auto-reject others? | |
| 7.3 | What is job status after acceptance? | |
| 7.4 | Is worker notified of acceptance? How? | |
| 7.5 | Are other bidders notified of rejection? | |
| 7.6 | Can poster undo acceptance? | |
| 7.7 | What RPC function handles acceptance? | |
| 7.8 | What database changes occur on acceptance? | |

### Diagram
```
[Accept Bid] → [RPC: accept_bid] → [Update job.status='IN_PROGRESS'] → [Update bids: Accept one, Reject others] → [Notify Worker] → [Notify Rejected Workers?]
```

---

## Flow 8: Chat Unlock (Worker) ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 8.1 | When can worker start chatting with poster? | |
| 8.2 | What is the connection/chat unlock fee? | |
| 8.3 | How is payment collected (Razorpay flow)? | |
| 8.4 | What happens after successful payment? | |
| 8.5 | Is payment status stored in bids table? | |
| 8.6 | What does `connection_payment_status` column contain? | |
| 8.7 | Can chat be accessed before payment? | |
| 8.8 | What does poster see before worker pays? | |
| 8.9 | What notification goes to poster when chat unlocked? | |
| 8.10 | Is there a refund policy for chat fee? | |

### Diagram
```
[Bid Accepted] → [Worker sees "Pay to Unlock"] → [Razorpay Payment] → [Update bids.connection_payment_status='PAID'] → [Chat Enabled] → [Notify Poster]
```

---

## Flow 9: Chat & Communication ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 9.1 | Who can chat with whom? | |
| 9.2 | Is chat per-job or per-user? | |
| 9.3 | How are messages stored? | |
| 9.4 | Is translation supported? How? | |
| 9.5 | Are messages real-time (subscription)? | |
| 9.6 | Can messages be deleted/edited? | |
| 9.7 | What happens to chat after job completion? | |
| 9.8 | How are unread messages counted? | |
| 9.9 | What notifications trigger from new messages? | |
| 9.10 | Security: can unpaid worker see message content? | |

### Diagram
```
[Chat Screen] → [Load messages for job_id] → [Real-time subscription] → [Send Message] → [Insert to DB] → [Notify Recipient]
```

---

## Flow 10: Job Completion ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 10.1 | Who marks a job as complete? Poster or Worker? | |
| 10.2 | What verification exists for completion? | |
| 10.3 | Is there a "Work Ready" status from worker? | |
| 10.4 | What happens after completion? | |
| 10.5 | Can completion be disputed? | |
| 10.6 | What database changes occur? | |
| 10.7 | What notifications are sent? | |

### Diagram
```
[Job IN_PROGRESS] → [Worker marks ready?] → [Poster marks complete] → [job.status='COMPLETED'] → [Trigger Reviews] → [Notify Both]
```

---

## Flow 11: Reviews & Ratings ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 11.1 | Who can review whom? | |
| 11.2 | When can reviews be submitted? | |
| 11.3 | What is the rating scale? | |
| 11.4 | Are comments required with ratings? | |
| 11.5 | Are there pre-defined tags for reviews? | |
| 11.6 | How is average rating calculated? | |
| 11.7 | Can reviews be edited/deleted? | |
| 11.8 | What triggers update of profile rating? | |
| 11.9 | What notifications are sent on new review? | |

### Diagram
```
[Job Completed] → [Prompt to Review] → [Submit Rating + Tags + Comment] → [Insert Review] → [Update profiles.rating] → [Notify Reviewee]
```

---

## Flow 12: Job Cancellation & Refunds ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 12.1 | When can poster cancel a job? | |
| 12.2 | Can worker cancel their acceptance? | |
| 12.3 | What refund rules exist? | |
| 12.4 | Is chat unlock fee refunded on cancellation? | |
| 12.5 | What RPC function handles cancellation? | |
| 12.6 | What notifications are sent on cancellation? | |
| 12.7 | What happens to the job after cancellation? | |

### Diagram
```
[Cancel Job] → [RPC: cancel_job_with_refund] → [Refund Poster?] → [Refund Worker Chat Fee?] → [Update job.status] → [Notify All Parties]
```

---

## Flow 13: Wallet & Transactions ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 13.1 | What is wallet used for? | |
| 13.2 | How does user add money to wallet? | |
| 13.3 | What transaction types exist (CREDIT, DEBIT)? | |
| 13.4 | Is wallet balance used for payments or is it direct Razorpay? | |
| 13.5 | Where is transaction history shown? | |
| 13.6 | Can user withdraw wallet balance? | |

---

## Flow 14: Notifications End-to-End ⬜ PENDING

### Questions to Answer

| # | Question | Answer |
|---|----------|--------|
| 14.1 | What events trigger notifications? | |
| 14.2 | Are notifications stored in DB or just pushed? | |
| 14.3 | How are in-app notifications displayed? | |
| 14.4 | How are push notifications delivered (FCM)? | |
| 14.5 | What deep linking exists for notification taps? | |
| 14.6 | Can notifications be marked as read? | |
| 14.7 | Can notifications be cleared/deleted? | |
| 14.8 | What notification types exist? | |

---

## Business Rules Summary

### Fees & Pricing
| Item | Current Value | Configurable? | Location |
|------|---------------|---------------|----------|
| Job Posting Fee | ₹10 | Yes | `app_config.job_posting_fee` |
| Chat Unlock Fee | ₹50 | Yes | `app_config.connection_fee` |
| Premium Subscription | Coming Soon | N/A | Not implemented |

### Status Transitions
| Entity | Statuses | Valid Transitions |
|--------|----------|-------------------|
| Job | OPEN, IN_PROGRESS, COMPLETED | OPEN→IN_PROGRESS→COMPLETED |
| Bid | PENDING, ACCEPTED, REJECTED | PENDING→ACCEPTED or REJECTED |
| Payment | NOT_REQUIRED, PENDING, PAID | NOT_REQUIRED→PENDING→PAID |

### Notification Triggers
| Event | Recipient | Type | Push? |
|-------|-----------|------|-------|
| New Bid | Poster | INFO | Yes |
| Counter Offer | Other Party | INFO | Yes |
| Bid Accepted | Worker | SUCCESS | Yes |
| Bid Rejected | Worker | INFO | Yes |
| Chat Unlocked | Poster | SUCCESS | Yes |
| New Message | Recipient | INFO | Yes |
| Job Completed | Worker | SUCCESS | Yes |
| New Review | Reviewee | INFO | Yes |

---

## Discovery Progress

| Flow | Status | Detailed Doc |
|------|--------|--------------|
| Flow 1: User Registration | ✅ Complete | [FLOW_01_USER_REGISTRATION_LOGIN.md](./FLOW_01_USER_REGISTRATION_LOGIN.md) |
| Flow 2: Job Posting | ✅ Complete | [FLOW_02_JOB_POSTING.md](./FLOW_02_JOB_POSTING.md) |
| Flow 3: Job Discovery | ✅ Complete | [FLOW_03_JOB_DISCOVERY.md](./FLOW_03_JOB_DISCOVERY.md) |
| Flow 4: Bidding | ⬜ Pending | |
| Flow 5: Bid Review | ⬜ Pending | |
| Flow 6: Counter-Offer | ⬜ Pending | |
| Flow 7: Bid Acceptance | ⬜ Pending | |
| Flow 8: Chat Unlock | ⬜ Pending | |
| Flow 9: Chat | ⬜ Pending | |
| Flow 10: Job Completion | ⬜ Pending | |
| Flow 11: Reviews | ⬜ Pending | |
| Flow 12: Cancellation | ⬜ Pending | |
| Flow 13: Wallet | ⬜ Pending | |
| Flow 14: Notifications | ⬜ Pending | |

---

## Notes & Findings

### Fixes Applied
- **Flow 2**: Image upload migrated to Supabase Storage (was base64)
- **Flow 2**: Draft auto-save implemented (localStorage)
- **Flow 3**: Sorting options added (Newest, Budget High/Low, Nearest)

### Issues Identified (Acceptable)
- **Flow 1**: No backup auth methods (Google-only by design)
- **Flow 2**: No max budget limit, no job expiry (by design)
- **Flow 3**: All filters client-side (acceptable for current scale)

