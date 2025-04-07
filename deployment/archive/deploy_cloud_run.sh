#!/bin/bash

# Cloud Run Deployment Script
# ---------------------------

# Exit on error
set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api"}
REPOSITORY="servitec-map"
# Using Artifact Registry format
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}"
ENV_VARS_FILE=".env.production"
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
echo "   Servitec Map API - Cloud Run Deployment   "
echo "=============================================="
echo

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install it first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install it first."
    exit 1
fi

# Check if user is logged in to gcloud
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [ -z "$ACCOUNT" ]; then
    echo "You are not logged in to gcloud. Please login first:"
    gcloud auth login
fi

# Check if .env.production exists
if [ ! -f "$ENV_VARS_FILE" ]; then
    echo "Error: $ENV_VARS_FILE not found. Please create it first."
    exit 1
fi

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
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com

# Create Artifact Registry repository if it doesn't exist
echo "Checking if Artifact Registry repository exists..."
if ! gcloud artifacts repositories describe $REPOSITORY --location=$REGION &> /dev/null; then
    echo "Creating Artifact Registry repository..."
    gcloud artifacts repositories create $REPOSITORY \
        --repository-format=docker \
        --location=$REGION \
        --description="Repository for Servitec Map API"
fi

# Configure Docker to use gcloud credentials for Artifact Registry
echo "Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and tag Docker image
echo "Building Docker image..."
docker build -t $IMAGE_NAME -f Dockerfile.prod --no-cache .

# Push to Artifact Registry
echo "Pushing image to Artifact Registry..."
docker push $IMAGE_NAME

# Prepare environment variables using the Python helper
echo "Preparing environment variables..."
ENV_VARS_JSON=$(python3 prepare_env.py "$ENV_VARS_FILE")

# Deploy to Cloud Run with environment variables in JSON format
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
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
    --update-env-vars "$ENV_VARS_JSON"

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "API Documentation: $SERVICE_URL/docs"
echo "==============================================" 