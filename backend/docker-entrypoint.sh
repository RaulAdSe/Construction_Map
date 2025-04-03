#!/bin/bash
set -e

# Default to 8080 if PORT not set (Cloud Run typically sets PORT=8080)
if [ -z "$PORT" ]; then
    export PORT=8080
fi

echo "============================================"
echo "Starting application on port $PORT"
echo "Environment: $ENVIRONMENT"
echo "============================================"

# Create required directories if they don't exist
mkdir -p /app/uploads/events /app/uploads/comments /app/logs
echo "Directories created successfully"

# Force override settings - critical for the application to work correctly in Cloud Run
export ALLOW_ALL_ORIGINS="true"
export CORS_ORIGINS="http://localhost:3000"

# Start the application with our robust error handling
echo "Starting the application with robust error handling..."
exec python /app/app_test.py 