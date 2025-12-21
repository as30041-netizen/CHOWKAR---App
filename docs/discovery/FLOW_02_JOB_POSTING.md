# Flow 2: Job Posting (Poster) - Deep Dive

> **Status**: DISCOVERY COMPLETE
> **Last Updated**: 2025-12-21
> **Category**: Job Management

---

## Executive Summary

Job posting in CHOWKAR follows a **pay-to-post model** with a configurable fee (default ₹10). The system prioritizes wallet balance deduction first, falling back to Razorpay payment if insufficient. Jobs can be edited only if OPEN status with no accepted bids. AI features (description enhancement, wage estimation) are available with free usage limits.

---

## 1. Required Fields

### Question: What fields are required to post a job?

| Field | Required | Source | Notes |
|-------|----------|--------|-------|
| Title | ✅ Yes | Form input | Min length validation |
| Description | ✅ Yes | Form input | AI enhancement available |
| Job Date | ✅ Yes | Date picker | Start date |
| Budget | ✅ Yes | Number input | Must be > 0 |
| Category | ⚠️ Optional | Dropdown | Default: first category |
| Duration | ⚠️ Optional | Text input | Default: "Flexible" |
| Location | ⚠️ Optional | From profile | Uses user.location |
| Coordinates | ⚠️ Optional | GPS | From user or captured |
| Image | ⚠️ Optional | Upload/Camera | Analyzed by AI for details |

**Source**: `components/JobPostingForm.tsx` lines 64-81

---

## 2. Categories

### Question: What categories are available?

| Category | English | Hindi |
|----------|---------|-------|
| Farm Labor | Farm Labor | खेत मजदूरी |
| Construction | Construction | निर्माण / मिस्त्री |
| Plumbing | Plumbing | नल फिटिंग |
| Electrical | Electrical | बिजली काम |
| Driver | Driver | ड्राइवर |
| Cleaning | Cleaning | सफाई |
| Delivery | Delivery | डिलीवरी |
| Other | Other | अन्य |

**Source**: `constants.ts` lines 4-24

---

## 3. Payment Model

### Question: Is job posting fee charged? How?

| Setting | Value | Source |
|---------|-------|--------|
| Job Posting Fee | ₹10 (configurable) | `app_config.job_posting_fee` |
| Default Fallback | ₹10 | `paymentService.ts` line 19 |

### Payment Flow:

```
1. User fills form and clicks "Post Job"
2. Check wallet balance: checkWalletBalance(userId, postingFee)
3. If sufficient:
   └── Deduct from wallet: deductFromWallet(userId, fee, 'Job Posting Fee', 'JOB_POSTING')
   └── Create job immediately
   └── Show success: "Job posted! ₹X deducted from wallet."
4. If insufficient:
   └── Open PaymentModal (Razorpay)
   └── On payment success: handlePaymentSuccess(paymentId)
   └── Create job
```

**Source**: `JobPostingForm.tsx` lines 155-192

---

## 4. Validations

### Question: What validations exist?

| Validation | Type | Error Message |
|------------|------|---------------|
| Title empty | Required | "Please fill in all fields" |
| Description empty | Required | "Please fill in all fields" |
| Date empty | Required | "Please fill in all fields" |
| Budget empty | Required | "Please fill in all fields" |
| Budget ≤ 0 | Range | "Please enter a valid budget amount" |
| Budget NaN | Type | "Please enter a valid budget amount" |

**Source**: `JobPostingForm.tsx` lines 64-81

---

## 5. AI Features

### Question: What AI features are available for job posting?

| Feature | Function | Free Limit |
|---------|----------|------------|
| AI Enhance Description | `enhanceJobDescriptionStream()` | 2 uses |
| AI Estimate Wage | `estimateWage()` | 2 uses |
| AI Image Analysis | `analyzeImageForJob()` | 2 uses |

### Free Usage Limit:
- **Limit**: 2 free uses per user
- **After limit**: Premium required (or locked)
- **Tracking**: `profiles.ai_usage_count`

**Source**: `constants.ts` line 433: `FREE_AI_USAGE_LIMIT = 2`

---

## 6. Image Upload

### Question: Can poster add images? How?

**Answer**: ✅ YES

| Feature | Details |
|---------|---------|
| Upload method | File input (camera + gallery) |
| Compression | Yes (0.6 quality JPEG) |
| Max size | Compressed to ~800px width |
| AI Analysis | Optional - fills title/description |
| Storage | Base64 in job.image field |

