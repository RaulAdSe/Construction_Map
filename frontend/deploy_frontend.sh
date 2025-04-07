#!/bin/bash

# Servitec Map Frontend - Production Deployment Script
# This deploys the frontend to Cloud Run

set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-frontend"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"2"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}
BACKEND_SERVICE=${BACKEND_SERVICE:-"servitec-map-api"}

# Print banner
echo "=============================================="
echo "  Servitec Map Frontend - Production Deployment  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy the Servitec Map Frontend to Cloud Run."
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  Backend API: $BACKEND_SERVICE"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Get the backend URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)')
if [ -z "$BACKEND_URL" ]; then
    echo "Error: Could not get the backend URL. Make sure the backend is deployed."
    exit 1
fi

echo "Using backend URL: $BACKEND_URL"

# Create environment configuration file for building frontend
ENV_FILE=".env.production"
cat > $ENV_FILE << EOF
# Production environment variables
REACT_APP_API_URL=$BACKEND_URL
EOF

echo "Created production environment file with API URL: $BACKEND_URL"

# Build the frontend
echo "Building the frontend..."
npm install
npm run build

# Create Cloud Build configuration
CONFIG_YAML="cloudbuild.frontend.yaml"
cat > $CONFIG_YAML << EOF
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME', '-f', 'Dockerfile.prod', '.']
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/$SERVICE_NAME']

# Save the image to GCR
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME'
EOF

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Build and deploy using Cloud Build
echo "Building and deploying with Cloud Build..."
gcloud builds submit --config $CONFIG_YAML .

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
    --concurrency $CONCURRENCY \
    --timeout $TIMEOUT

# Clean up - for security, immediately remove files with sensitive information
rm -f $CONFIG_YAML $ENV_FILE

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Servitec Map Frontend deployment completed successfully!"
echo "Frontend URL: $SERVICE_URL"
echo "Backend API URL: $BACKEND_URL"
echo "==============================================" 