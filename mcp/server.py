"""StoreCraft MCP Server entry point.

Initializes Django ORM and starts the FastMCP/MCPServer SSE transport on port 8080.
"""

import os
import sys
from pathlib import Path


def init_django():
    """Bootstrap Django settings and apps."""
    if not os.environ.get("DJANGO_SETTINGS_MODULE"):
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

    backend_dir = os.environ.get("BACKEND_DIR")
    if not backend_dir:
        # Default relative to this file: ../backend
        backend_dir = str(Path(__file__).resolve().parent.parent / "backend")

    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    import django

    django.setup()


# Ensure mcp directory itself is in sys.path for local tools package
mcp_dir = str(Path(__file__).resolve().parent)
if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)

# Initialize Django before importing models/tools
init_django()

# Import MCPServer (mcp 2.x) or fallback to FastMCP (mcp 1.x)
try:
    from mcp.server.mcpserver import MCPServer

    mcp = MCPServer(
        name="StoreCraft MCP Service",
        instructions=(
            "Provides real-time retail intelligence, KPIs, store analytics, "
            "and inventory performance data for StoreCraft multi-tenant retail stores."
        ),
    )
except ImportError:
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP(
        name="StoreCraft MCP Service",
        instructions=(
            "Provides real-time retail intelligence, KPIs, store analytics, "
            "and inventory performance data for StoreCraft multi-tenant retail stores."
        ),
    )

# Register tool modules
from tools.analytics import register_analytics_tools

register_analytics_tools(mcp)


def run():
    """Start the MCP server with SSE transport."""
    host = os.environ.get("MCP_HOST", "0.0.0.0")
    port = int(os.environ.get("MCP_PORT", "8080"))
    print(f"Starting StoreCraft MCP Server on {host}:{port}/sse ...")
    mcp.run(transport="sse", host=host, port=port)


if __name__ == "__main__":
    run()
