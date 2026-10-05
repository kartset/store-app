FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (for psycopg2)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock ./

# Install dependencies without installing the project itself
RUN uv sync --frozen --no-install-project

# Copy the rest of the backend source
COPY backend/ ./

# Install the project
RUN uv sync --frozen

# Run server
EXPOSE 8000
CMD ["uv", "run", "manage.py", "runserver", "0.0.0.0:8000"]
