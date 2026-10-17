from django.urls import path

from .views import (
    AIChatCopilotView,
    AITestConnectionView,
    MCPJsonRpcView,
    MCPToolsListView,
)

app_name = "mcp"

urlpatterns = [
    # Standard MCP JSON-RPC 2.0 endpoint (for Cursor, Claude, Antigravity, LLM tools)
    path("rpc/", MCPJsonRpcView.as_view(), name="mcp-rpc"),
    
    # REST tool registry
    path("tools/", MCPToolsListView.as_view(), name="mcp-tools-list"),
    
    # AI Retail Copilot conversational endpoint with autonomous tool loop
    path("chat/", AIChatCopilotView.as_view(), name="mcp-chat"),
    
    # Provider connectivity tester
    path("test-connection/", AITestConnectionView.as_view(), name="mcp-test-connection"),
]