**Source**: `JobPostingForm.tsx` lines 310-368

---

## 7. Location Handling

### Question: How is location captured?

| Method | Source | Priority |
|--------|--------|----------|
| GPS Button | `getDeviceLocation()` | User-triggered |
| Profile Location | `user.location` | Default fallback |
| Profile Coordinates | `user.coordinates` | Latitude/longitude |

**Source**: `JobPostingForm.tsx` lines 144-145

---

## 8. Post-Submission Actions

### Question: What happens after successful posting?

```
1. Job saved to database
   └── createJob() in jobService.ts
   └── Optimistic UI update in JobContext

2. Notification sent to poster
   └── addNotification(user.id, "Job Posted", "Job is now live!", "SUCCESS", jobId)

3. Wallet deduction recorded
   └── Transaction logged in transactions table

4. Form reset
   └── All fields cleared

5. Navigate to home
   └── onSuccess() callback → navigate('/')

6. Job appears in real-time for workers
   └── Via Supabase Realtime subscription
```

---

## 9. Editing Jobs

### Question: Can jobs be edited? When?

| Condition | Can Edit? | Notes |
|-----------|-----------|-------|
| Status = OPEN, no bids | ✅ Yes | Full edit |
| Status = OPEN, has bids | ✅ Yes | Notifies bidders |
| Status = IN_PROGRESS | ❌ No | "Cannot edit in progress" |
| Status = COMPLETED | ❌ No | "Cannot edit completed" |

### Edit Flow:
```
1. Navigate to /post with initialJob state
2. Form pre-fills with job data
3. Validate new data
4. updateJob() - no payment for edits
5. Notify poster: "Job Updated"
6. If has bids: Notify all PENDING bidders
```

**Source**: `JobPostingForm.tsx` lines 84-128

---

## 10. Job Creation in Database

### Question: How is job saved to database?

**Function**: `createJob()` in `jobService.ts`

**Fields saved**:
```typescript
{
  poster_id: job.posterId,
  poster_name: job.posterName,
  poster_phone: job.posterPhone,
  poster_photo: job.posterPhoto,
  title: job.title,
  description: job.description,
  category: job.category,
  location: job.location,
  latitude: job.coordinates?.lat,
  longitude: job.coordinates?.lng,
  job_date: job.jobDate,
  duration: job.duration,
  budget: job.budget,
  status: 'OPEN',
  image: job.image
}
```

**Note**: `id` is generated by database (UUID), not frontend.

---

## 11. Payment Service Details

### Question: How does the payment flow work?

**Key Functions**:

| Function | Purpose | Source |
|----------|---------|--------|
| `getAppConfig()` | Fetch job_posting_fee, connection_fee | `paymentService.ts` L9-28 |
| `checkWalletBalance()` | Check if sufficient funds | `paymentService.ts` |
| `deductFromWallet()` | Deduct and log transaction | `paymentService.ts` |
| `createPaymentRecord()` | Log Razorpay payment attempt | `paymentService.ts` L53-74 |

---

## 12. Notification Flow

### Question: What notifications are sent?

| Event | Recipient | Type | Message |
|-------|-----------|------|---------|
| Job Posted | Poster | SUCCESS | "Job is now live!" |
| Job Updated | Poster | SUCCESS | "Job has been updated." |
| Job Updated | Bidders (PENDING) | INFO | "Job you bid on was updated." |

**Source**: `JobPostingForm.tsx` lines 113-127, 171, 213

---

## 13. Related Files Summary

| File | Purpose |
|------|---------|
| `pages/PostJob.tsx` | Page wrapper, handles routing |
| `components/JobPostingForm.tsx` | Main form component (579 lines) |
| `contexts/JobContextDB.tsx` | `addJob()`, `updateJob()` with optimistic UI |
| `services/jobService.ts` | `createJob()`, `updateJob()` DB operations |
| `services/paymentService.ts` | Wallet checks, Razorpay integration |
| `services/geminiService.ts` | AI features |
| `constants.ts` | Categories, translations, mock data |

---

## 14. Configuration Verification

### Database Config (`app_config` table):

| Key | Expected Value | Purpose |
|-----|----------------|---------|
| `job_posting_fee` | 10 (or custom) | Fee to post job |
| `connection_fee` | 20-50 | Worker chat unlock fee |

### To verify run SQL:
```sql
SELECT key, value FROM app_config 
WHERE key IN ('job_posting_fee', 'connection_fee');
```

