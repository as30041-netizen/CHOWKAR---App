# Flow 3: Job Discovery (Worker) - Deep Dive

> **Status**: DISCOVERY COMPLETE
> **Last Updated**: 2025-12-21
> **Category**: Job Browsing & Search

---

## Executive Summary

Workers discover jobs through the home screen with a **dual-mode interface** (Worker/Poster toggle). Jobs are fetched with pagination (20 per page), filtered client-side, and displayed with distance calculations. The system supports text search, category filters, location/budget/distance filters, and voice search.

---

## 1. Data Fetching

### Question: How are jobs loaded?

| Aspect | Details |
|--------|---------|
| Initial Load | 20 jobs on app start |
| Pagination | Load more (20 per page) |
| Ordering | `created_at DESC` (newest first) |
| Bids Loading | Fetched only for loaded jobs (optimization) |

**Source**: `contexts/JobContextDB.tsx` lines 205-230

### Load Flow:
```
1. App starts → refreshJobs()
2. Check expired bid deadlines (24-hour limit)
3. fetchJobs(limit=20, offset=0) 
4. Fetch bids for loaded job IDs only
5. Set jobs in context state
6. Realtime subscription active for live updates
```

---

## 2. Real-time Updates

### Question: Are jobs updated in real-time?

**Answer**: ✅ YES, via Supabase Realtime

| Event | Action |
|-------|--------|
| New job posted | Added to jobs array |
| Job updated | Replaced in array |
| Job deleted | Removed from array |
| New bid placed | Added to job's bids |
| Bid updated | Replaced in job's bids |

**Source**: `contexts/JobContextDB.tsx` lines 150-200 (Realtime subscriptions)

---

## 3. Role Toggle

### Question: How do users switch between Worker and Poster mode?

**Answer**: Global toggle on Home page (persisted in UserContext)

| Mode | Shows | Actions Available |
|------|-------|-------------------|
| Worker ("Find Work") | All OPEN jobs (not own) | Bid, View details |
| Poster ("Hire / My Jobs") | Only own jobs | View bids, Edit, Chat |

**Source**: `pages/Home.tsx` lines 79-101

```tsx
<button onClick={() => setRole(UserRole.WORKER)}>Find Work</button>
<button onClick={() => setRole(UserRole.POSTER)}>Hire / My Jobs</button>
```

---

## 4. Search Functionality

### Question: What search options are available?

| Feature | Type | Location |
|---------|------|----------|
| Text Search | Title matching | Search bar |
| Voice Search | Speech-to-text | Mic button |
| Category Filter | Horizontal pills | Below search |
| Filter Modal | Budget, Location, Distance | Filter icon |

**Source**: `pages/Home.tsx` lines 123-158

### Voice Search:
- Uses Web Speech API (`webkitSpeechRecognition`)
- Supports Hindi (`hi-IN`) and English (`en-IN`)
- Converts speech to search query

---

## 5. Filter Options

### Question: What filters are available?

| Filter | Type | Comparison |
|--------|------|------------|
| Category | Select from 8 | Exact match |
| Location | Text input | Contains (case-insensitive) |
| Min Budget | Number | >= value |
| Max Distance | Slider (1-50 km) | <= value |

**Source**: `components/FilterModal.tsx` and `pages/Home.tsx` lines 226-231

### Filter Logic:
```typescript
// pages/Home.tsx lines 226-231
if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
if (selectedCategory !== 'All' && j.category !== selectedCategory) return false;
if (filterLocation && !j.location.toLowerCase().includes(filterLocation.toLowerCase())) return false;
if (filterMinBudget && j.budget < parseInt(filterMinBudget)) return false;
if (filterMaxDistance && j.distance > parseInt(filterMaxDistance)) return false;
```

---

## 6. Job Visibility Rules

### Question: Which jobs does a worker see?

