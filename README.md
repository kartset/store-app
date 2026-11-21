# Store App — Enterprise Retail ERP, POS & AI Copilot

Store App is an enterprise retail operations platform built with a high-performance Django REST Framework backend, modern Mantine React frontend, and native Model Context Protocol (MCP) AI assistants.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.14, Django 6.1, Django REST Framework, SimpleJWT
- **Database:** PostgreSQL (with central linear ledger & soft deletes)
- **Frontend:** React 19, TypeScript, Mantine v9, Zustand, TanStack React Query, Tabler Icons, Vite
- **AI & MCP:** Model Context Protocol (JSON-RPC 2.0), OpenAI & OpenRouter multi-turn proxy, offline deterministic intent router

---

## 🏛️ Backend Architecture Summary

The backend features a decoupled architecture designed to eliminate circular imports, maintain flat migrations, and enable dynamic field expansion:

- **Centralized Database (`db`):** All database models reside in a single top-level `backend/db/` package. All migrations are consolidated into a single linear sequence in `db/migrations/`, preventing circular foreign key dependencies.
- **Micro-App Segregation (`apps/`):** Business logic is partitioned into dedicated domain packages under `backend/apps/` (e.g. `user`, `organisation`, `store`, `products`, `inventory`, `vendor`, `customer`, `invoice`, `orders`, `delivery`, `gst`, `mcp`, `data_exchange`), keeping views and serializers clean and modular.
- **Custom Serialization Pattern (Explicit `_id` Foreign Keys):** Model foreign keys are defined with explicit `_id` suffixes (e.g., `store_id`), preserving clean attribute names (e.g., `store`) in serializers for dynamic, GraphQL-style nested expansions.
- **Unified BaseModel & Soft Deletes:** All entities inherit from `BaseModel`, providing UUID4 primary keys, strict audit logging (`created_at`, `created_by`, `updated_at`, `updated_by`), and indexed soft deletion (`is_deleted`, `deleted_at`, `deleted_by`).
- **Decoupled User Architecture:** Django's default `auth.User` is reserved strictly for internal Django Admin (`/admin/`), while application users, cashiers, and store managers use `db.User` authenticated via SimpleJWT.

---

## 📦 Implemented Enterprise Modules

### 1. 4-Tier Master Product Catalog & Global Register
- **4-Tier Lifecycle**: Global Register (`CatalogueItem`) ➔ Organization Master (`Product`) ➔ Store Physical Inventory (`Inventory`) ➔ Double-Entry Movement Ledger (`StockMovement`).
- **Dual Barcode Support**: Universal manufacturer EAN-13/UPC barcode (`barcode`) + store-generated thermal sticker barcode (`internal_barcode`).
- **1-Click Global Adoption**: Retailers can search the Global Register and adopt pre-filled FMCG products with standard HSN and GST rates.
- **Auto-Detection & Auto-Linking**: Live barcode scanning in ProductDrawer auto-queries the master catalog with 1-click Auto-fill.

### 2. Store Inventory & Double-Entry Stock Movement Ledger
- **Live Inventory Dashboard (`/inventory`)**: Real-time KPI metrics (Units in Stock, Low Stock Alerts, Out of Stock, Total Valuation).
- **Goods Receipt Note (GRN) Inwarding**: Multi-item stock receiving drawer with batch numbers, purchase costs, store price overrides, and supplier invoice references.
- **Stock Adjustment Modal**: Increments/decrements with audit reasons (Waste/Damage, Return Restock, Audit Discrepancy).
- **Stock Movement Audit Ledger**: Immutable audit trail tracking every unit delta.

### 3. Vendor Management & Sourcing Catalog
- **Vendor Master & Compliance (`/vendors`)**: Organization vendor directory with 15-digit GSTIN validation, automatic PAN extraction, payment terms (`COD`, `PREPAID`, `NET_15`, `NET_30`), credit limits, and bank details.
- **Vendor-Product Sourcing Matrix (`VendorProduct`)**: Multi-vendor agreed unit pricing, minimum order quantities (MOQ), and delivery lead times.
- **Direct GRN Integration**: Inwarding drawer pre-populates agreed purchase prices from active vendor agreements.

