"""StoreCraft MCP Service Web Landing Portal & Documentation.

Renders an interactive, responsive HTML status page when visiting the MCP microservice
root URL (GET /) in a web browser.
"""

from typing import Any


def get_tools_metadata() -> dict[str, list[dict[str, Any]]]:
    """Return catalog of available tools grouped by domain."""
    return {
        "analytics": [
            {
                "name": "get_sales_kpis",
                "tag": "BI / Financial",
                "desc": "Calculates gross revenue, net sales, invoice volume, average order value (AOV), tax total, and discounts for a specified date range.",
                "params": ["organization_id", "store_id", "start_date", "end_date"],
            },
            {
                "name": "get_sales_trajectory",
                "tag": "BI / Trend",
                "desc": "Aggregates revenue and invoice volume grouped by day or month to visualize sales trajectories and growth pacing.",
                "params": ["organization_id", "store_id", "start_date", "end_date", "group_by"],
            },
            {
                "name": "get_top_selling_products",
                "tag": "Inventory / Demand",
                "desc": "Identifies highest-performing products ranked by total quantity sold or net revenue generated.",
                "params": ["organization_id", "store_id", "limit", "start_date", "end_date"],
            },
            {
                "name": "get_payment_method_breakdown",
                "tag": "Treasury / Settlement",
                "desc": "Summarizes transaction volume and total revenue collected across Cash, UPI QR, Card, and Store Credit tenders.",
                "params": ["organization_id", "store_id", "start_date", "end_date"],
            },
            {
                "name": "get_hourly_store_traffic",
                "tag": "Operations / Footfall",
                "desc": "Maps customer footfall and checkout velocity across store operating hours (00:00 - 23:00) to identify peak rush windows.",
                "params": ["organization_id", "store_id", "target_date"],
            },
        ],
        "retail": [
            {
                "name": "search_products",
                "tag": "Catalog",
                "desc": "High-speed lookup across product title, universal EAN-13 barcode, internal sticker barcode, or SKU.",
                "params": ["organization_id", "query", "limit"],
            },
            {
                "name": "check_inventory",
                "tag": "Stock",
                "desc": "Inspect real-time on-hand stock balances, low-stock thresholds, and replenishment alert statuses across stores.",
                "params": ["organization_id", "store_id", "product_id", "low_stock_only"],
            },
            {
                "name": "get_daily_sales_summary",
                "tag": "POS Shift",
                "desc": "Retrieves shift-level gross revenue, collected cash drawer totals, tax collections, and total completed receipts.",
                "params": ["organization_id", "store_id", "date"],
            },
            {
                "name": "lookup_customer",
                "tag": "CRM / Loyalty",
                "desc": "Sub-50ms phone lookup returning Customer 360 profile, loyalty points balance, and store credit (khata) limits.",
                "params": ["organization_id", "phone", "customer_id"],
            },
            {
                "name": "get_gst_filing_summary",
                "tag": "Statutory Tax",
                "desc": "Generates B2B, B2CL, B2CS, and HSN tax summaries for statutory GSTR-1 and GSTR-3B monthly return filings.",
                "params": ["organization_id", "period", "financial_year"],
            },
            {
                "name": "list_stores",
                "tag": "Hierarchy",
                "desc": "Lists active retail branch stores, operational addresses, GSTIN tax registrations, and contact configurations.",
                "params": ["organization_id"],
            },
            {
                "name": "lookup_order",
                "tag": "Fulfillment",
                "desc": "Inspects omnichannel customer orders across POS walk-in, phone orders, dispatch driver assignment, and OTP status.",
                "params": ["organization_id", "order_id"],
            },
        ],
    }


