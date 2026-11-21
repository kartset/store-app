# StoreCraft MCP Service

Model Context Protocol (MCP) server providing real-time retail intelligence and analytics tools for AI agents.

## Architecture

- **Transport**: Standard HTTP Server-Sent Events (`/sse`) on port 8080.
- **Protocol**: Official Model Context Protocol specification (`mcp` Python SDK).
- **Data Layer**: Direct integration with Django ORM and PostgreSQL.
- **Tenant Isolation**: Mandatory `organization_id` scoping on all queries.

## Endpoints

- `GET /sse`: Persistent Server-Sent Events stream for AI clients.
- `POST /messages/`: JSON-RPC tool call dispatch endpoint.
