# Store App — Mantine React Frontend

The Store App frontend is a high-speed, enterprise-grade Single Page Application (SPA) designed for retail cashiers, store operators, and headquarters executives.

---

## 🛠️ Frontend Tech Stack

- **Framework:** React 19 + TypeScript
- **Component Library:** Mantine v9 (`@mantine/core`, `@mantine/hooks`, `@mantine/form`)
- **Icons:** Tabler Icons (`@tabler/icons-react`)
- **Routing:** React Router v7 (`react-router-dom`)
- **State Management:** Zustand (for lightweight global state & UI drawers)
- **Data Fetching & Cache:** TanStack React Query v5 + Axios
- **Build Tool:** Vite + Oxlint

---

## 🧭 Application Modules & Routing

All operational pages are housed under the authenticated `DashboardLayout` shell with an alphabetically organized domain sidebar:

| Route | Feature Module | Primary Capabilities |
|---|---|---|
| `/ai-settings` | `features/copilot/` | AI provider configuration, model picker, masked API keys, live test pings, MCP tool catalog |
| `/analytics` | `features/analytics/` | Real-time sales turnover, hourly velocity, top products, payment tender splits |
| `/register` | `features/register/` | Shift opening/closing, float verification, denominations counter, Z-reports |
| `/customers` | `features/customers/` | Customer 360 profile, purchase history, store-scoped loyalty ledger, fast lookup |
| `/data-exchange` | `features/data-exchange/` | Bulk CSV/Excel imports, dry-run schema validation, template downloads, full data exports |
| `/deliveries` | `features/delivery/` | Fleet dispatch queue, driver assignment, customer OTP verification, COD reconciliation |
| `/gst` | `features/gst/` | GSTR-1, GSTR-3B tax liability, filing periods ledger, statutory GSTN JSON export |
| `/inventory` | `features/inventory/` | Live stock levels, Goods Receipt Note (GRN) inwarding, operational stock adjustments |
| `/invoices` | `features/invoice/` | Historical invoices, tax breakdowns, receipt reprint, payment tracking |
| `/orders` | `features/orders/` | Omnichannel order queue, order status pipeline, direct tax invoice generation |
| `/organizations` | `features/organizations/` | Multi-tenant organization settings, company configuration |
| `/pos` | `features/pos/` | Rapid counter checkout, barcode scanner listener, loyalty points redemption, UPI QR |
| `/products` | `features/products/` | 4-tier master catalog, universal EAN-13 barcodes, thermal sticker codes, global adoption |
| `/subcategories` | `features/products/` | Tenant-scoped product classifications |
| `/stores` | `features/stores/` | Multi-store branch directory, active store switcher |
| `/vendors` | `features/vendors/` | Supplier directory, 15-digit GSTIN validation, vendor-product agreed pricing |

---

## 🪄 AI Copilot Assistant

- **Drawer Trigger:** Global sparkles button in the top navbar header right beside "Counter POS".
- **Store Scoping:** Allows narrowing retail analysis to the active store or spanning all physical locations.
- **Quick Retail Prompts:** One-click prompt chips for turnover, low stock, GST liability, customer 360, and orders.
- **Tool Transparency:** Collapsible disclosure showing invoked MCP tools, arguments, and execution status.
- **Markdown Rendering:** Zero-dependency, rich markdown rendering for headings, tables, code, and Indian Rupee (₹) amounts.

---

## 🏃 Development Commands

```bash
# Start development server
npm run dev

# TypeScript type check & production build
npm run build

# Run Oxlint
npm run lint
```
