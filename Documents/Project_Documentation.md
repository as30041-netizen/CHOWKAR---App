# CHOWKAR - Project Documentation

## 1. Product Requirements Document (PRD)

### 1.1 Overview
**CHOWKAR** is a hyperlocal labor marketplace designed for Tier-2 and Tier-3 cities in India. It connects local service seekers (Posters) with daily wage workers (Workers). The platform prioritizes accessibility through vernacular support (Hindi/English), voice capabilities, and AI-driven assistance to bridge literacy gaps.

### 1.2 Target Audience
*   **Posters:** Farmers, small business owners, and homeowners needing immediate, short-term labor (e.g., harvest help, plumbing, driving).
*   **Workers:** Blue-collar gig workers needing daily wages and local opportunities.

### 1.3 Core Value Propositions
*   **Localization:** First-class Hindi support and voice-first interfaces.
*   **AI Assistance:** Generative AI helps write job descriptions, estimate fair wages, and translate chats, removing friction for less tech-savvy users.
*   **Negotiation Engine:** A formalized digital bargaining system (Bid -> Counter -> Accept) mimicking real-world Indian market behavior.

### 1.4 Current "Alpha" Scope
*   **Auth:** OTP-based login (Mocked).
*   **Roles:** Seamless switching between Worker and Poster.
*   **Monetization:** Currently "Free Tier" with a "Premium Waitlist" model to gauge interest without charging users yet.
*   **Platform:** Mobile-web (PWA ready).

---

## 2. Technical Architecture & Data Model

### 2.1 Current Tech Stack
*   **Frontend Framework:** React 19 (Vite).
*   **Styling:** Tailwind CSS (Utility-first).
*   **State Management:** React Context API (`UserContext`, `JobContext`).
*   **Persistence:** Browser `localStorage` (Temporary/Prototyping).
*   **Maps:** Leaflet.js + OpenStreetMap (Client-side rendering).
*   **AI:** Google Gemini API (`gemini-2.5-flash`) via direct REST/SDK calls.
*   **Icons:** Lucide React.

### 2.2 Data Model (Types)

| Interface | Key Fields | Description |
| :--- | :--- | :--- |
| **User** | `id`, `name`, `phone`, `role`, `walletBalance`, `aiUsageCount`, `isPremium` | Unified user profile. `aiUsageCount` tracks the 2-free-try limit. |
| **Job** | `id`, `posterId`, `title`, `budget`, `status` (`OPEN`, `IN_PROGRESS`), `bids[]`, `image` | Central entity. Contains nested Bids array. |
| **Bid** | `id`, `workerId`, `amount`, `status`, `negotiationHistory[]` | Tracks the lifecycle of an application. `negotiationHistory` allows audit trails of price haggling. |
| **Transaction**| `id`, `amount`, `type` (`CREDIT`/`DEBIT`) | Ledger for wallet history. Currently client-side only. |
| **Notification**| `id`, `type`, `relatedJobId` | In-app alerts for bids/counters. |

### 2.3 Directory Structure
*   `contexts/`: Holds global state logic.
*   `components/`: Reusable UI elements (`JobCard`, `ChatInterface`, `LeafletMap`).
*   `services/`: External API logic (`geminiService.ts`).
*   `utils/`: Helpers (`geo.ts`).

---

## 3. Feature Logic & AI Specification

### 3.1 Gemini AI Integration Strategy
The app leverages `@google/genai` to lower the barrier to entry.

*   **A. Job Description Enhancer (`enhanceJobDescriptionStream`)**
    *   *Input:* Short, broken text (e.g., "Need driver 2 days").
    *   *AI Action:* Expands this into a professional 60-word description in the user's selected language.
    *   *Model:* `gemini-2.5-flash`.
    *   *UX:* Streams text token-by-token for perceived speed.

*   **B. Wage Estimator (`estimateWage`)**
    *   *Input:* Job Title + Location.
    *   *AI Action:* Returns a *single integer* estimate based on Tier-2 city rates.
    *   *Logic:* Used to guide Posters who don't know market rates.

