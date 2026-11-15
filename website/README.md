# Store App — Public Website & Organization Onboarding

## Overview
This directory contains the public-facing marketing website and self-serve onboarding portal for **Store App**, built with **Next.js 14 (App Router)** and **Tailwind CSS**. It serves as the primary acquisition channel where retail business owners discover the platform, verify their Google identity, configure their organization and flagship store, and seamlessly transition into the operational POS & ERP dashboard.

---

## 🎯 Features Implemented
1. **Modern Marketing Landing Page (`/`)**:
   - Modern dark-mode StoreCraft design with high-impact hero, real-time metrics, interactive feature highlights (Thermal POS, 4-tier Catalog with Dual Barcodes, Indian GST Engine), multi-tenant architecture breakdown, and tier pricing.
   - Global navigation with direct login and "Get Started" CTAs.
2. **Interactive Self-Serve Onboarding Wizard (`/onboard`)**:
   - **Step 1: Google Identity Verification**: Direct sign-in with Google ID token, plus a 1-Click Demo Owner option for instant local testing.
   - **Step 2: Organization Profile**: Business name, auto-slugified unique subdomain preview (e.g. `apex-retail.storeapp.local`), and industry selection.
   - **Step 3: Flagship Store Setup**: Initial store name (defaults to "Main Flagship Store"), store address, and optional GSTIN. Automatically informs the user of assigned roles (`ORG_ADMIN` + `STORE_ADMIN`).
   - **Step 4: Atomic Tenant Provisioning & Handoff**: Communicates with the Django backend, creates the tenant, and immediately redirects the authenticated owner into the Store App dashboard at `http://localhost:5173/auth/callback`.
3. **Backend API Endpoints (`backend/apps/user/`)**:
   - `POST /api/users/auth/google/`: Validates Google ID tokens and checks for existing tenant memberships.
   - `POST /api/users/auth/onboard-organization/`: Atomically provisions `User`, `Organization`, flagship `Store`, `OrganizationStaff` (`ORG_ADMIN`), and `StoreStaff` (`ADMIN`), returning complete JWT access/refresh credentials.
4. **Cross-Port Authentication Handoff (`frontend/src/features/auth/components/AuthCallback.tsx`)**:
   - Receives JWT session parameters from the website, stores them securely in `localStorage`, and forwards the user to `/` (or `/pos`).
5. **Docker Integration**:
   - Containerized via `docker/website.Dockerfile`.
   - Added as a `website` service in `docker/docker-compose.yml` exposed on port `3000:3000`.

---

## 🚀 Running Locally

### Via Docker Compose
From the repository root:
```bash
docker compose -f docker/docker-compose.yml up website
```
The website will be live at `http://localhost:3000`.

### Via Node / npm
From the `website/` folder:
```bash
cd website
npm install
npm run dev
```

---

## ⚙️ Environment Configuration
Configure in `.env`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_DASHBOARD_URL=http://localhost:5173
```
