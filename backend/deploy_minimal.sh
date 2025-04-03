#!/bin/bash

# Cloud Run Minimal Deployment Script
# ----------------------------------

# Exit on error
set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"10"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}

# Print banner
echo "=============================================="
echo "  Servitec Map API - Minimal Test Deployment  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy a minimal version of the API for testing."
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME-minimal"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create a temporary Dockerfile for the minimal application
cat > Dockerfile.minimal << EOF
FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \\
    PYTHONUNBUFFERED=1 \\
    PORT=8080 \\
    ENVIRONMENT=minimal

# Install minimal dependencies
RUN pip install --no-cache-dir fastapi uvicorn

# Copy minimal application
COPY app/main_minimal.py /app/main.py

# Expose the application port
EXPOSE 8080

# Start the minimal application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
EOF

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Build and deploy using Cloud Build
echo "Building and deploying minimal application..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME-minimal --config - << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME-minimal', '-f', 'Dockerfile.minimal', '.']
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME-minimal'
EOF

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME-minimal \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME-minimal \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory $MEMORY \
    --cpu $CPU \
    --min-instances 0 \
    --max-instances 2 \
    --timeout ${TIMEOUT}s \
    --concurrency $CONCURRENCY

# Clean up
rm -f Dockerfile.minimal

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME-minimal --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Minimal deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "API Test: $SERVICE_URL/api/v1/test"
echo "==============================================" 