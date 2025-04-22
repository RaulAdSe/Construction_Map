#!/bin/bash
# Cloud Run Deployment Script for IAM Authentication

set -e

echo "==== Cloud Run Deployment with IAM Authentication ===="

# Configuration variables
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
SERVICE_NAME="construction-map-backend"
IMAGE_NAME="construction-map-backend"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
REPOSITORY="gcr.io/${PROJECT_ID}"
SQL_INSTANCE="${PROJECT_ID}:${REGION}:construction-map-db-2"
STORAGE_BUCKET="construction-map-storage-${PROJECT_ID}"
SERVICE_ACCOUNT="servitec-map-service@${PROJECT_ID}.iam.gserviceaccount.com"
DB_NAME="construction_map"

# Checking IAM authentication on Cloud SQL
echo "Checking IAM authentication on Cloud SQL..."
CLOUDSQL_IAM_AUTH=$(gcloud sql instances describe ${SQL_INSTANCE##*:} --project=${PROJECT_ID} --format="value(settings.databaseFlags[0].value)")
if [ "$CLOUDSQL_IAM_AUTH" != "on" ]; then
    echo "Enabling IAM authentication on Cloud SQL instance..."
    gcloud sql instances patch ${SQL_INSTANCE##*:} --project=${PROJECT_ID} --database-flags=cloudsql.iam_authentication=on
    echo "IAM authentication enabled. Instance is restarting, please wait..."
    sleep 30
fi

# Ensure service account has required permissions
echo "Ensuring service account has required permissions..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudsql.client" \
    --condition=None

# Create Cloud Storage bucket if it doesn't exist
if ! gsutil ls -b gs://${STORAGE_BUCKET} > /dev/null 2>&1; then
    echo "Creating Cloud Storage bucket ${STORAGE_BUCKET}..."
    gsutil mb -l ${REGION} gs://${STORAGE_BUCKET}
    gsutil iam ch serviceAccount:${SERVICE_ACCOUNT}:objectAdmin gs://${STORAGE_BUCKET}
else
    echo "Storage bucket gs://${STORAGE_BUCKET} already exists"
fi

# Grant IAM user permissions to the database
echo "Granting database permissions to service account..."
gcloud sql users create ${SERVICE_ACCOUNT} \
    --instance=${SQL_INSTANCE##*:} \
    --type=cloud_iam_service_account || echo "IAM user already exists, continuing..."

# Create startup script for the Docker container
echo "Creating startup script..."
cat > start.sh << 'EOF'
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
EOF

chmod +x start.sh

# Create Dockerfile if it doesn't exist
if [ ! -f Dockerfile ]; then
    echo "Creating Dockerfile..."
    cat > Dockerfile << 'EOF'
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional required packages
RUN pip install --no-cache-dir cloud-sql-python-connector[pg8000] google-cloud-storage gunicorn uvicorn bcrypt email-validator sendgrid

# Copy startup script
COPY start.sh .
RUN chmod +x /app/start.sh

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads

# Set environment variables
ENV PYTHONPATH=/app
ENV PORT=8080

# Run with the startup script
CMD ["/app/start.sh"]
EOF
fi

# Copy the updated .env.gcp file
cp .env.gcp .env

# Build and push image
echo "Building and pushing Docker image..."
gcloud builds submit --tag ${REPOSITORY}/${IMAGE_NAME}:${TIMESTAMP} .

# Deploy to Cloud Run with IAM Authentication
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${REPOSITORY}/${IMAGE_NAME}:${TIMESTAMP} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --service-account ${SERVICE_ACCOUNT} \
    --memory 1Gi \
    --cpu 1 \
    --add-cloudsql-instances ${SQL_INSTANCE} \
    --set-env-vars="CLOUD_DB_ENABLED=true" \
    --set-env-vars="CLOUD_DB_INSTANCE=${SQL_INSTANCE}" \
    --set-env-vars="CLOUD_DB_NAME=${DB_NAME}" \
    --set-env-vars="CLOUD_DB_USER=map-sa" \
    --set-env-vars="CLOUD_DB_PASSWORD=postgres" \
    --set-env-vars="CLOUD_DB_CONNECTION_STRING=postgresql+pg8000://map-sa:postgres@localhost/${DB_NAME}?unix_sock=/cloudsql/${SQL_INSTANCE}/.s.PGSQL.5432" \
    --set-env-vars="CLOUD_DB_IAM_AUTHENTICATION=false" \
    --set-env-vars="USE_CLOUD_STORAGE=true" \
    --set-env-vars="CLOUD_STORAGE_BUCKET=${STORAGE_BUCKET}" \
    --set-env-vars="SKIP_DB_SCHEMA_UPDATE=true" \
    --set-env-vars="ENFORCE_HTTPS=false" \
    --set-env-vars="SECURE_COOKIES=true" \
    --set-env-vars="SECRET_KEY=3e08dde562fdd25e09c65b47b5d4a9e10e1d5e8ed2d34fc783cb0ecdb2fef77e"

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format="value(status.url)")

echo "Deployment complete!"
echo "Service URL: ${SERVICE_URL}"

# Test the service
echo -e "\nTesting service health..."
sleep 5  # Give the service a moment to start
curl -s ${SERVICE_URL}/health > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Service is healthy!"
else
    echo "⚠️ Service is not responding to health checks yet."
    echo "This might be normal during initial startup. Try again in a minute."
fi

echo -e "\nYou can manually test with: curl ${SERVICE_URL}/health" 