#!/bin/bash
set -e

echo "=== Starting Construction Map Backend ==="
echo "Current working directory: $(pwd)"
echo "Current user: $(whoami)"
echo "Python version: $(python --version)"

# Print environment variables for debugging (masking sensitive values)
echo "Environment:"
echo "- CLOUD_DB_ENABLED: $CLOUD_DB_ENABLED"
echo "- CLOUD_DB_INSTANCE: $CLOUD_DB_INSTANCE"
echo "- CLOUD_DB_NAME: $CLOUD_DB_NAME"
echo "- CLOUD_DB_IAM_AUTHENTICATION: $CLOUD_DB_IAM_AUTHENTICATION"
echo "- USE_CLOUD_STORAGE: $USE_CLOUD_STORAGE"
echo "- CLOUD_STORAGE_BUCKET: $CLOUD_STORAGE_BUCKET"
echo "- PYTHONPATH: $PYTHONPATH"
echo "- PORT: $PORT"

# Create necessary directories if they don't exist
mkdir -p /app/logs /app/uploads
echo "Created logs and uploads directories"

# List installed Python packages
echo "Installed packages:"
pip list

# Check if the Cloud SQL Auth Proxy socket exists
if [ "$CLOUD_DB_ENABLED" = "true" ]; then
  SOCKET_PATH="/cloudsql/$CLOUD_DB_INSTANCE/.s.PGSQL.5432"
  echo "Checking for Cloud SQL socket at: $SOCKET_PATH"
  if [ -e "$SOCKET_PATH" ]; then
    echo "Cloud SQL socket exists"
  else
    echo "WARN: Cloud SQL socket not found at $SOCKET_PATH"
    echo "Available files in /cloudsql:"
    ls -la /cloudsql/
    if [ -d "/cloudsql/$CLOUD_DB_INSTANCE" ]; then
      echo "Instance directory exists, checking contents:"
      ls -la /cloudsql/$CLOUD_DB_INSTANCE/
    else
      echo "Instance directory does not exist"
    fi
  fi
fi

# Copy .env.gcp to .env to ensure proper configuration
if [ -f ".env.gcp" ]; then
  echo "Copying .env.gcp to .env"
  cp .env.gcp .env
  echo "Environment file copied"
fi

# Start the application
echo "Starting application with gunicorn..."
exec gunicorn --bind :$PORT --workers 1 --worker-class uvicorn.workers.UvicornWorker --timeout 300 --log-level debug app.main:app
