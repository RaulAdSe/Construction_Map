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

echo "Starting the application directly via Python test script..."
python /app/app_test.py 