# Store App — Model Context Protocol (MCP) Server

## Overview
This directory houses the **Model Context Protocol (MCP)** server for **Store App**. It serves as the standard AI-native protocol interface exposing the retail platform's inventory, catalog, POS analytics, supplier procurement, and customer operations to large language models (LLMs) and autonomous AI coding/agentic assistants (such as Antigravity, Claude Desktop, and in-house retail copilots).

---

## 🎯 Core Objectives
1. **Tool Provider**: Expose granular, safe, and parameterized retail functions (e.g. checking stock, generating barcode lookups, drafting stock transfer orders) as standardized MCP tools.
2. **Context & Resource Provider**: Serve live structured retail resources (e.g. daily sales summaries, store inventory snapshots, low-stock alerts) directly into LLM prompts.
3. **Workflow Automation & Prompts**: Provide predefined AI-driven workflows for store managers, such as automated reorder calculations, vendor price audits, and discrepancy triage.

---

## 🏛️ Architecture & Protocol Flow

```text
┌──────────────────────────┐          MCP Protocol (JSON-RPC)          ┌──────────────────────────┐
│  AI Agent / LLM Client   │ ◄───────────────────────────────────────► │   Store App MCP Server   │
│ (Antigravity / Desktop)  │                                           │       (FastMCP)          │
└──────────────────────────┘                                           └────────────┬─────────────┘
                                                                                    │
                                                                   Authenticated Internal API Calls
                                                                                    │
                                                                                    ▼
                                                                       ┌──────────────────────────┐
                                                                       │  Store App Django Core   │
                                                                       │ (Database & REST Engine) │
                                                                       └──────────────────────────┘
```

---

## 🛠️ Planned Tool Taxonomy

### 1. Inventory & Stock Movement Tools
- `get_store_inventory(store_id, sku_or_barcode=None, low_stock_only=False)`: Retrieve live store stock levels, reorder thresholds, and location quantities.
- `audit_stock_movement(store_id, product_id, limit=20)`: Inspect historical goods receipts, sales reductions, and manual adjustments.
- `create_stock_adjustment(store_id, product_id, quantity_delta, reason, notes)`: Record audited operational stock increments or write-offs.

### 2. Product Catalog & Sourcing Tools
- `search_master_catalog(query, barcode=None)`: Fast dual-barcode and text lookup across the organization's product register.
- `get_vendor_pricing_matrix(product_id)`: Compare supplier agreed unit costs, minimum order quantities (MOQ), and delivery lead times.
- `verify_global_catalogue_item(barcode)`: Query the global GS1/Indian FMCG register to auto-fill brand, category, HSN code, and GST rates.

### 3. POS & Cashier Analytics Tools
- `get_daily_sales_summary(store_id, date=None)`: Retrieve total counter revenue, invoice counts, payment method breakdowns (Cash, UPI, Card), and average basket sizes.
- `list_top_selling_products(store_id, date_range="last_7_days", limit=10)`: Identify high-velocity products and run-rates.

### 4. Customer & Loyalty Tools
- `lookup_customer_by_phone(phone_number)`: Fast customer identification returning store visit counts, lifetime revenue, and redeemable loyalty points.
- `get_customer_purchase_history(customer_id, limit=10)`: Retrieve past invoice receipts and product breakdown.

### 5. Warehouse & Replenishment Tools (Future Work)
- `calculate_reorder_quantities(store_id)`: Compute recommended replenishment quantities based on current stock, sales run-rate, and supplier lead time.
- `draft_stock_transfer_order(source_warehouse_id, destination_store_id, line_items)`: Create a draft replenishment request for manager sign-off.

---

## 🔒 Security & Multi-Tenant Governance
- **Tenant Scoping**: All MCP requests must authenticate via an organization-scoped API key (`X-StoreApp-API-Key`). Agents cannot query data across tenant boundaries.
- **Role-Based Tool Permissions (RBAC)**: Tools are partitioned into permission tiers (e.g., `inventory:read`, `inventory:write`, `finance:read`).
- **Destructive Operation Gates**: Any mutation action (such as manual stock write-offs or order cancellations) requires explicit Human-in-the-Loop (HITL) approval before execution.

---

## 🏗️ Technical Stack
- **Server Runtime**: Python `FastMCP` (recommended for seamless interoperability with the Django backend ecosystem) or TypeScript `@modelcontextprotocol/sdk`.
- **Transport**: Standard Input/Output (`stdio`) for local agent runners; Server-Sent Events (`SSE`) for networked/remote deployment.
- **Validation**: Strict schema definitions using Pydantic / Zod for parameter typing and clear error reporting.

---

## 📋 Implementation Checklist

### Phase 1: Foundation & Transport
- [ ] Initialize MCP server project structure with FastMCP runtime.
- [ ] Implement API key authentication and tenant organization resolution middleware.
- [ ] Establish stdio transport runner and health check.

### Phase 2: Core Read Tools
- [ ] Implement `get_store_inventory` and `audit_stock_movement`.
- [ ] Implement `search_master_catalog` and `verify_global_catalogue_item`.
- [ ] Implement `get_daily_sales_summary` and `lookup_customer_by_phone`.

### Phase 3: Mutating Tools & Safety Gates
- [ ] Implement `create_stock_adjustment` with confirmation prompts.
- [ ] Implement `draft_purchase_order` / `draft_stock_transfer`.
- [ ] Integrate with Antigravity / Claude Desktop configuration files.

### Phase 4: Guided Prompts & Intelligence
- [ ] Add `daily_store_opening_briefing` prompt template.
- [ ] Add `inventory_replenishment_advisor` prompt template.
