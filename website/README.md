# Store App — Public Website & Organization Onboarding

## Overview
This directory contains the public-facing marketing website and self-serve onboarding portal for **Store App**. It serves as the primary acquisition channel and the entry point where retail business owners and franchise operators discover the platform, register their company, configure their flagship store, and provision their initial administrator credentials.

---

## 🎯 Core Objectives
1. **Product Presentation & Value Proposition**: Educate prospective retailers on Store App's offline-resilient POS, dual-barcode catalog, automated GST compliance, and multi-store inventory engine.
2. **Self-Serve Organization Registration**: Guide the first administrative user through a frictionless, compliant company registration workflow.
3. **Seamless Dashboard Hand-off**: Automatically provision the tenant organization and redirect the authenticated owner directly into the Store App operational dashboard.

---

## 🧭 The Onboarding Journey (Step-by-Step)

```text
Visitor ──► Landing Page ──► Register Org ──► Create Store ──► Admin Credentials ──► Provision Tenant ──► Store App Dashboard
```

### 1. Landing & Product Overview
- **Key Modules Highlighted**: High-speed thermal POS, 4-tier inventory master catalog, multi-vendor procurement & GRN, customer 360 & loyalty, and real-time GST filing.
- **Interactive Demonstrations**: Barcode scanning demo, receipt preview, and pricing tier calculator.

### 2. Multi-Step Onboarding Wizard (`/onboarding`)
- **Step 1: Business Profile**:
  - Legal business name and trade name.
  - 15-digit Indian GSTIN with state code validation and automated PAN extraction.
  - Business structure (Sole Proprietorship, Partnership, Pvt Ltd, Franchise).
  - Business address, State/UT, and PIN code.
- **Step 2: Flagship Store Setup**:
  - Initial branch name (e.g., "Main Street Flagship", "Connaught Place Store").
  - Store code / receipt sequence prefix (e.g., `CP01-`).
  - Store physical address, contact phone, and operating state (for intra-state vs inter-state tax logic).
- **Step 3: Organization Owner Account**:
  - Primary administrator's full name, work email, and 10-digit mobile number.
  - Secure password and multi-factor authentication (MFA) preference.
- **Step 4: Subscription & Activation**:
  - Tier selection (Starter, Multi-Store Pro, Enterprise).
  - Optional trial period activation without upfront card requirement.

### 3. Tenant Provisioning & Hand-off
- Submits structured payload to the backend tenant onboarding endpoint (`POST /api/auth/register-org/`).
- Receives JWT session token pair (`access_token`, `refresh_token`) and tenant organization context.
- Stores secure session and executes seamless redirection into the Store App management console (`/dashboard` or `/pos`).

---

## 🏗️ Planned Tech Stack & Architecture
- **Framework**: Modern React framework (Next.js App Router or Vite + React SPA).
- **Styling**: Tailored design tokens aligned with the StoreCraft design language (clean typography, crisp form layouts, responsive mobile viewports).
- **State Management**: Lightweight form state (Zod validation schemas + React Hook Form).
- **Backend API Integration**: Direct HTTPS REST calls against Django backend endpoints:
  - `POST /api/auth/validate-gstin/`
  - `POST /api/auth/register-organization/`
  - `GET /api/public/plans/`

---

## 📋 Implementation Checklist

### Phase 1: Marketing & Landing Experience
- [ ] Responsive landing page with hero banner, feature grid, and pricing cards.
- [ ] Feature spotlight sections: POS cashier mode, inventory audit ledger, customer loyalty.
- [ ] Hardware compatibility guide (Thermal printers, barcode scanners, cash drawers).

### Phase 2: Organization Onboarding Wizard
- [ ] Multi-step form container with state persistence and back/forward navigation.
- [ ] Real-time GSTIN validation and state code resolution.
- [ ] Primary store configuration fields and receipt prefix generator.
- [ ] Administrator credential form with password strength metering.

### Phase 3: Tenant Integration & Provisioning
- [ ] Backend client integration (`/api/auth/register-organization/`).
- [ ] Tenant provisioning loading screen with status polling.
- [ ] Automated session generation and hand-off redirect to the Store App dashboard.
- [ ] Welcome email and initial onboarding checklist trigger.