### 4. Customer 360, POS Fast Lookup & Multi-Store Loyalty
- **2-Tier Identity Architecture**: Global tenant profile (`Customer`) anchored on unique mobile number + store relationship (`StoreCustomer`) tracking store visits, loyalty points, and credit limits.
- **POS Fast Phone Lookup**: Sub-50ms phone lookup with auto-select, automatic formatting, and walk-in fallback.
- **Quick Customer Modal**: 4-field instant counter registration without cashier disruptions.
- **Loyalty Redemption Calculator**: Points redemption slider with smart ceiling based on bill total and real-time discount deduction.
- **Customer 360 Drawer**: Chronological receipt timeline with itemized line breakdowns.

### 5. Invoicing & Billing Engine
- **Statutory GST Calculations**: Line-item HSN-wise tax breakdown, CGST + SGST (intra-state) vs IGST (inter-state) calculation.
- **Multi-Item Line Pricing**: Unit price, line discounts, tax amounts, line net totals, and round-off adjustment.
- **Invoice State Machine**: `DRAFT` ➔ `PAID` ➔ `CANCELLED`.
- **Atomic Stock Depletion**: Completing an invoice atomically triggers `StockMovement` reduction in store inventory.

### 6. Cash Register & Shift Z-Reports (`/register`)
- **Shift Management**: Register opening with float verification, denominations counter, and active shift locking.
- **Mid-Shift Cash Drops & Pay-Outs**: Recorded with cash drawer limits.
- **Register Closing & Z-Report Generation**: Expected vs actual cash count, over/short variance calculation, and exportable settlement slips.

### 7. Omnichannel Orders & Fulfillment (`/orders`)
- **Omnichannel Support**: Walk-in POS, phone orders, and web orders.
- **Fulfillment Pipeline**: `PENDING` ➔ `CONFIRMED` ➔ `PREPARING` ➔ `READY_FOR_PICKUP` ➔ `DISPATCHED` ➔ `COMPLETED`.
- **Order Invoicing**: Direct conversion of confirmed orders to tax invoices.

### 8. Real-Time Retail Analytics & BI (`/analytics`)
- **Executive KPI Strip**: Gross revenue, net profit margin, invoice count, and average order value (AOV).
- **Continuous Sales & Revenue Trajectory**: Interactive daily time-series line chart tracking gross revenue, net sales, and invoice volume with continuous daily resolution.
- **Hourly Sales Velocity**: Visual heatmaps and peak hour rush detection.
- **Top Product Performance**: Velocity tracking, revenue contribution, and margin analytics.
- **Payment Method Distribution**: Tender split across Cash, UPI, Card, and Store Credit.
- **Comprehensive CSV Export**: Instant export of consolidated period summaries, daily trajectories, payment breakdowns, and top products.

### 9. Data Exchange & Bulk Migration Hub (`/data-exchange`)
- **Multi-Entity Bulk Import**: CSV and Excel imports for products, inventory stock, customers, and vendors.
- **Dry-Run Validation Engine**: Complete pre-commit linting identifying schema mismatches, duplicate barcodes, or invalid GSTINs.
- **Template Download Center**: Pre-formatted standard templates with sample data.
- **Comprehensive CSV Exports**: Instant export of catalog, inventory, and customer databases.

