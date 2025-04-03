#!/bin/bash
set -e

# Default to 8080 if PORT not set (Cloud Run typically sets PORT=8080)
if [ -z "$PORT" ]; then
    export PORT=8080
fi

echo "Starting application on port $PORT"

# Run database migrations
alembic upgrade head

# Start the application using the PORT environment variable
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" 