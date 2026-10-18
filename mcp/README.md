# Store App — Model Context Protocol (MCP) Server & Retail Copilot

## Overview
This module houses the **Model Context Protocol (MCP)** server and **Retail Copilot Assistant Engine** for **Store App**. It serves as the standard AI-native protocol interface exposing the retail platform's inventory, master catalog, POS revenue analytics, customer loyalty, GST compliance, and orders to Large Language Models (LLMs) and autonomous AI coding/agentic assistants (such as Antigravity, Claude Desktop, and in-house retail copilots).

---

## 🎯 Implemented Architecture & Protocol Flow

```text
┌─────────────────────────────────┐
│     AI Copilot / MCP Client     │
│  (React Drawer / External IDE)  │
└────────────────┬────────────────┘
                 │
                 │ JSON-RPC 2.0 or REST Chat
                 ▼
┌─────────────────────────────────┐
│     Store App MCP Server        │
│    (backend/apps/mcp/)          │
├─────────────────────────────────┤
│ • MCPJsonRpcView (/api/mcp/rpc/)│
│ • AICopilotEngine (/mcp/chat/)  │
│ • Tool Registry (7 live tools)  │
│ • Zero-Key Offline Router       │
└────────────────┬────────────────┘
                 │
                 │ Direct High-Speed Querying
                 ▼
┌─────────────────────────────────┐
│      PostgreSQL Database        │
│   (Centralized `db` Models)     │
└─────────────────────────────────┘
```

---

## 🛠️ Implemented MCP Retail Tools

All tools are registered in `backend/apps/mcp/tools.py` via `MCPToolRegistry` and exposed via both JSON-RPC 2.0 (`POST /api/mcp/rpc/`) and REST (`GET /api/mcp/tools/`):

1. **`search_products(query, category=None, limit=10)`**:
   - Searches master catalog by name, universal EAN-13 barcode, internal sticker barcode, or SKU.
   - Returns store pricing, MRP, and stock availability.
2. **`check_inventory(store_id=None, low_stock_only=False, product_query=None, limit=20)`**:
   - Live store inventory levels, low-stock reorder thresholds, batch numbers, and stock valuation.
3. **`get_daily_sales_summary(date_str=None, store_id=None)`**:
   - Real-time gross turnover, net subtotal, discount, AOV, CGST/SGST/IGST breakdown, and tender payment breakdown (Cash, Card, UPI, Store Credit).
4. **`lookup_customer(phone)`**:
   - Customer 360 profile, multi-store loyalty reward points balance, visit counts, and recent invoices.
5. **`get_gst_filing_summary(period=None, store_id=None)`**:
   - Monthly and quarterly GSTR-1 outward taxable supplies and GSTR-3B tax liability summaries.
6. **`list_stores(active_only=True)`**:
   - Active physical store directory, store codes, phone numbers, and cities.
7. **`lookup_order(order_number=None, phone=None)`**:
   - Omnichannel customer orders, fulfillment status, and line items.

---

## 🤖 Dual AI Proxy & Copilot Engine (`AICopilotEngine`)

Located in `backend/apps/mcp/services.py`:
- **Online Autonomous Multi-Turn Mode**:
  - Connects to **OpenRouter API** (`https://openrouter.ai/api/v1/chat/completions`) or direct **OpenAI API** (`https://api.openai.com/v1/chat/completions`).
  - Converts registered MCP tools into OpenAI function calling schemas.
  - Autonomously executes tool calls against Django models and feeds structured outputs back to the model for conversational synthesis.
- **Offline Zero-Key Intent Router**:
  - Automatically activates when external API keys are omitted.
  - Evaluates retail user intent (sales, inventory, low stock, GST, customer lookup, orders) and directly queries Django models.
  - Returns real-time ERP data formatted in clean GitHub-flavored Markdown.

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/mcp/rpc/` | `POST` | Standard JSON-RPC 2.0 endpoint (`tools/list`, `tools/call`, `ping`) |
| `/api/mcp/tools/` | `GET` | REST endpoint listing all registered tools and parameter schemas |
| `/api/mcp/chat/` | `POST` | Natural language Retail Copilot assistant endpoint |
| `/api/mcp/test-connection/` | `POST` | Provider and model connectivity ping test endpoint |

---

## 💻 Frontend UI Integration

1. **AI Copilot Drawer (`frontend/src/features/copilot/components/CopilotDrawer.tsx`)**:
   - Top navbar sparkles action button.
   - Quick retail prompt suggestion chips.
   - Tool execution transparency pills showing arguments and execution status.
   - Rich Markdown renderer supporting tables, code, and Indian Rupee (₹) amounts.
2. **AI & MCP Settings Page (`/ai-settings`)**:
   - Provider picker (OpenRouter, OpenAI, Custom/Ollama).
   - Popular model selectors (`gpt-4o-mini`, `gpt-4o`, `claude-3.5-sonnet`, `llama-3.3-70b`).
   - Client-side masked API key management in `localStorage`.
   - Live connection test ping with model sample preview.
   - Active MCP tools catalog inspection.