*   **C. Image Analysis (`analyzeImageForJob`)**
    *   *Input:* Base64 Image (Camera/Upload).
    *   *AI Action:* Identifies the task (e.g., "Fixing Pipe") and auto-selects the Category ("Plumbing").
    *   *Format:* Enforces JSON schema response for programmatic state updates.

*   **D. Chat Translation (`translateText`)**
    *   *Action:* On-demand translation of chat messages between Hindi and English to facilitate cross-language hiring.

### 3.2 Negotiation Logic
The app implements a state machine for bids:
1.  **PENDING:** Worker places bid.
2.  **COUNTER (Poster):** Poster proposes new price. Status remains Pending, but UI indicates "Waiting for Worker".
3.  **COUNTER (Worker):** Worker proposes new price. Status remains Pending, UI indicates "Waiting for Poster".
4.  **ACCEPTED:** Either party accepts. Job moves to `IN_PROGRESS`. Fees deducted.
5.  **REJECTED:** Bid is closed.

---

## 4. MVP Gap Analysis & Roadmap

To move from the current **Alpha** to a **Production MVP**, the following technical debt and gaps must be addressed.

### 4.1 Critical (Must Fix for Launch)
1.  **Backend Implementation:**
    *   *Current:* Data lives in `localStorage`. If cache clears, data is lost.
    *   *Requirement:* Port Context logic to a backend (Node.js/Express or Supabase/Firebase).
    *   *Database:* Postgres (SQL) is recommended for relational data (Jobs <-> Bids).
2.  **Security - API Keys:**
    *   *Current:* `process.env.API_KEY` is exposed in frontend bundles.
    *   *Requirement:* Create a server-side proxy endpoint (e.g., `/api/ai/enhance`) so the key is never exposed to the client.
3.  **Auth Verification:**
    *   *Current:* Accepts OTP `123456`.
    *   *Requirement:* Integration with SMS provider (Twilio/Msg91/Firebase Auth).
4.  **Image Storage:**
    *   *Current:* Base64 strings (will crash browser storage).
    *   *Requirement:* Upload images to S3/Cloudinary and store only the URL in the database.

### 4.2 User Experience Improvements (Beta)
1.  **Real-time Sockets:**
    *   *Current:* Chat updates require refresh or state change.
    *   *Requirement:* Socket.io or Firestore listeners for instant chat/bid notifications.
2.  **Map Optimization:**
    *   *Current:* Leaflet is good, but address search is basic.
    *   *Requirement:* Integrate Google Places Autocomplete or Mapbox Geocoding for better address selection.

---

## 5. User Flow Diagrams (Text Description)

### Flow A: The Poster Journey
1.  **Login/Signup:** Enter mobile -> OTP -> Location Permission.
2.  **Post Job:**
    *   Click "+" -> Fill Title.
    *   *Optional:* Click "Camera" -> Take photo of broken switch -> AI auto-fills description.
    *   *Optional:* Click "AI Estimate" -> Get price suggestion.
    *   Submit -> Job appears in feed.
3.  **Review Bids:**
    *   Receive Notification "New Bid: ₹500".
    *   Open Bid -> Click "Counter" -> Enter ₹400.
    *   Wait for Worker response.
4.  **Hiring:**
    *   Worker accepts ₹400.
    *   Poster clicks "Accept".
    *   Wallet deducted (Platform Fee).
    *   Chat unlocks.

### Flow B: The Worker Journey
1.  **Discovery:**
    *   Switch to "Worker Mode".
    *   View "Jobs Near Me" (sorted by Geo-distance).
    *   Filter by "Farm Labor".
2.  **Application:**
    *   Select Job -> Click "Read Aloud" (TTS) to hear description.
    *   Click "Bid Now" -> Enter ₹500.
    *   *Optional:* Use "AI Enhance" to write a polite message.
3.  **Negotiation:**
    *   Receive Counter offer (₹400).
    *   Accept Offer.
4.  **Execution:**
    *   Job status becomes "Hired".
    *   Open Chat -> Use Voice Typing to ask for address.
    *   Complete Job -> Receive Payment (offline) -> Request Review.
