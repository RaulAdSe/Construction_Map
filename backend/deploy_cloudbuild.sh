#!/bin/bash

# Cloud Run Deployment Script (using Cloud Build)
# ----------------------------------------------

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
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"map-service-account@deep-responder-444017-h2.iam.gserviceaccount.com"}
CLOUDSQL_INSTANCE=${CLOUDSQL_INSTANCE:-"deep-responder-444017-h2:us-central1:map-viewer"}

# Print banner
echo "=============================================="
echo "  Servitec Map API - Cloud Build Deployment  "
echo "=============================================="
echo

# Create simplified environment file
echo "Creating simplified environment file..."
./simple_env.sh
ENV_VARS_FILE=".env.deploy"

# Check if deployment file exists
if [ ! -f "$ENV_VARS_FILE" ]; then
    echo "Error: $ENV_VARS_FILE not found. Simple environment creation failed."
    exit 1
fi

# Confirm deployment
echo "This script will deploy the Servitec Map API to Google Cloud Run using Cloud Build."
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
echo "Environment variables will be loaded from: $ENV_VARS_FILE"
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

# Prepare environment variables with a simpler approach
echo "Preparing environment variables..."
ENV_VARS=""

# Read each line and build comma-separated list
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    if [[ ! $line =~ ^#.*$ ]] && [[ -n "$line" ]]; then
        # Add this line to our env vars, with comma if not first
        if [ -z "$ENV_VARS" ]; then
            ENV_VARS="$line"
        else
            ENV_VARS="$ENV_VARS,$line"
        fi
    fi
done < "$ENV_VARS_FILE"

# Deploy to Cloud Run with Cloud Build
echo "Building and deploying with Cloud Build..."
# Use the cloudbuild.yaml file for more control
gcloud builds submit --config cloudbuild.yaml .

# Deploy to Cloud Run with environment variables
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
    --add-cloudsql-instances $CLOUDSQL_INSTANCE \
    --set-env-vars "$ENV_VARS"

# Clean up
rm -f "$ENV_VARS_FILE"

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "API Documentation: $SERVICE_URL/docs"
echo "==============================================" 