import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import AICopilotEngine
from .tools import MCPToolRegistry

logger = logging.getLogger(__name__)


class MCPJsonRpcView(APIView):
    """
    Standard Model Context Protocol (MCP) JSON-RPC 2.0 endpoint.
    Compatible with MCP clients, Claude Desktop, Cursor, Antigravity, and custom LLM agents.

    Supported methods:
      - 'tools/list': Returns list of tool definitions.
      - 'tools/call': Executes a specific tool with arguments.
      - 'ping': Healthcheck ping.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data
        if not isinstance(data, dict):
            return Response(
                {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request: expected JSON object"}, "id": None},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req_id = data.get("id")
        method = data.get("method")
        params = data.get("params", {})

        if not method:
            return Response(
                {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request: 'method' field is required"}, "id": req_id},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Method 1: tools/list
        if method == "tools/list":
            tools = MCPToolRegistry.list_tools()
            return Response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": tools},
            })

        # Method 2: tools/call
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            if not tool_name:
                return Response(
                    {"jsonrpc": "2.0", "error": {"code": -32602, "message": "Missing 'name' in params for tools/call"}, "id": req_id},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            tool_def = MCPToolRegistry.get_tool(tool_name)
            if not tool_def:
                return Response(
                    {"jsonrpc": "2.0", "error": {"code": -32601, "message": f"Method/Tool '{tool_name}' not found"}, "id": req_id},
                    status=status.HTTP_404_NOT_FOUND,
                )

            res = MCPToolRegistry.call_tool(tool_name, arguments)
            return Response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": res.get("content", []),
                    "isError": res.get("isError", False),
                },
            })

        # Method 3: ping
        elif method == "ping":
            return Response({
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"status": "ok", "service": "StoreCraft Retail MCP Server"},
            })

        # Unsupported method
        else:
            return Response(
                {"jsonrpc": "2.0", "error": {"code": -32601, "message": f"Method '{method}' not found"}, "id": req_id},
                status=status.HTTP_404_NOT_FOUND,
            )


class MCPToolsListView(APIView):
    """
    RESTful endpoint exposing the registry of available MCP tools and their schemas.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        tools = MCPToolRegistry.list_tools()
        return Response({
            "count": len(tools),
            "tools": tools,
        })


class AIChatCopilotView(APIView):
    """
    Retail AI Copilot assistant endpoint.
    Accepts conversation messages, provider configurations, and executes the
    tool-calling loop with live StoreCraft MCP tools.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data
        messages = data.get("messages", [])
        if not messages or not isinstance(messages, list):
            return Response(
                {"error": "Field 'messages' must be a non-empty list of message objects."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = data.get("provider", "openrouter")
        model = data.get("model")
        api_key = data.get("api_key") or request.headers.get("X-API-Key")
        store_id = data.get("store_id")

        result = AICopilotEngine.execute_chat(
            messages=messages,
            provider=provider,
            model=model,
            api_key=api_key,
            store_id=store_id,
        )

        return Response(result)


class AITestConnectionView(APIView):
    """
    Tests connectivity and API key validity for OpenAI or OpenRouter.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        data = request.data
        provider = data.get("provider", "openrouter")
        api_key = data.get("api_key") or request.headers.get("X-API-Key")
        model = data.get("model") or ("openai/gpt-4o-mini" if provider == "openrouter" else "gpt-4o-mini")

        if not api_key:
            return Response(
                {"success": False, "error": "API Key is required to test external provider connection."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        test_msg = [{"role": "user", "content": "Respond with 'Connected' only."}]
        try:
            res = AICopilotEngine.execute_chat(
                messages=test_msg,
                provider=provider,
                model=model,
                api_key=api_key,
            )
            return Response({
                "success": True,
                "message": f"Successfully connected to {provider.upper()} using model '{model}'.",
                "sample_response": res.get("message", {}).get("content", ""),
            })
        except Exception as e:  # noqa: BLE001
            return Response({
                "success": False,
                "error": f"Connection test failed: {e!s}",
            }, status=status.HTTP_400_BAD_REQUEST)
