#!/bin/bash

# Final Deployment Script for Servitec Map API to Google Cloud Run
# This script simplifies env vars, builds and deploys the app

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
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"map-service-account@deep-responder-444017-h2.iam.gserviceaccount.com"}

# Print banner
echo "=============================================="
echo "  Servitec Map API - Final Deployment  "
echo "=============================================="
echo

# Create a minimal environment file for deployment
ENV_YAML_FILE=".env.yaml"

cat > $ENV_YAML_FILE << EOF
# Generated environment variables for deployment
POSTGRES_SERVER: "34.123.51.251"
POSTGRES_PORT: "5432"
POSTGRES_USER: "postgres"
POSTGRES_PASSWORD: "4|YD}Tl4npU1d\"M$"
POSTGRES_DB: "servitec_map"
SECRET_KEY: "573a9489b52a746dfdee7bb322e47ed8320087114c6d480eee89bf18dd4dbb47"
UPLOAD_FOLDER: "/app/uploads"
CLOUD_STORAGE_ENABLED: "true"
GCP_PROJECT_ID: "$PROJECT_ID"
GCP_STORAGE_BUCKET: "bucket-map-viewer"
ENVIRONMENT: "production"
DEBUG: "false"
DISABLE_DATABASE_OPERATIONS: "false"
DATABASE_URL: "postgresql://postgres:4%7CYD%7D%54l4npU1d%22M%24@34.123.51.251:5432/servitec_map"
EOF

echo "Created environment YAML file with essential variables"

# Confirm deployment
echo "This script will deploy the Servitec Map API to Google Cloud Run."
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

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Create Cloud Build config
cat > cloudbuild.final.yaml << EOF
steps:
  # Build the container image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME', '-f', 'Dockerfile.prod', '.']
    timeout: '1200s'
  
  # Push the container image to Container Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/$SERVICE_NAME']
    timeout: '600s'

# Save the image to GCR
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME'

# Configure timeout for the build
timeout: '1800s'  # 30 minutes

# Configure options for the build
options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'
EOF

# Build and deploy using Cloud Build
echo "Building and deploying with Cloud Build..."
gcloud builds submit --config cloudbuild.final.yaml .

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
    --concurrency $CONCURRENCY \
    --service-account $SERVICE_ACCOUNT \
    --env-vars-file $ENV_YAML_FILE

# Clean up
rm -f $ENV_YAML_FILE cloudbuild.final.yaml

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "API Documentation: $SERVICE_URL/docs"
echo "==============================================" 