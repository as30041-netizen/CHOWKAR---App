# CHOWKAR - Technical Specifications (Backend & Database)

## 1. Executive Summary
This document serves as the implementation blueprint for migrating CHOWKAR from a client-side prototype (React Context + LocalStorage) to a robust server-side architecture.

**Recommended Stack:**
*   **Runtime:** Node.js (Express or NestJS)
*   **Database:** PostgreSQL (with PostGIS extension for geolocation)
*   **ORM:** Prisma or TypeORM
*   **Auth:** Firebase Auth (Phone Number verification)
*   **Storage:** AWS S3 (for Job Images)

---

## 2. Database Schema (PostgreSQL)

### 2.1 Users Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique User ID |
| `phone` | VARCHAR(15) | UNIQUE, NOT NULL | Primary identifier |
| `name` | VARCHAR(100) | NOT NULL | Display name |
| `role` | ENUM | 'WORKER', 'POSTER' | Current active role |
| `location_text` | VARCHAR(255) | | Human readable address |
| `geo_location` | GEOGRAPHY(Point) | | PostGIS coordinate for spatial queries |
| `wallet_balance` | DECIMAL(10,2) | DEFAULT 0 | |
| `ai_usage_count` | INTEGER | DEFAULT 0 | Tracks free tier usage |
| `is_premium` | BOOLEAN | DEFAULT FALSE | |
| `created_at` | TIMESTAMP | DEFAULT NOW() | |

### 2.2 Jobs Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | |
| `poster_id` | UUID | FK -> Users.id | |
| `title` | VARCHAR(150) | NOT NULL | |
| `description` | TEXT | | |
| `category` | VARCHAR(50) | | e.g., 'Farm Labor' |
| `budget` | DECIMAL(10,2) | | |
| `status` | ENUM | 'OPEN', 'IN_PROGRESS', 'COMPLETED' | |
| `job_date` | DATE | | |
| `geo_location` | GEOGRAPHY(Point) | | Job site location |
| `image_url` | VARCHAR(512) | | S3 URL (No Base64 in DB) |
| `accepted_bid_id`| UUID | FK -> Bids.id | Nullable |

### 2.3 Bids Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | |
| `job_id` | UUID | FK -> Jobs.id | |
| `worker_id` | UUID | FK -> Users.id | |
| `amount` | DECIMAL(10,2) | NOT NULL | Current proposed amount |
| `status` | ENUM | 'PENDING', 'ACCEPTED', 'REJECTED' | |
| `message` | TEXT | | |
| `negotiation_log`| JSONB | | Array of history objects |

---

## 3. API Endpoints (REST)

### 3.1 Authentication
*   `POST /api/v1/auth/verify-phone`
    *   **Body:** `{ idToken: string }` (Firebase Token)
    *   **Action:** Verifies token, creates User if not exists, returns JWT.

### 3.2 Jobs
*   `GET /api/v1/jobs`
    *   **Query Params:** `lat`, `lng`, `radius` (km), `category`.
    *   **Logic:** Uses PostGIS `ST_DWithin` to find jobs near the Worker.
*   `POST /api/v1/jobs`
    *   **Body:** `{ title, description, budget, lat, lng, ... }`
    *   **Security:** Requires valid JWT.
*   `GET /api/v1/jobs/:id`
    *   **Response:** Job details + Array of Bids (if user is Poster).

### 3.3 Bidding & Negotiation
*   `POST /api/v1/jobs/:id/bid`
    *   **Body:** `{ amount, message }`
    *   **Logic:** Checks if user is Worker and not Poster.
*   `PATCH /api/v1/bids/:id/counter`
    *   **Body:** `{ amount }`
    *   **Logic:** Updates `amount` and appends to `negotiation_log`.
*   `POST /api/v1/bids/:id/accept`
    *   **Logic:**
        1.  Verify User Wallet Balance >= Platform Fee.
        2.  Update Bid Status -> ACCEPTED.
        3.  Update Job Status -> IN_PROGRESS.
        4.  Create Transaction records (Debit Poster, Debit Commission).

### 3.4 AI Proxy (Security Critical)
*   `POST /api/v1/ai/enhance-description`
    *   **Body:** `{ text, category, lang }`
    *   **Server Logic:** Calls Gemini API using server-side API KEY. Returns text.
    *   **Rate Limit:** 10 requests/minute per IP.

---

## 4. Infrastructure Requirements
1.  **Redis:** For caching `GET /jobs` results and managing Rate Limiting on AI endpoints.
2.  **Socket.io Server:** For real-time updates when:
    *   A Worker places a bid (Notifies Poster immediately).
    *   A Chat message is sent.
3.  **Cron Jobs:**
    *   Auto-expire jobs where `job_date` < `current_date`.
