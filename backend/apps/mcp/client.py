"""StoreCraft MCP Client Service.

Enables backend services and AI Copilot to connect to the dedicated MCP server
(defaulting to http://mcp:8080 in Docker or http://localhost:8080 in local dev).
Falls back to direct tool execution if the remote MCP service is unreachable.
"""

import json
import logging
import os
import urllib.error
import urllib.request
import uuid
from typing import Any

from django.conf import settings

from .tools import MCPToolRegistry

logger = logging.getLogger(__name__)


class MCPClient:
    """Client for communicating with the dedicated StoreCraft MCP Server."""

    @classmethod
    def get_server_url(cls) -> str:
        """Resolve the MCP Server base URL."""
        return (
            os.environ.get("MCP_SERVER_URL")
            or getattr(settings, "MCP_SERVER_URL", None)
            or "http://mcp:8080"
        ).rstrip("/")

    @classmethod
    def ping(cls) -> dict[str, Any]:
        """Ping the dedicated MCP server."""
        url = f"{cls.get_server_url()}/messages/"
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "ping",
            "params": {},
        }
        try:
            return cls._send_jsonrpc(url, payload)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            logger.debug(f"MCP server ping failed ({e}). Returning fallback status.")
            return {"status": "fallback", "service": "In-process fallback"}

    @classmethod
    def list_tools(cls) -> list[dict[str, Any]]:
        """Retrieve list of available tools from the dedicated MCP server.

        Falls back to local tool registry if the remote MCP container is not reachable.
        """
        url = f"{cls.get_server_url()}/messages/"
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/list",
            "params": {},
        }
        try:
            resp = cls._send_jsonrpc(url, payload)
            if "result" in resp and "tools" in resp["result"]:
                return resp["result"]["tools"]
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            logger.debug(f"Remote MCP list_tools failed ({e}). Using local registry.")

        # Fallback to local registry
        return MCPToolRegistry.list_tools()

    @classmethod
    def call_tool(cls, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool via the dedicated MCP server.

        Falls back to local tool execution if the remote MCP container is not reachable.
        """
        url = f"{cls.get_server_url()}/messages/"
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": name,
                "arguments": arguments,
            },
        }
        try:
            resp = cls._send_jsonrpc(url, payload)
            if "result" in resp:
                result = resp["result"]
                content = result.get("content", [])
                raw_text = content[0].get("text", "{}") if content else "{}"
                try:
                    structured = json.loads(raw_text)
                except (json.JSONDecodeError, TypeError):
                    structured = {}

                return {
                    "content": content,
                    "isError": result.get("isError", False),
                    "structured_data": structured,
                }
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            logger.debug(f"Remote MCP tool call '{name}' failed ({e}). Executing locally.")

        # Fallback to local registry
        return MCPToolRegistry.call_tool(name, arguments)

    @classmethod
    def _send_jsonrpc(cls, url: str, payload: dict[str, Any], timeout: float = 5.0) -> dict[str, Any]:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body)