| Condition | Visible? | Notes |
|-----------|----------|-------|
| Status = OPEN, not own job | ✅ Yes | Main discovery |
| Status = OPEN, own job | ❌ No | Worker can't bid on own |
| Status = IN_PROGRESS, has bid | ✅ Yes | Track ongoing work |
| Status = COMPLETED, has bid | ✅ Yes | View history |
| Status != OPEN, no bid | ❌ No | Not relevant |

**Source**: `pages/Home.tsx` lines 218-233

### "My Bids" Toggle:
- When enabled: Shows only jobs where `j.bids.find(b => b.workerId === user.id)` exists
- Useful for tracking applications

---

## 7. Distance Calculation

### Question: How is distance calculated?

**Function**: `calculateDistance()` from `utils/geo.ts`

**Method**: Haversine formula (great-circle distance)

```typescript
// pages/Home.tsx line 209
.map(j => ({
  ...j, 
  distance: (user.coordinates && j.coordinates) 
    ? calculateDistance(user.coordinates.lat, user.coordinates.lng, j.coordinates.lat, j.coordinates.lng) 
    : undefined 
}))
```

**Note**: Distance is undefined if either user or job lacks coordinates.

---

## 8. Categories

### Question: What job categories exist?

| Category (EN) | Category (HI) |
|---------------|---------------|
| Farm Labor | खेत मजदूरी |
| Construction | निर्माण / मिस्त्री |
| Plumbing | नल फिटिंग |
| Electrical | बिजली काम |
| Driver | ड्राइवर |
| Cleaning | सफाई |
| Delivery | डिलीवरी |
| Other | अन्य |

**Source**: `constants.ts` lines 4-24

---

## 9. Job Card Display

### Question: What information is shown on job cards?

| Field | Display |
|-------|---------|
| Title | Main heading |
| Category | Badge/chip |
| Location | With icon |
| Budget | ₹ amount |
| Distance | X km (if available) |
| Poster Name | Who posted |
| Posted Time | Relative (e.g., "2 days ago") |
| Status | Badge (Open/In Progress/Completed) |
| Bid Count | Number of bids received |

**Actions on Card** (Worker mode):
- "Bid Now" → Opens BidModal
- Click → Opens JobDetailsModal

---

## 10. Infinite Scroll / Load More

### Question: How is pagination handled?

**Method**: "Load More" button (not infinite scroll)

```typescript
// contexts/JobContextDB.tsx
const fetchMoreJobs = async () => {
  if (isLoadingMore || !hasMore) return;
  const currentOffset = jobs.length;
  const { jobs: newJobs } = await fetchJobs(20, currentOffset);
  // Deduplicate and append
};
```

**UI**: Button appears when `hasMore === true && !loading`

**Source**: `pages/Home.tsx` lines 254-278

---

## 11. Error Handling

### Question: How are errors displayed?

| Error | Display | Recovery |
|-------|---------|----------|
| Fetch failed | Red banner | "Retry" button |
| No jobs found | Empty state with icon | Clear filters link |

**Source**: `pages/Home.tsx` lines 116-121, 286-291

---

## 12. UI States

### Question: What loading states exist?

| State | UI |
|-------|-----|
| Initial loading | 3 skeleton cards |
| Load more loading | Button shows spinner |
| Refreshing | Refresh icon spins |
| Empty | Icon + "No jobs found" text |

---

## 13. Related Files Summary

| File | Purpose |
|------|---------|
| `pages/Home.tsx` | Main home screen with job list |
| `components/JobCard.tsx` | Individual job display |
| `components/FilterModal.tsx` | Advanced filter UI |
| `contexts/JobContextDB.tsx` | Jobs state, fetching, realtime |
| `services/jobService.ts` | API calls to Supabase |
| `utils/geo.ts` | Distance calculation |
| `constants.ts` | Categories, translations |

---

## 14. Database Query

### Question: What query fetches jobs?

```sql
SELECT * FROM jobs
ORDER BY created_at DESC
LIMIT 20 OFFSET 0
```

