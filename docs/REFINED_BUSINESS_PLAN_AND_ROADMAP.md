# Refined Chowkar Strategic Plan & Technical Roadmap

## 1. Executive Summary & Feedback
**Overall verdict:** The proposed "Hybrid Freemium + Commission" model is **highly viable** and well-tailored to the Indian semi-urban/rural context. The shift away from high commissions (like Urban Company) to a subscription/connection fee model is a strong differentiator that builds supply-side loyalty.

### Critical Feedback & Adjustments
*   **AI Implementation (Reality Check):** While "AI Matching" sounds good for investors, for the first 10,000 users, **PostGIS geospatial queries + SQL filtering** (Availability, Rating, Skills) will outperform complex AI models and cost significantly less.
    *   *Recommendation:* Market it as "Smart Matching" but build it on robust database logic first. Introduce true AI (LLMs/Embeddings) only when data volume justifies it.
*   **Verification Complexity:** Implementing manual "Background Verification" for ₹199 is operationally heavy for a startup.
    *   *Recommendation:* Automate what you can (Aadhaar OCR/Verification APIs) and keep the manual check as a "Premium Verified" badge handled by a back-office admin dashboard.
*   **Escrow Risks:** Holding funds requires Nodal accounts or specific payment gateway products to avoid regulatory issues (RBI guidelines).
    *   *Recommendation:* Start with **Direct Payment** between user/worker (cash/UPI) to build trust. Use the Payment Gateway strictly for platform fees/subscriptions initially.
*   **Category Overload:** Launching 30+ categories at once can dilute supply liquidity (users see empty lists).
    *   *Recommendation:* Launch all *categories* in the UI, but cluster them into "Active Zones" or use "Request a Service" for empty categories to gauge demand.

---

## 2. Refined Business Model

### Value Proposition
*   **Posters:** "Find trusted local help in 10 minutes without middleman commissions."
*   **Workers:** "Keep 100% of your earnings. Pay only small monthly fee for access."

### Monetization Tiers (Simplified for Launch)

| Feature | Free | Pro Poster (₹99/mo) | Worker Plus (₹49/mo) |
| :--- | :--- | :--- | :--- |
| **Posts/Bids** | 3 Posts / 5 Bids | Unlimited Posts | Unlimited Bids |
| **Visibility** | Standard | Top of List | Featured Badge |
| **Contact** | Chat First | Direct Call | Direct Call Access |
| **Fees** | 0% | 0% | 0% |

> **Note:** We remove the 5% commission on >₹5000 transactions initially. Tracking offline cash settlements is hard and causes friction. Focus purely on **SaaS (Subscriptions)** and **Lead Gen** fees first to ensure higher adoption.

---

## 3. Technical Execution Roadmap

### Phase 1: The "Smart" Foundation (Weeks 1-4)
**Goal:** Enable Subscriptions, Expand Categories, and update Trust systems.

1.  **Database Expansion:**
    *   Update `categories` table (Add icons, Hindi/English labels for new 30 items).
    *   Create `subscriptions` table (User ID, Plan Type, Expiry Date, Razorpay Subscription ID).
    *   Add `reviews` table (Rating 1-5, Comment, Photo).
2.  **Payment Integration (Revenue):**
    *   Integrate **Razorpay Subscriptions API** (Recurring payments).
    *   Build "Upgrade Plan" UI screens in Wallet section.
    *   Implement "Feature Gating" logic (e.g., `if (user.plan == 'FREE' && bids > 5) block_action()`).
3.  **Trust Core:**
    *   **Review System:** After a Job is marked "Completed", prompt both sides for 5-star rating. Display average rating on profiles.
    *   **Verification UI:** Upload screen for Aadhaar/ID. Admin dashboard to approve -> Adds "Verified" checkmark.

### Phase 2: Growth & "AI" Features (Weeks 5-8)
**Goal:** Automate matching and improve retention.

1.  **Smart Matching ("AI"):**
    *   *Tech:* Write a Supabase Edge Function that runs every time a job is posted.
    *   *Logic:* Find workers within 5km radius AND matching category.
    *   *Action:* Send Push Notification immediately to these specific workers.
2.  **Worker Tools:**
    *   **Invoice Generator:** Simple PDF generation using `react-pdf` with job details.
    *   **Dashboard:** Show "Profile Views" and "Search Appearances" (Analytics).

### Phase 3: Scale & Ecosystem (Month 3+)
1.  **B2B Dashboard:** Web portal for Construction companies to bulk-post.
2.  **Escrow Payments:** Integrate Razorpay Route to split payments between Worker and Platform safe-keeping.

---

## 4. Immediate Tech Tasks (Recommended Next Steps)
1.  **SQL Migration:** Create the `reviews` and `user_subscriptions` tables.
2.  **Category Seed:** Data script to insert the 30 new categories with image URLs.
3.  **UI Update:** Redesign Home Screen to handle 30 categories (Grid/Scroll layout).
