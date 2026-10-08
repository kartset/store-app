FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (for psycopg2)
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy dependency files
COPY backend/pyproject.toml backend/uv.lock ./

# Tell uv to place the virtual environment completely outside the mounted /app directory
# This prevents the host machine from overwriting the container's environment when mounting volumes
ENV UV_PROJECT_ENVIRONMENT=/opt/venv

# Install dependencies
RUN uv sync --frozen

# Copy the rest of the backend source
COPY backend/ ./

# Run server
EXPOSE 8000
CMD ["uv", "run", "manage.py", "runserver", "0.0.0.0:8000"]
