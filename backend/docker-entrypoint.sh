#!/bin/bash
set -e

# Default to 8080 if PORT not set (Cloud Run typically sets PORT=8080)
if [ -z "$PORT" ]; then
    export PORT=8080
fi

echo "============================================"
echo "Starting application on port $PORT"
echo "Environment: $ENVIRONMENT"
echo "Debug mode: $DEBUG"
echo "============================================"

# Print environment variables (without sensitive values)
echo "POSTGRES_SERVER: $POSTGRES_SERVER"
echo "POSTGRES_DB: $POSTGRES_DB"
echo "CLOUD_DB_ENABLED: $CLOUD_DB_ENABLED"
echo "GCP_PROJECT_ID: $GCP_PROJECT_ID"
echo "CLOUD_STORAGE_ENABLED: $CLOUD_STORAGE_ENABLED"

# Create required directories if they don't exist
mkdir -p /app/uploads/events /app/uploads/comments /app/logs
echo "Directories created successfully"

# Use the minimal app first to pass health checks, then try the full app
if [ "$MINIMAL_APP" = "true" ]; then
    echo "Starting minimal application for troubleshooting..."
    exec python /app/minimal_app.py
else
    echo "Starting the full application with comprehensive error logging..."
    exec python /app/app_test.py
fi 