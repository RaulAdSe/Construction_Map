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

# Force debug mode for troubleshooting
export DEBUG="true"
export PYDANTIC_SETTINGS_DEBUG="true" # Add debug for pydantic-settings

# Build DATABASE_URL from individual components if not set
if [ -z "$DATABASE_URL" ] && [ ! -z "$DB_HOST" ] && [ ! -z "$DB_NAME" ] && [ ! -z "$DB_USER" ] && [ ! -z "$DB_PASS" ]; then
    DB_PORT=${DB_PORT:-5432}
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    echo "Built DATABASE_URL from individual components"
fi

# Print database connection info (without credentials)
if [ ! -z "$DATABASE_URL" ]; then
    # Extract host and database name from DATABASE_URL without showing credentials
    DB_HOST_DISPLAY=$(echo $DATABASE_URL | sed -r 's/.*@([^\/]+)\/.*/\1/')
    DB_NAME_DISPLAY=$(echo $DATABASE_URL | sed -r 's/.*\/([^\?]+).*/\1/')
    echo "Database connection: ${DB_HOST_DISPLAY}/${DB_NAME_DISPLAY}"
fi

# Force environment variables for CORS - setting them explicitly
# Note: We're using hardcoded settings now which bypass these env vars
unset CORS_ORIGINS
unset ALLOW_ALL_ORIGINS

# Add a retry mechanism for database connection
MAX_RETRIES=${DB_CONNECT_RETRY:-3}
RETRY_DELAY=${DB_CONNECT_RETRY_DELAY:-5}

echo "Starting the application with robust error handling..."
echo "Max database connection retries: $MAX_RETRIES, delay: $RETRY_DELAY seconds"

# Start the application with our robust error handling
exec python /app/app_test.py 