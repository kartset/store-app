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

echo "==> [Entrypoint] Collecting static files..."
uv run manage.py collectstatic --noinput --clear || true

# Default to gunicorn if no command is passed
if [ $# -eq 0 ]; then
  set -- uv run gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3 --threads 2 --timeout 60
fi

echo "==> [Entrypoint] Starting application: $@"
exec "$@"
