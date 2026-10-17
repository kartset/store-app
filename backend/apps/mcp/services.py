import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings

from .tools import MCPToolRegistry

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are StoreCraft AI Copilot, the intelligent retail assistant for StoreCraft Retail ERP.
You assist store managers, cashiers, and accountants by utilizing live retail tools to inspect stock levels, review daily sales, check GST tax returns, look up customer loyalty, and track orders.

Guidelines:
1. Always base your answers on actual data returned by the tools.
2. Format currency amounts in Indian Rupees (₹X,XX,XXX.XX).
3. Be concise, polite, professional, and use clear markdown formatting (tables, bullet points, bold figures).
4. If a tool returns no records, clearly state that no matching data was found in the system.
5. If asked about today's sales, inventory, or GST, proactively invoke the corresponding MCP tool."""


class AICopilotEngine:
    """
    Orchestrates LLM completions with the StoreCraft MCP Tool Registry.
    Supports OpenAI and OpenRouter with multi-turn autonomous tool execution.
    """

    @classmethod
    def get_openai_tools(cls) -> list[dict[str, Any]]:
        tools = []
        for t in MCPToolRegistry.list_tools():
            tools.append({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["inputSchema"],
                },
            })
        return tools

    @classmethod
    def execute_chat(
        cls,
        messages: list[dict[str, Any]],
        provider: str = "openrouter",
        model: str | None = None,
        api_key: str | None = None,
        store_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes a conversational turn with tool-calling loop.
        """
        # Resolve API Key
        key = api_key or os.environ.get("OPENROUTER_API_KEY") or getattr(settings, "OPENROUTER_API_KEY", "")
        if provider == "openai":
            key = api_key or os.environ.get("OPENAI_API_KEY") or getattr(settings, "OPENAI_API_KEY", "")

        # Default Models
        if not model:
            model = "openai/gpt-4o-mini" if provider == "openrouter" else "gpt-4o-mini"

        # If no API key is present, execute in offline/direct tool execution mode
        if not key:
            return cls._execute_offline_intent(messages, store_id, provider=provider, model=model)

        endpoint = "https://openrouter.ai/api/v1/chat/completions"
        if provider == "openai":
            endpoint = "https://api.openai.com/v1/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key.strip()}",
        }
        if provider == "openrouter":
            headers["HTTP-Referer"] = "https://storecraft.app"
            headers["X-Title"] = "StoreCraft Retail ERP"

        # Build full message history with system prompt
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in messages:
            if m.get("role") in ["user", "assistant", "system", "tool"]:
                formatted_messages.append(m)

        tools = cls.get_openai_tools()
        executed_tools = []

        try:
            # Round 1: Ask model with tools
            payload = {
                "model": model,
                "messages": formatted_messages,
                "tools": tools,
                "tool_choice": "auto",
            }
            resp_data = cls._send_request(endpoint, headers, payload)
            choice = resp_data.get("choices", [{}])[0]
            message = choice.get("message", {})

            # Check for tool calls
            tool_calls = message.get("tool_calls", [])
            if tool_calls:
                formatted_messages.append(message)

                for tc in tool_calls:
                    fn_name = tc.get("function", {}).get("name")
                    fn_args_raw = tc.get("function", {}).get("arguments", "{}")
                    try:
                        fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else fn_args_raw
                    except (json.JSONDecodeError, TypeError):
                        fn_args = {}

                    # Inject store_id if tool supports it and user provided store_id
                    if store_id and "store_id" not in fn_args:
                        fn_args["store_id"] = store_id

                    tool_result = MCPToolRegistry.call_tool(fn_name, fn_args)
                    result_text = tool_result["content"][0]["text"] if tool_result.get("content") else ""

                    executed_tools.append({
                        "tool": fn_name,
                        "arguments": fn_args,
                        "status": "error" if tool_result.get("isError") else "success",
                        "output_summary": result_text[:300] + ("..." if len(result_text) > 300 else ""),
                    })

                    formatted_messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": fn_name,
                        "content": result_text,
                    })

                # Round 2: Feed tool outputs back to LLM for final natural language synthesis
                round2_payload = {
                    "model": model,
                    "messages": formatted_messages,
                }
                round2_data = cls._send_request(endpoint, headers, round2_payload)
                final_choice = round2_data.get("choices", [{}])[0]
                final_message = final_choice.get("message", {})

                return {
                    "message": final_message,
                    "executed_tools": executed_tools,
                    "provider": provider,
                    "model": model,
                    "mode": "online",
                }

            # No tool calls needed
            return {
                "message": message,
                "executed_tools": [],
                "provider": provider,
                "model": model,
                "mode": "online",
            }

        except Exception as e:  # noqa: BLE001
            logger.warning(f"AI API request failed: {e}. Falling back to offline tool intent handler.")
            return cls._execute_offline_intent(messages, store_id, fallback_reason=str(e), provider=provider, model=model)

    @classmethod
    def _send_request(cls, endpoint: str, headers: dict[str, str], payload: dict[str, Any]) -> dict[str, Any]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)

    @classmethod
    def _execute_offline_intent(
        cls,
        messages: list[dict[str, Any]],
        store_id: str | None = None,
        fallback_reason: str | None = None,
        provider: str = "offline",
        model: str = "storecraft-mcp-engine",
    ) -> dict[str, Any]:
        """
        Direct keyword/intent router when external AI API keys are not supplied.
        Directly executes StoreCraft MCP tools against the database and formats
        a professional markdown response with live data.
        """
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "").lower()
                break

        executed_tools = []
        response_text = ""

        # Intent 1: Sales / Revenue / Turnover
        if any(w in last_user_msg for w in ["sale", "revenue", "turnover", "today", "bill", "collection", "earnings"]):
            tool_res = MCPToolRegistry.call_tool("get_daily_sales_summary", {"store_id": store_id})
            data = tool_res.get("structured_data", {})
            executed_tools.append({
                "tool": "get_daily_sales_summary",
                "arguments": {"store_id": store_id},
                "status": "success",
                "output_summary": f"Turnover: ₹{data.get('gross_turnover', 0)}, Invoices: {data.get('total_invoices', 0)}",
            })
            tenders = data.get("payment_tenders", {})
            tenders_str = ", ".join([f"**{k}**: ₹{v:,.2f}" for k, v in tenders.items()]) or "No tender payments recorded yet today."

            response_text = f"""### 📊 Daily Sales & Revenue Summary ({data.get('date')})

- **Store Filter**: {data.get('store_filter')}
- **Total Invoices**: {data.get('total_invoices')}
- **Gross Turnover**: **₹{data.get('gross_turnover', 0):,.2f}**
- **Net Subtotal**: ₹{data.get('net_subtotal', 0):,.2f}
- **Discounts Given**: ₹{data.get('discounts_given', 0):,.2f}
- **Average Order Value (AOV)**: ₹{data.get('average_order_value', 0):,.2f}

#### Tax Collection Breakdown
- **CGST**: ₹{data.get('tax_breakup', {}).get('cgst', 0):,.2f}
- **SGST**: ₹{data.get('tax_breakup', {}).get('sgst', 0):,.2f}
- **IGST**: ₹{data.get('tax_breakup', {}).get('igst', 0):,.2f}
- **Total GST**: **₹{data.get('tax_breakup', {}).get('total_gst', 0):,.2f}**

#### Payment Tender Breakdown
{tenders_str}
"""

        # Intent 2: Inventory / Low Stock / Restock
        elif any(w in last_user_msg for w in ["stock", "inventory", "low stock", "reorder", "quantity", "warehouse", "items remaining"]):
            is_low = "low" in last_user_msg or "reorder" in last_user_msg
            tool_res = MCPToolRegistry.call_tool("check_inventory", {"store_id": store_id, "low_stock_only": is_low, "limit": 10})
            data = tool_res.get("structured_data", [])
            executed_tools.append({
                "tool": "check_inventory",
                "arguments": {"store_id": store_id, "low_stock_only": is_low},
                "status": "success",
                "output_summary": f"Found {len(data)} inventory records",
            })

            if not data:
                response_text = "### 📦 Inventory Status\n\nAll inventory stock levels are healthy! No items are currently below low-stock reorder thresholds."
            else:
                rows = "\n".join([
                    f"| {item['product_name']} | `{item['barcode']}` | {item['stock_quantity']} | {item['low_stock_threshold']} | ₹{item['selling_price']:,.2f} | {'⚠️ LOW' if item['is_low_stock'] else '✅ OK'} |"
                    for item in data
                ])
                response_text = f"""### 📦 Inventory Stock Overview {'(Low Stock Alerts)' if is_low else ''}

| Product Name | Barcode | Stock Qty | Low Threshold | Price | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
{rows}

*Tip: You can inward incoming stock shipments directly using Goods Receipt Notes (GRN) in the `/inventory` module.*
"""

        # Intent 3: GST / Tax / GSTR-1 / GSTR-3B
        elif any(w in last_user_msg for w in ["gst", "tax", "gstr", "hsn", "liability", "filing"]):
            tool_res = MCPToolRegistry.call_tool("get_gst_filing_summary", {"store_id": store_id})
            data = tool_res.get("structured_data", {})
            executed_tools.append({
                "tool": "get_gst_filing_summary",
                "arguments": {"store_id": store_id},
                "status": "success",
                "output_summary": f"Tax Liability: ₹{data.get('total_tax_liability', 0)}, Period: {data.get('period_key')}",
            })

            response_text = f"""### 🧾 GST Compliance & Tax Return Summary ({data.get('period_key')})

- **Store**: {data.get('store_name')} (GSTIN: `{data.get('store_gstin')}`)
- **Gross Turnover**: **₹{data.get('gross_turnover', 0):,.2f}**
- **Net Taxable Value**: ₹{data.get('net_taxable_value', 0):,.2f}
- **Central Tax (CGST)**: ₹{data.get('cgst_amount', 0):,.2f}
- **State Tax (SGST)**: ₹{data.get('sgst_amount', 0):,.2f}
- **Integrated Tax (IGST)**: ₹{data.get('igst_amount', 0):,.2f}
- **Total Tax Liability**: **₹{data.get('total_tax_liability', 0):,.2f}**

#### Statutory Breakdown Counts
- **Total Invoices**: {data.get('invoices_count')}
- **B2B Registered Invoices**: {data.get('b2b_invoices_count')}
- **B2CS Retail Entries**: {data.get('b2cs_entries_count')}
- **Harmonized HSN Codes**: {data.get('hsn_codes_count')}

*You can generate persistent snapshots and download the government-ready GSTN JSON offline file in `/gst`.*
"""

        # Intent 4: Customer Lookup
        elif any(w in last_user_msg for w in ["customer", "loyalty", "points", "phone", "profile"]):
            # Extract digits from query
            digits = "".join(filter(str.isdigit, last_user_msg))
            phone = digits if len(digits) >= 10 else "9876543210"
            tool_res = MCPToolRegistry.call_tool("lookup_customer", {"phone": phone})
            data = tool_res.get("structured_data", {})
            executed_tools.append({
                "tool": "lookup_customer",
                "arguments": {"phone": phone},
                "status": "success",
                "output_summary": data.get("name", "Search executed"),
            })

            if not data.get("found"):
                response_text = f"### 👤 Customer Lookup\n\n{data.get('message', 'Customer not found.')} You can register new walk-in customers instantly from the POS counter terminal."
            else:
                response_text = f"""### 👤 Customer Profile: {data.get('name')}

- **Mobile**: `{data.get('mobile_number')}`
- **Customer Type**: {data.get('customer_type')}
- **Total Loyalty Points**: **{data.get('total_loyalty_points')} pts**
- **Total Store Visits**: {data.get('total_store_visits')} visits
- **GSTIN**: {data.get('gstin')}
"""

        # Intent 5: Stores
        elif any(w in last_user_msg for w in ["store", "branch", "location", "outlet"]):
            tool_res = MCPToolRegistry.call_tool("list_stores", {"active_only": True})
            data = tool_res.get("structured_data", [])
            executed_tools.append({
                "tool": "list_stores",
                "arguments": {"active_only": True},
                "status": "success",
                "output_summary": f"Found {len(data)} stores",
            })
            rows = "\n".join([f"- **{s['name']}** (GST: `{s['gst_number']}`) — {s['address']}" for s in data])
            response_text = f"""### 🏬 Active Retail Stores ({len(data)})\n\n{rows}"""

        # Intent 6: Search Products
        elif any(w in last_user_msg for w in ["product", "find", "search", "price", "mrp", "item", "barcode"]):
            words = last_user_msg.split()
            query = words[-1] if words else "Milk"
            tool_res = MCPToolRegistry.call_tool("search_products", {"query": query, "limit": 5})
            data = tool_res.get("structured_data", [])
            executed_tools.append({
                "tool": "search_products",
                "arguments": {"query": query},
                "status": "success",
                "output_summary": f"Found {len(data)} products",
            })
            if not data:
                response_text = f"No products found matching '{query}'. Try searching by product title, brand, or barcode."
            else:
                rows = "\n".join([
                    f"| {p['name']} | `{p['barcode']}` | ₹{p['mrp']:,.2f} | {p['tax_slab']}% | {p['category']} |"
                    for p in data
                ])
                response_text = f"""### 🔍 Product Search Results for '{query}'

| Product | Barcode | MRP | Tax Slab | Category |
| :--- | :--- | :--- | :--- | :--- |
{rows}
"""

        # Fallback General Response
        else:
            response_text = """### 🤖 StoreCraft AI Retail Copilot

I can help you with live retail intelligence across your stores:
- **Sales & Revenue**: *"What was our total turnover today?"*
- **Inventory & Reordering**: *"Which products are low in stock?"*
- **GST & Tax Compliance**: *"Show our current month GSTR-1 and tax liability"*
- **Customer 360 & Loyalty**: *"Look up customer 9876543210"*
- **Catalog & Pricing**: *"Find product Amul Butter"*

*Note: You can configure an OpenAI or OpenRouter API key in `/ai-settings` to enable natural language multi-step reasoning.*"""

        note = ""
        if fallback_reason:
            note = f"\n\n> *Note: Connected AI provider returned an issue (`{fallback_reason}`). Switched to local MCP tools to provide real-time ERP data.*"

        return {
            "message": {
                "role": "assistant",
                "content": response_text + note,
            },
            "executed_tools": executed_tools,
            "provider": provider,
            "model": model,
            "mode": "offline",
        }
