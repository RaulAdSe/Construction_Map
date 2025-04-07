#!/bin/bash

# Servitec Map API - Final Production Deployment Script
# This deploys the full application to Cloud Run with VPC Connector and Cloud SQL

set -e

# Look for environment files in priority order
if [ -f .env.production ]; then
    echo "Loading environment variables from .env.production..."
    set -a # automatically export all variables
    source .env.production
    set +a
    ENV_FILE=".env.production"
elif [ -f .env ]; then
    echo "Loading environment variables from .env..."
    set -a # automatically export all variables
    source .env
    set +a
    ENV_FILE=".env"
elif [ -f ../.env.production ]; then
    echo "Loading environment variables from parent directory .env.production..."
    set -a # automatically export all variables
    source ../.env.production
    set +a
    ENV_FILE="../.env.production"
elif [ -f ../.env ]; then
    echo "Loading environment variables from parent directory .env..."
    set -a # automatically export all variables
    source ../.env
    set +a
    ENV_FILE="../.env"
else
    echo "No environment file found!"
    echo "Please create either .env or .env.production in the backend directory."
    exit 1
fi

echo "Using environment configuration from: $ENV_FILE"

# Set configuration variables from environment with fallbacks
# (only non-sensitive defaults are hardcoded)
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"5"}
MEMORY=${MEMORY:-"1Gi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}
SERVICE_ACCOUNT=${SERVICE_ACCOUNT}
VPC_CONNECTOR=${VPC_CONNECTOR}
CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE}
DB_PRIVATE_IP=${DB_HOST}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}

# Check if required variables are set
REQUIRED_VARS="DB_PASSWORD DB_HOST DB_NAME DB_USER SERVICE_ACCOUNT VPC_CONNECTOR CLOUD_SQL_INSTANCE"
MISSING_VARS=""

for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        MISSING_VARS="$MISSING_VARS $var"
    fi
done

if [ ! -z "$MISSING_VARS" ]; then
    echo "ERROR: The following required variables are missing from your environment file:"
    echo "$MISSING_VARS"
    echo "Please add them to your $ENV_FILE file."
    exit 1
fi

# Print banner
echo "=============================================="
echo "  Servitec Map API - Production Deployment  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy the full Servitec Map API to Cloud Run."
echo "Configuration:"
echo "  Environment File: $ENV_FILE"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  VPC Connector: $VPC_CONNECTOR"
echo "  Cloud SQL Instance: $CLOUD_SQL_INSTANCE"
echo "  Database IP: $DB_PRIVATE_IP"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create simplified environment file for Cloud Run deployment
ENV_YAML_FILE=".env.yaml"
cat > $ENV_YAML_FILE << EOF
# Generated environment variables for production deployment
ENVIRONMENT: "production"
DB_HOST: "$DB_PRIVATE_IP"
DB_PORT: "${DB_PORT:-5432}"
DB_NAME: "$DB_NAME"
DB_USER: "$DB_USER"
DB_PASS: "${DB_PASSWORD}"
CORS_ORIGINS: "${CORS_ORIGINS:-*}"
LOG_LEVEL: "${LOG_LEVEL:-INFO}"
SECRET_KEY: "${SECRET_KEY}"
EOF

echo "Created environment YAML file with ${DB_NAME} database connection"

# Create Cloud Build configuration
CONFIG_YAML="cloudbuild.final.yaml"
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
    --timeout $TIMEOUT \
    --service-account $SERVICE_ACCOUNT \
    --env-vars-file $ENV_YAML_FILE \
    --vpc-connector $VPC_CONNECTOR \
    --vpc-egress all-traffic \
    --add-cloudsql-instances $CLOUD_SQL_INSTANCE

# Clean up - for security, immediately remove files with sensitive information
rm -f $CONFIG_YAML $ENV_YAML_FILE

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Servitec Map API deployment completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "API Documentation: $SERVICE_URL/docs"
echo "==============================================" 