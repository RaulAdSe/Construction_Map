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

# Print database connection info (without password)
DB_URL_SAFE=$(echo "$DATABASE_URL" | sed 's/:[^:]*@/:*****@/')
CLOUD_DB_CONN_SAFE=$(echo "$CLOUD_DB_CONNECTION_STRING" | sed 's/:[^:]*@/:*****@/')
echo "Database URL: $DB_URL_SAFE"
echo "Cloud DB connection: $CLOUD_DB_CONN_SAFE"

# Create required directories if they don't exist
mkdir -p /app/uploads/events /app/uploads/comments /app/logs

# Check if database is accessible
echo "Checking database connection..."
python -c "
import os
import sys
import time
import psycopg2

DB_URL = os.environ.get('DATABASE_URL')
CLOUD_DB_STR = os.environ.get('CLOUD_DB_CONNECTION_STRING')
CONNECTION_STRING = CLOUD_DB_STR if os.environ.get('CLOUD_DB_ENABLED') == 'true' else DB_URL

for i in range(5):
    try:
        conn = psycopg2.connect(CONNECTION_STRING)
        conn.close()
        print('Database connection successful!')
        sys.exit(0)
    except Exception as e:
        print(f'Connection attempt {i+1} failed: {str(e)}')
        if i < 4:
            print('Retrying in 5 seconds...')
            time.sleep(5)
sys.exit(1)
" || DB_CHECK_FAILED=true

# Run database migrations with a fallback
if [ "$DB_CHECK_FAILED" = true ]; then
    echo "WARNING: Database connection check failed. Application may not work correctly."
    echo "WARNING: Skipping database migrations."
else
    echo "Running database migrations..."
    alembic upgrade head || {
        echo "WARNING: Database migrations failed. This could be due to:"
        echo "- Database credentials are incorrect"
        echo "- Database schema is already up to date"
        echo "- Database is not accessible"
        echo "Continuing application startup, but functionality may be limited."
    }
fi

echo "Starting the application..."
# Start the application using the PORT environment variable
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT" 