def render_landing_page(host: str, is_secure: bool = True) -> str:
    """Generate the modern, dark-mode StoreCraft MCP status and documentation portal."""
    scheme = "https" if is_secure else "http"
    base_url = f"{scheme}://{host}"
    catalog = get_tools_metadata()
    analytics_tools = catalog["analytics"]
    retail_tools = catalog["retail"]
    total_tools = len(analytics_tools) + len(retail_tools)

    def render_tool_cards(tools: list[dict[str, Any]], accent_color: str) -> str:
        cards = []
        for t in tools:
            params_html = " ".join(
                f'<span class="param-tag">{p}</span>' for p in t["params"]
            )
            cards.append(f"""
            <div class="tool-card">
                <div class="tool-header">
                    <span class="tool-name">{t['name']}</span>
                    <span class="tool-badge" style="background: {accent_color}22; color: {accent_color}; border: 1px solid {accent_color}44;">{t['tag']}</span>
                </div>
                <p class="tool-desc">{t['desc']}</p>
                <div class="tool-params">
                    <span class="params-label">Parameters:</span>
                    {params_html}
                </div>
            </div>
            """)
        return "\n".join(cards)

    analytics_html = render_tool_cards(analytics_tools, "#38bdf8")
    retail_html = render_tool_cards(retail_tools, "#34d399")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StoreCraft MCP Service — AI Context Gateway</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%22><text y=%2226%22 font-size=%2228%22>⚡</text></svg>">
    <style>
        :root {{
            --bg: #090d16;
            --surface: #111827;
            --surface-hover: #1f2937;
            --border: #1f293d;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --emerald: #10b981;
            --blue: #38bdf8;
            --indigo: #6366f1;
            --amber: #f59e0b;
        }}
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            background-color: var(--bg);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            padding: 32px 16px;
        }}
        .container {{
            max-width: 1100px;
            margin: 0 auto;
        }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 32px;
            flex-wrap: wrap;
            gap: 16px;
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .brand-icon {{
            background: linear-gradient(135deg, #3b82f6, #10b981);
            width: 42px;
            height: 42px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
        }}
        .brand-text h1 {{
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        .brand-text p {{
            font-size: 13px;
            color: var(--text-muted);
        }}
        .status-pill {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            background: rgba(16, 185, 129, 0.12);
            color: #34d399;
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
        }}
        .pulse {{
            width: 8px;
            height: 8px;
            background-color: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 8px #10b981;
        }}
        .hero {{
            background: linear-gradient(180deg, rgba(31, 41, 55, 0.4) 0%, rgba(17, 24, 39, 0.6) 100%);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 36px;
            backdrop-filter: blur(12px);
        }}
        .hero h2 {{
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 12px;
            background: linear-gradient(90deg, #ffffff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .hero p {{
            font-size: 15px;
            color: #cbd5e1;
            max-width: 800px;
            margin-bottom: 24px;
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }}
        .stat-card {{
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
        }}
        .stat-val {{
            font-size: 28px;
            font-weight: 800;
            color: #ffffff;
        }}
        .stat-lbl {{
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .section-title {{
            font-size: 18px;
            font-weight: 700;
            margin: 32px 0 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .endpoints-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }}
        .endpoint-card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }}
        .endpoint-meta {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }}
        .http-method {{
            font-size: 11px;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 4px;
            background: #2563eb;
            color: #ffffff;
        }}
        .http-method.get {{
            background: #0284c7;
        }}
        .http-method.post {{
            background: #16a34a;
        }}
        .endpoint-url {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            color: #e2e8f0;
            background: #090d16;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #1e293b;
            margin-bottom: 8px;
            word-break: break-all;
        }}
        .endpoint-desc {{
            font-size: 13px;
            color: var(--text-muted);
        }}
        .tools-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 16px;
        }}
        .tool-card {{
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            transition: transform 0.15s ease, border-color 0.15s ease;
        }}
        .tool-card:hover {{
            transform: translateY(-2px);
            border-color: #334155;
            background: var(--surface-hover);
        }}
        .tool-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }}
        .tool-name {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14px;
            font-weight: 700;
            color: #f8fafc;
        }}
        .tool-badge {{
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 9999px;
        }}
        .tool-desc {{
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 12px;
            line-height: 1.5;
        }}
        .tool-params {{
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
        }}
        .params-label {{
            font-size: 11px;
            color: #64748b;
            font-weight: 600;
        }}
        .param-tag {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
            background: #1e293b;
            color: #94a3b8;
            padding: 2px 6px;
            border-radius: 4px;
        }}
        .config-box {{
            background: #090d16;
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 20px;
            margin-top: 16px;
        }}
        .config-box pre {{
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            color: #38bdf8;
            overflow-x: auto;
            line-height: 1.5;
        }}
        footer {{
            margin-top: 64px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            text-align: center;
            font-size: 13px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <div class="brand-icon">⚡</div>
                <div class="brand-text">
                    <h1>StoreCraft MCP Service</h1>
                    <p>Model Context Protocol Server for Enterprise Retail AI</p>
                </div>
            </div>
            <div class="status-pill">
                <span class="pulse"></span>
                <span>Operational (port 8080)</span>
            </div>
        </header>

        <section class="hero">
            <h2>Retail Intelligence & Context Gateway</h2>
            <p>
                This isolated microservice exposes real-time retail intelligence, statutory GST summaries, customer 360 dossiers,
                and financial analytics to AI agents (Claude Desktop, Cursor, Antigravity) over the open Model Context Protocol (MCP).
            </p>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-val">{total_tools}</div>
                    <div class="stat-lbl">Unified Tools</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">5</div>
                    <div class="stat-lbl">Analytics & BI Tools</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">7</div>
                    <div class="stat-lbl">Retail Operations Tools</div>
                </div>
                <div class="stat-card">
                    <div class="stat-val">SSE</div>
                    <div class="stat-lbl">Official Transport</div>
                </div>
            </div>
        </section>

        <h3 class="section-title">🌐 Service Endpoints</h3>
        <div class="endpoints-grid">
            <div class="endpoint-card">
                <div class="endpoint-meta">
                    <strong>MCP SSE Stream</strong>
                    <span class="http-method get">GET</span>
                </div>
                <div class="endpoint-url">{base_url}/sse</div>
                <p class="endpoint-desc">Live Server-Sent Events stream for AI clients to connect, discover tools, and receive notifications.</p>
            </div>
            <div class="endpoint-card">
                <div class="endpoint-meta">
                    <strong>MCP Message Relay</strong>
                    <span class="http-method post">POST</span>
                </div>
                <div class="endpoint-url">{base_url}/messages/</div>
                <p class="endpoint-desc">Bidirectional JSON-RPC 2.0 message handler for client request invocation and parameter exchanges.</p>
            </div>
            <div class="endpoint-card">
                <div class="endpoint-meta">
                    <strong>Health Check</strong>
                    <span class="http-method get">GET</span>
                </div>
                <div class="endpoint-url">{base_url}/health</div>
                <p class="endpoint-desc">Instantaneous JSON health probe for Coolify Traefik reverse proxy and Docker container healthchecks.</p>
            </div>
        </div>

        <h3 class="section-title">📊 Analytics & Business Intelligence Tools (5)</h3>
        <div class="tools-grid">
            {analytics_html}
        </div>

        <h3 class="section-title">🛒 Retail Operational Tools (7)</h3>
        <div class="tools-grid">
            {retail_html}
        </div>

        <h3 class="section-title">⚙️ AI Client Configuration (Cursor / Claude Desktop)</h3>
        <div class="config-box">
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">
                Add this block to your <code>claude_desktop_config.json</code> or <code>.cursor/mcp.json</code> to connect your AI assistant:
            </p>
            <pre>{{
  "mcpServers": {{
    "storecraft": {{
      "url": "{base_url}/sse"
    }}
  }}
}}</pre>
        </div>

        <footer>
            StoreCraft Retail ERP & POS • Dedicated Model Context Protocol Service • Django ORM & FastMCP
        </footer>
    </div>
</body>
</html>"""