Then bids fetched separately:
```sql
SELECT * FROM bids
WHERE job_id IN (job_id_1, job_id_2, ...)
ORDER BY created_at DESC
```

**Optimization**: Bids only fetched for visible jobs, not all jobs in DB.

---

## 15. Identified Issues & Fixes Applied

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| ~~No sorting options~~ | ~~Low~~ | ✅ FIXED | 4 sort options: Newest, Budget High/Low, Nearest |
| All filters client-side | Medium | Acceptable | Works for current scale, monitor for growth |
| ~~No saved searches~~ | ~~Low~~ | N/A | Not needed per user |
| Distance requires GPS | Low | Acceptable | Falls back gracefully (shows no distance) |
| ~~No min on budget filter input~~ | ~~Low~~ | ✅ FIXED | Added min="0" |

### Fixes Applied (2025-12-21):

1. **Sorting Options Added**
   - New sort dropdown button in worker mode (ArrowUpDown icon)
   - 4 sort options with Hindi translations:
     - Newest First (नया पहले) - default
     - Budget: High to Low (बजट: ज्यादा से कम)
     - Budget: Low to High (बजट: कम से ज्यादा)
     - Nearest First (पास वाले पहले)
   - Sort indicator highlights when non-default sort is active
   - Jobs without distance go to end when sorting by distance

---

## 16. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOB DISCOVERY FLOW (Worker)                  │
└─────────────────────────────────────────────────────────────────┘

[App Opens]
      │
      ▼
[refreshJobs() called]
      │
      ▼
[checkExpiredBidDeadlines()]
      │
      ▼
[fetchJobs(limit=20, offset=0)]
      │
      ├── [Fetch jobs from Supabase]
      │   └── SELECT * FROM jobs ORDER BY created_at DESC LIMIT 20
      │
      └── [Fetch bids for loaded jobs]
          └── SELECT * FROM bids WHERE job_id IN (...)
      │
      ▼
[Set jobs in JobContext]
      │
      ▼
[Subscribe to Realtime channels]
      │
      ▼
[Render Home page]
      │
      ├── [Role = WORKER]
      │   ▼
      │   [Show mode toggle]
      │   [Show search bar + voice]
      │   [Show category pills]
      │   [Show filter button]
      │
      ▼
[Apply Client-Side Filters]
      │
      ├── [Is own job?] → Hide
      ├── [Status != OPEN && no bid?] → Hide
      ├── [Matches search query?] → Show/Hide
      ├── [Matches category?] → Show/Hide
      ├── [Matches location filter?] → Show/Hide
      ├── [Budget >= min?] → Show/Hide
      └── [Distance <= max?] → Show/Hide
      │
      ▼
[Render Filtered JobCards]
      │
      ▼
[Show "Load More" if hasMore]
      │
      └── [Click] → fetchMoreJobs(offset = jobs.length)

=== REAL-TIME UPDATES ===

[Realtime: postgres_changes on 'jobs']
      │
      ├── [INSERT] → Add to jobs array
      ├── [UPDATE] → Replace in array
      └── [DELETE] → Remove from array

[Realtime: postgres_changes on 'bids']
      │
      ├── [INSERT] → Add to job.bids
      └── [UPDATE] → Replace in job.bids
```

---

## Verification Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Jobs load on app open | [ ] | |
| Search by title works | [ ] | |
| Category filter works | [ ] | |
| Voice search works | [ ] | |
| Location filter works | [ ] | |
| Budget filter works | [ ] | |
| Distance filter works | [ ] | |
| "My Bids" toggle works | [ ] | |
| Load more works | [ ] | |
| Real-time new jobs appear | [ ] | |
| Own jobs hidden in Worker mode | [ ] | |

---

## Notes & Observations

- Client-side filtering is fast for current scale but may need server-side for growth
- Voice search is a differentiator for rural/low-literacy users
- Hindi translations fully implemented for all UI elements
- Real-time updates provide excellent UX

