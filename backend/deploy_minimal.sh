#!/bin/bash

# Minimal App Deployment Script
# ----------------------------

# Exit on error
set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api-minimal"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"2"}
MEMORY=${MEMORY:-"256Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}

# Print banner
echo "=============================================="
echo "  Servitec Map API - Minimal Deployment  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy a minimal version of the API to Google Cloud Run."
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Min Instances: $MIN_INSTANCES"
echo "  Max Instances: $MAX_INSTANCES"
echo "  Timeout: ${TIMEOUT}s"
echo "  Concurrency: $CONCURRENCY"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create temporary minimal Dockerfile
TEMP_DOCKERFILE="Dockerfile.minimal"
cat > $TEMP_DOCKERFILE << 'EOF'
FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    MINIMAL_APP=true

# Install FastAPI and Uvicorn
RUN pip install --no-cache-dir fastapi uvicorn

# Copy minimal app and entrypoint
COPY minimal_app.py /app/
COPY docker-entrypoint.sh /app/
RUN chmod 755 /app/docker-entrypoint.sh

# Create non-root user
RUN adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Use the entrypoint script to start the server
ENTRYPOINT ["/app/docker-entrypoint.sh"]
EOF

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Build and deploy directly (no Cloud Build)
echo "Building and deploying minimal app..."
echo "Creating a temporary Cloud Build config file..."
cat > cloudbuild.minimal.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME', '-f', '$TEMP_DOCKERFILE', '.']
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME'
EOF

gcloud builds submit --config cloudbuild.minimal.yaml .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory $MEMORY \
    --cpu $CPU \
    --min-instances $MIN_INSTANCES \
    --max-instances $MAX_INSTANCES \
    --timeout ${TIMEOUT}s \
    --concurrency $CONCURRENCY

# Clean up
rm -f $TEMP_DOCKERFILE cloudbuild.minimal.yaml

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Minimal app deployed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "================================================" 