### 10. Delivery & Fleet Dispatch Operations (`/deliveries`)
- **Fleet Management**: Delivery dispatch queue with status pipeline (`PENDING`, `ASSIGNED`, `PICKED_UP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `FAILED`).
- **Driver Assignment & Dispatch**: Internal driver fleet and external courier tracking.
- **Driver OTP Delivery Verification**: Secure 4-digit customer OTP verification ensuring delivery authentication.
- **Cash on Delivery (COD) Reconciliation**: Expected cash collection tracking with automated settlement.

### 11. GST Filing & Statutory Tax Compliance (`/gst`)
- **GSTR-1 Tax Engine**: Outward supplies breakdown across B2B, B2CL (large consumer), B2CS (small consumer), CDNR/CDNUR credit notes, and HSN summary.
- **GSTR-3B Tax Liability Table**: Statutory Table 3.1 outward taxable supplies and Table 3.2 inter-state supplies summary.
- **Statutory GSTN JSON Exporter**: Direct one-click export of government GSTN offline tool-compliant JSON files.
- **Filing Periods Ledger**: Monthly and quarterly period tracking (`DRAFT`, `READY`, `FILED`) with ARN recording and audit lock.

### 12. Dedicated Model Context Protocol (MCP) Service & AI Copilot (`mcp/`, `/api/mcp/`, `/ai-settings`)
- **Standalone MCP Microservice (`mcp/`)**: Official Model Context Protocol service built with Python (`mcp` v2.3.0) and Django ORM running in its own container (`store_mcp`) on port `8080`, exposing the official Server-Sent Events (`/sse`) transport and JSON-RPC dispatch endpoint.
- **Client-Server Architecture (`MCPClient`)**: Django backend integrates with the MCP container via `MCPClient` (`MCP_SERVER_URL=http://mcp:8080`), with transparent, fault-tolerant fallback to local execution for offline development and testing.
- **12 Unified Multi-Tenant Retail & Analytics Tools**:
  1. `get_sales_kpis`: Gross turnover, net sales, taxes, discounts, order count, and AOV.
  2. `get_sales_trajectory`: Continuous daily revenue and invoice count time-series over $N$ days.
  3. `get_top_selling_products`: Ranked products by sales volume and revenue contribution.
  4. `get_payment_method_breakdown`: Tender distribution (Cash, UPI, Card) and percentage share.
  5. `get_hourly_store_traffic`: 24-hour hourly billing velocity and rush-hour identification.
  6. `search_products`: Multi-attribute catalog lookup across barcodes, SKUs, and categories.
  7. `check_inventory`: On-hand stock levels, low-stock warnings, and valuation.
  8. `get_daily_sales_summary`: Real-time gross turnover, net revenue, GST split, and tender distribution.
  9. `lookup_customer`: Customer 360, multi-store loyalty balance, and visit counts.
  10. `get_gst_filing_summary`: Monthly/quarterly GSTR-1 and GSTR-3B statutory tax liability.
  11. `list_stores`: Active physical store directory.
  12. `lookup_order`: Order tracking, customer snapshots, and fulfillment states.
- **Dual AI Copilot Engine**:
  - **Online Mode**: Multi-turn autonomous tool execution loop supporting OpenRouter and OpenAI APIs.
  - **Zero-Key Offline Fallback**: Direct intent routing against live store models when external API keys are omitted.
- **Frontend Retail Copilot Drawer**: Global top navbar sparkles button, quick prompt chips, tool execution transparency disclosure, and rich Markdown tables.
- **AI Settings Hub (`/ai-settings`)**: Provider selection, model picker, client-side masked API key storage, and connection test pings.

### 13. 100-Day Enterprise Retail Demo Seeding (`manage.py seed_demo_store`)
- **Realistic 100-Day Timeline Simulation**: Bootstraps 100 consecutive days of realistic retail enterprise data:
  - 100 daily cash register sessions with float verifications, cash drops, pay-outs, and closing variance audits.
  - Continuous POS transactions generating hundreds of invoices across UPI, Cash, and Card tenders.
  - Full inventory movement lifecycle: Goods Receipt Notes (GRN), POS sales deductions, damage adjustments, and return restocks.
  - Omnichannel home delivery dispatches with OTP verification and Cash on Delivery (COD) settlements.
  - Sourcing matrix with active vendors and sample customer returns/credit notes.
- **CLI Command Usage**:
  ```bash
  # Seed 100 days of demo data for an organization and store
  uv run manage.py seed_demo_store --days 100 --organization-id <ORG_UUID> --store-id <STORE_UUID>

  # Or seed with automatic creation of a default enterprise demo store
  uv run manage.py seed_demo_store --days 100
  ```

---

## 🧭 Frontend Domain Navigation

The application dashboard features an alphabetically organized, scrollable domain navigation sidebar:

- 🪄 **AI & MCP Settings** (`/ai-settings`)
- 📊 **Analytics & BI** (`/analytics`)
- 🪙 **Cash Register** (`/register`)
- 👥 **Customers** (`/customers`)
- 📥 **Data Exchange** (`/data-exchange`)
- 🚚 **Deliveries & Dispatch** (`/deliveries`)
- 🧾 **GST Filing Hub** (`/gst`)
- 📦 **Inventory** (`/inventory`)
- 🧾 **Invoices** (`/invoices`)
- 🛍️ **Orders** (`/orders`)
- 🏢 **Organizations** (`/organizations`)
- 💳 **POS Counter** (`/pos`)
- 🏷️ **Products** (`/products`)
- 🗂️ **Subcategories** (`/subcategories`)
- 🏪 **Stores** (`/stores`)
- 🏭 **Vendors** (`/vendors`)

---

## 🏃 Quick Start Guide

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
# Backend unit tests
cd backend
python manage.py test

# Frontend type check & build
cd frontend
npm run build
npm run lint
```

---

## 🚀 Production Deployment (Self-Hosted Coolify on Ubuntu VPS)

This application is fully productionized with multi-stage Dockerfiles, Gunicorn WSGI, WhiteNoise static asset serving, and Nginx reverse proxying with Gzip compression.

### 1. Architecture Overview

- **Database:** Containerized PostgreSQL 15 with persistent local volume storage (`postgres_data`).
- **Backend:** Python 3.12, Django 6.1 served via Gunicorn (3 workers, 2 threads) with WhiteNoise compressed manifests on internal port `8000`.
- **Dashboard Frontend:** React 19 + Vite compiled into a static bundle and served via `nginx:alpine` with Gzip compression and SPA routing fallback on internal port `80`.
- **Public Website:** Next.js 14 server-rendered portal running on internal port `3000`.
- **Coolify / Traefik:** Orchestrates containers, SSL certificates via Let's Encrypt, and subdomain routing.

### 2. VPS Requirements

- **OS:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (x86_64)
- **Specs:** Minimum 2 vCPU, 4 GB RAM (e.g. DigitalOcean Basic Droplet or Hetzner Cloud CX22/CX32)
- **Network:** Inbound ports `80` (HTTP), `443` (HTTPS), `8000` (Coolify Dashboard), and `22` (SSH) open.

### 3. Step-by-Step Deployment Runbook

#### Step 1: Install Self-Hosted Coolify ($0 Software Cost)
SSH into your clean Ubuntu VPS and run the official open-source installation script:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Once installation completes, navigate in your web browser to:
```
http://<YOUR_VPS_IP>:8000
```
Create your root admin account. *Note: Self-hosted Coolify is 100% free with unlimited servers and zero subscription fees.*

#### Step 2: Add Project from Git Repository
1. In the Coolify dashboard, select **Projects** ➔ **Add New Project**.
2. Click **+ New Resource** ➔ **Docker Compose** ➔ **From Git Repository**.
3. Select your repository (e.g. `kartiksetia/store-app`).
4. Set **Base Directory** to `/`.
5. Set **Docker Compose Location** to:
   ```
   docker/docker-compose.coolify.yml
   ```

#### Step 3: Configure Environment Variables
In the **Environment Variables** tab of your Coolify resource, copy and populate the values from `.env.production.example`:
- `POSTGRES_PASSWORD`: Strong generated database password.
- `SECRET_KEY`: Strong Django secret key (`python -c "import secrets; print(secrets.token_urlsafe(50))"`).
- `ALLOWED_HOSTS`: `api.<YOUR_VPS_IP>.sslip.io,app.<YOUR_VPS_IP>.sslip.io,store.<YOUR_VPS_IP>.sslip.io`
- `CORS_ALLOWED_ORIGINS`: `https://app.<YOUR_VPS_IP>.sslip.io,https://store.<YOUR_VPS_IP>.sslip.io`
- `CSRF_TRUSTED_ORIGINS`: `https://api.<YOUR_VPS_IP>.sslip.io,https://app.<YOUR_VPS_IP>.sslip.io,https://store.<YOUR_VPS_IP>.sslip.io`
- `VITE_API_URL`: `https://api.<YOUR_VPS_IP>.sslip.io`
- `NEXT_PUBLIC_API_URL`: `https://api.<YOUR_VPS_IP>.sslip.io`
- `NEXT_PUBLIC_DASHBOARD_URL`: `https://app.<YOUR_VPS_IP>.sslip.io`

#### Step 4: Configure Domains & SSL (Free via sslip.io)
Under each service in Coolify, assign its public URL:
- **`website` service (port 3000):** `https://store.<YOUR_VPS_IP>.sslip.io`
- **`frontend` service (port 80):** `https://app.<YOUR_VPS_IP>.sslip.io`
- **`backend` service (port 8000):** `https://api.<YOUR_VPS_IP>.sslip.io`
- **`mcp` service (port 8080):** `https://mcp.<YOUR_VPS_IP>.sslip.io` (renders the interactive web portal on `/`, JSON health check on `/health`, and SSE AI gateway on `/sse` for Cursor, Claude Desktop, Antigravity)

*`sslip.io` is a free DNS resolution service that automatically routes subdomains directly to your VPS IP without manual DNS records.*

#### Step 5: Deploy
Click **Deploy**. Coolify will:
1. Pull images and build the frontend, website, and backend production containers.
2. Spin up PostgreSQL and verify health check.
3. Automatically run database migrations via `docker/entrypoint.sh`.
4. Run WhiteNoise `collectstatic --noinput` for Django admin and static files.
5. Provision Let's Encrypt SSL certificates automatically and launch your applications.

