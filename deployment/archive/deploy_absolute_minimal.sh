#!/bin/bash

# Absolute Minimal Deployment Script
# This deploys a barebones FastAPI app with no database or complex config

set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api-bare-minimal"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"2"}
MEMORY=${MEMORY:-"256Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}

# Print banner
echo "=============================================="
echo "  Absolute Minimal FastAPI Deployment  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy a minimal FastAPI app with no database or complex config."
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create a temporary Dockerfile
TEMP_DOCKERFILE="Dockerfile.minimal.test"
cat > $TEMP_DOCKERFILE << EOF
FROM python:3.11-slim

WORKDIR /app

# Install uvicorn and fastapi
RUN pip install --no-cache-dir fastapi uvicorn

# Copy the minimal app
COPY minimal_app.py /app/

# Set the port
ENV PORT=8080

# Create a non-root user
RUN useradd -m appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Run the app
CMD ["python", "minimal_app.py"]
EOF

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Create Cloud Build config
cat > cloudbuild.minimal.yaml << EOF
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME', '-f', '$TEMP_DOCKERFILE', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/$SERVICE_NAME']

# Save the image to GCR
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME'
EOF

# Build and deploy using Cloud Build
echo "Building and deploying with Cloud Build..."
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
    --concurrency $CONCURRENCY

# Clean up
rm -f $TEMP_DOCKERFILE cloudbuild.minimal.yaml

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Minimal deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "Test: $SERVICE_URL/api/v1/test"
echo "Debug: $SERVICE_URL/api/v1/debug"
echo "==============================================" 