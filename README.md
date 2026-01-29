# CHOWKAR - The Local Super App

**Chowkar** is a hyperlocal marketplace connecting daily wage workers with employers in semi-urban and rural India. This "Super App" allows users to seamless switch between **Hiring** (posting jobs) and **Working** (finding daily wage tasks).

![Chowkar Hero](/assets/hero_banner.png)

## 🚀 Key Features

### 1. The Super Grid
*   **One-Tap Access**: Instant access to popular drivers, maids, laborers, and verified skilled workers.
*   **Global Search**: Powerful search bar to find any service or worker profile instantly.
*   **Localized**: Available in **English**, **Hindi**, and **Punjabi**.

### 2. Dual-Role Ecosystem
*   **Seamless Switching**: Users can be both **Posters** and **Workers** with a single profile.
*   **Smart Profile**: The profile automatically adapts to show "Job Posts" stats for posters and "Jobs Done" for workers.
*   **Privacy First**: Masked phone numbers and secure in-app chat.

### 3. Subscription Models (Freemium)
We offer tiered plans to unlock advanced capability:
*   **Free Starter**: 3 Posts/Month, 5 Bids/Week
*   **Worker Plus (₹49/mo)**: **Unlimited Bids**, Verified Badge, Zero Commission
*   **Pro Poster (₹99/mo)**: **Unlimited Posts**, AI Job Enhancer, AI Wage Estimator
*   **SUPER (₹129/mo)**: ⭐ **Unlimited Everything** - Posts, Bids, AI Tools

### 4. Safety & Trust
*   **Enhanced Reviews**: Star ratings + "Compliment Tags" (e.g., Punctual, Skilled).
*   **Admin 2.0**: 24/7 Moderation "God Mode", User Reports, and System Broadcasts.
*   **Verified Profiles**: Blue tick verification for trusted workers.
*   **No Middlemen**: Direct connection, 0% commission on daily wages.

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), TypeScript, Tailwind CSS
*   **Backend**: Supabase (PostgreSQL, Edge Functions)
*   **AI**: Google Gemini (for Wage Estimation & Job Description Enhancement)
*   **Payments**: Razorpay Integration (UPI, Cards)

---

## 📦 Deployment Guide

### 1. Database Setup
Run the master deployment script to set up all tables, triggers, and functions:
```bash
# Run this SQL in your Supabase SQL Editor
sql/final_fix/DEPLOY_BACKEND.sql
```
This script will:
*   Create `payments` and `subscriptions` tables.
*   Install `create_payment_order` and `verify_payment_success` RPCs.
*   **Deploy Admin 2.0**: Installs Analytics, Broadcast, and Moderation RPCs.

### 2. Frontend Setup
```bash
npm install
npm run dev
```

### 3. Build for Production
```bash
npm run build
```

---

## 🔮 Future Roadmap
*   **Voice-First Interface**: Full voice navigation for illiterate users.
*   **Hyperlocal Maps**: GPS-based "Workers Near Me" live racking.
*   **Escrow Payments**: Secure milestone-based payments for larger contracts.

---
*Built with ❤️ for Bharat*
