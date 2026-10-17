#!/bin/sh
set -e

echo "==> [Entrypoint] Waiting for PostgreSQL to be ready..."
until uv run manage.py check --database default > /dev/null 2>&1; do
  echo "==> [Entrypoint] PostgreSQL is unavailable, retrying in 1s..."
  sleep 1
done
echo "==> [Entrypoint] PostgreSQL is ready."

echo "==> [Entrypoint] Checking and applying database migrations..."
uv run manage.py migrate --noinput

# Default to runserver if no command is passed
if [ $# -eq 0 ]; then
  set -- uv run manage.py runserver 0.0.0.0:8000
fi

echo "==> [Entrypoint] Starting application: $@"
exec "$@"