---

## 15. Identified Issues & Fixes Applied

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| No max budget limit | Low | Open | Could add upper limit validation |
| ~~No job expiry~~ | ~~Medium~~ | N/A | Not needed per user |
| ~~Image stored as base64~~ | ~~Medium~~ | ✅ FIXED | Now uploads to Supabase Storage |
| ~~No draft save~~ | ~~Low~~ | ✅ FIXED | Auto-saves to localStorage |
| ~~No min attribute on budget input~~ | ~~Low~~ | ✅ FIXED | Added min="1" |
| ~~No title max length~~ | ~~Low~~ | ✅ FIXED | Added maxLength=100 |

### Fixes Applied (2025-12-21):

1. **Image Upload to Supabase Storage**
   - Created `services/storageService.ts` with `uploadJobImage()` function
   - Images are now uploaded to `job-images` bucket
   - Public URLs stored in database instead of base64
   - Reduces database size and improves performance
   - **SQL Required**: Run `SETUP_JOB_IMAGES_STORAGE.sql` in Supabase

2. **Draft Auto-Save**
   - Form data saved to `localStorage` with key `chowkar_job_draft`
   - Auto-saves with 1-second debounce
   - Loads on page revisit (new jobs only, not edits)
   - Clears after successful submission

---

## 16. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      JOB POSTING FLOW                           │
└─────────────────────────────────────────────────────────────────┘

[Navigate to /post]
      │
      ▼
[JobPostingForm renders]
      │
      ├── [If initialJob exists] → Pre-fill form (Edit Mode)
      │
      ▼
[User fills required fields]
      │
      ├── [Optional] AI Enhance Description
      ├── [Optional] AI Estimate Wage  
      ├── [Optional] Upload Image (AI analyze)
      ├── [Optional] Capture GPS Location
      │
      ▼
[Click "Post Job Now"]
      │
      ▼
[Validate Fields]
      │
      ├── [Fails] → Show error alert → STOP
      │
      ▼
[Is Edit Mode?]
      │
      ├── [YES - EDITING] ────────────────────┐
      │   ↓                                   │
      │   [Check status = OPEN?]              │
      │   ├── [NO] → Error → STOP             │
      │   ↓                                   │
      │   [updateJob()]                       │
      │   ↓                                   │
      │   [Notify poster + bidders]           │
      │   ↓                                   │
      │   [Reset form → Navigate home]        │
      │                                       │
      ▼                                       │
[NEW JOB]                                     │
      │                                       │
      ▼                                       │
[checkWalletBalance()]                        │
      │                                       │
      ├── [SUFFICIENT] ──────────────────────────────┐
      │   ↓                                          │
      │   [deductFromWallet()]                       │
      │   ↓                                          │
      │   [refreshUser() - update UI]                │
      │   ↓                                          │
      │   [addJob() → createJob() in DB]             │
      │   ↓                                          │
      │   [addNotification("Job Posted")]            │
      │   ↓                                          │
      │   [Show success alert]                       │
      │   ↓                                          │
      │   [Reset form → Navigate home]               │
      │                                              │
      ▼                                              │
[INSUFFICIENT WALLET]                                │
      │                                              │
      ▼                                              │
[setPendingJob(newJob)]                              │
      │                                              │
      ▼                                              │
[Show PaymentModal (Razorpay)]                       │
      │                                              │
      ├── [User closes] → STOP                       │
      │                                              │
      ▼                                              │
[User completes Razorpay payment]                    │
      │                                              │
      ▼                                              │
[handlePaymentSuccess(paymentId)]                    │
      │                                              │
      ▼                                              │
[addJob() with payment_id]                           │
      │                                              │
      ▼                                              │
[addNotification("Job Posted")]                      │
      │                                              │
      ▼                                              │
[Reset form → Navigate home] ←───────────────────────┘
```

---

## Verification Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Form renders correctly | [ ] | |
| Required field validation works | [ ] | |
| Wallet deduction works | [ ] | |
| Razorpay fallback works | [ ] | |
| Job appears in database | [ ] | |
| Job appears in home for workers | [ ] | |
| Notification sent to poster | [ ] | |
| Edit mode pre-fills correctly | [ ] | |
| Edit restrictions enforced | [ ] | |

---

## Notes & Observations

- Job posting is the primary revenue source (₹10/job)
- AI features create value-add for premium upgrade
- Optimistic UI provides instant feedback
- Real-time sync means workers see jobs immediately

