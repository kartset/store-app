FROM python:3.12-slim
WORKDIR /app

# Install system runtime dependencies for PostgreSQL and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc curl && rm -rf /var/lib/apt/lists/*

# Install uv package manager
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency specifications from backend
COPY backend/pyproject.toml backend/uv.lock /app/backend/

# Configure isolated virtual environment
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install production dependencies
WORKDIR /app/backend
RUN uv sync --frozen --no-dev

# Copy application source
COPY backend/ /app/backend/
COPY mcp/ /app/mcp/

WORKDIR /app/mcp
ENV PYTHONPATH=/app/backend:/app/mcp
ENV DJANGO_SETTINGS_MODULE=core.settings
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:8080/sse || exit 1

CMD ["uv", "run", "python", "server.py"]
