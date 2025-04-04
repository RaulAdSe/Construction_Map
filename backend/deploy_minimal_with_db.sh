#!/bin/bash

# Minimal App with Database Deployment Script
# This deploys a minimal FastAPI app with database connectivity to Cloud SQL

set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api-with-db"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"2"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"map-service-account@deep-responder-444017-h2.iam.gserviceaccount.com"}
VPC_CONNECTOR=${VPC_CONNECTOR:-"cloudrun-sql-connector"}
CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE:-"deep-responder-444017-h2:us-central1:map-view-servitec"}
DB_PRIVATE_IP=${DB_PRIVATE_IP:-"172.26.144.3"}
DB_NAME=${DB_NAME:-"servitec_map"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"H6o\$-Tt6U@>oBIfU"}

# Print banner
echo "=============================================="
echo "  Minimal FastAPI Deployment with Database  "
echo "=============================================="
echo

# Confirm deployment
echo "This script will deploy a minimal FastAPI app with database connectivity."
echo "Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service Name: $SERVICE_NAME"
echo "  Memory: $MEMORY"
echo "  CPU: $CPU"
echo "  VPC Connector: $VPC_CONNECTOR"
echo "  Cloud SQL Instance: $CLOUD_SQL_INSTANCE"
echo "  Database IP (Private): $DB_PRIVATE_IP"
echo
read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create environment variables YAML file - using private IP for Cloud SQL connection
ENV_YAML_FILE=".env.yaml"
cat > $ENV_YAML_FILE << EOF
# Generated environment variables for deployment
DB_HOST: "$DB_PRIVATE_IP"
DB_PORT: "5432"
DB_NAME: "$DB_NAME"
DB_USER: "$DB_USER"
DB_PASS: "${DB_PASSWORD}"
DATABASE_URL: "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_PRIVATE_IP}:5432/${DB_NAME}"
EOF

echo "Created environment YAML file for database connection"

# Create a temporary Dockerfile
TEMP_DOCKERFILE="Dockerfile.minimal.db"
cat > $TEMP_DOCKERFILE << EOF
FROM python:3.11-slim

WORKDIR /app

# Install required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq-dev gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir fastapi uvicorn sqlalchemy psycopg2-binary

# Copy the minimal app with DB
COPY minimal_app_with_db.py /app/

# Set the port
ENV PORT=8080

# Create a non-root user
RUN useradd -m appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Run the app
CMD ["python", "minimal_app_with_db.py"]
EOF

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com

# Create Cloud Build config
cat > cloudbuild.db.yaml << EOF
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
gcloud builds submit --config cloudbuild.db.yaml .

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
    --service-account $SERVICE_ACCOUNT \
    --env-vars-file $ENV_YAML_FILE \
    --vpc-connector $VPC_CONNECTOR \
    --vpc-egress all-traffic \
    --add-cloudsql-instances $CLOUD_SQL_INSTANCE

# Clean up
rm -f $TEMP_DOCKERFILE cloudbuild.db.yaml $ENV_YAML_FILE

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Minimal deployment with database completed successfully!"
echo "Service URL: $SERVICE_URL"
echo "Health Check: $SERVICE_URL/health"
echo "Test: $SERVICE_URL/api/v1/test"
echo "Debug: $SERVICE_URL/api/v1/debug"
echo "==============================================" 