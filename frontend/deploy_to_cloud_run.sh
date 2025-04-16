#!/bin/bash
set -e

# Configuration
PROJECT_ID="deep-responder-444017-h2"
REGION="us-central1"
SERVICE_NAME="construction-map-frontend"
REPOSITORY="us-central1-docker.pkg.dev/${PROJECT_ID}/construction-map"
IMAGE_NAME="frontend"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo "===== Deploying Construction Map Frontend to Cloud Run ====="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Ensure we're using the correct project
echo "Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Create Artifact Registry repository if it doesn't exist
echo "Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe construction-map \
    --location=${REGION} \
    --format="value(name)" >/dev/null 2>&1 || \
    gcloud artifacts repositories create construction-map \
    --repository-format=docker \
    --location=${REGION} \
    --description="Construction Map container repository"

# Configure Docker for Artifact Registry
echo "Configuring Docker for Artifact Registry..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Build and push image
echo "Building and pushing Docker image..."
gcloud builds submit --tag ${REPOSITORY}/${IMAGE_NAME}:${TIMESTAMP} .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image=${REPOSITORY}/${IMAGE_NAME}:${TIMESTAMP} \
    --platform=managed \
    --region=${REGION} \
    --allow-unauthenticated \
    --memory=1Gi \
    --cpu=1 \
    --port=80 \
    --min-instances=0 \
    --max-instances=3 \
    --ingress=all

# Get the URL of the deployed service
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")

echo "===== Deployment Complete ====="
echo "Frontend URL: ${SERVICE_URL}" 