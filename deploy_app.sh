#!/bin/bash

# Servitec Map - Full Deployment Script
# This script deploys both backend and frontend to Google Cloud

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
echo_green() { echo -e "${GREEN}$1${NC}"; }
echo_blue() { echo -e "${BLUE}$1${NC}"; }
echo_yellow() { echo -e "${YELLOW}$1${NC}"; }
echo_red() { echo -e "${RED}$1${NC}"; }

# Banner
echo_blue "========================================"
echo_blue "      SERVITEC MAP DEPLOYMENT          "
echo_blue "========================================"

# Check if Google Cloud SDK is installed
if ! command -v gcloud &> /dev/null; then
    echo_red "Error: Google Cloud SDK is not installed."
    echo_yellow "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [[ -z "$ACCOUNT" ]]; then
    echo_yellow "You need to log in to Google Cloud first."
    gcloud auth login
fi

# Load environment variables
if [ -f .env.production ]; then
    echo_blue "Using .env.production for deployment"
    source .env.production
elif [ -f .env ]; then
    echo_yellow "WARNING: Using .env instead of .env.production"
    source .env
else
    echo_red "ERROR: No environment file found (.env.production or .env)"
    exit 1
fi

# Configuration variables with fallbacks
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${CLOUD_REGION:-"us-central1"}
BACKEND_SERVICE_NAME=${CLOUD_SERVICE_NAME:-"servitec-map-api"}
FRONTEND_SERVICE_NAME=${FRONTEND_SERVICE_NAME:-"servitec-map-frontend"}
VPC_CONNECTOR=${VPC_CONNECTOR:-"cloud-sql-connector"}
CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE:-"$PROJECT_ID:$REGION:map-view-servitec"}
DB_HOST=${DB_HOST:-"172.26.144.3"}  # Private IP of Cloud SQL instance
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"servitec_map"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-""}

# Validate required variables
if [[ -z "$DB_PASSWORD" ]]; then
    echo_red "ERROR: DB_PASSWORD environment variable is required"
    exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
    echo_red "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is required"
    exit 1
fi

# Display deployment configuration
echo_blue "Project ID:      $PROJECT_ID"
echo_blue "Region:          $REGION"
echo_blue "Backend Service: $BACKEND_SERVICE_NAME"
echo_blue "Frontend Service: $FRONTEND_SERVICE_NAME"
echo_blue "VPC Connector:   $VPC_CONNECTOR"
echo_blue "Cloud SQL:       $CLOUD_SQL_INSTANCE"
echo_blue "DB Host:         $DB_HOST"
echo_blue "DB Name:         $DB_NAME"
echo_blue "DB User:         $DB_USER"
MASKED_PW="${DB_PASSWORD:0:2}***${DB_PASSWORD: -2}"
echo_blue "DB Password:     $MASKED_PW (${#DB_PASSWORD} chars)"
echo_blue "========================================"

# Confirm deployment
read -p "Do you want to proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo_yellow "Deployment cancelled."
    exit 0
fi

# Set Google Cloud project
echo_blue "Setting Google Cloud project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo_blue "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com vpcaccess.googleapis.com secretmanager.googleapis.com

# Deploy Backend
echo_blue "========================================"
echo_blue "Deploying Backend API Service"
echo_blue "========================================"

# Create Cloud Build config for backend
echo "Creating Cloud Build configuration YAML for backend..."
cat > backend/cloudbuild.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME', '-f', 'Dockerfile.prod', '.']
images:
  - 'gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME'
EOF

# Submit backend build
echo_blue "Building backend container image..."
(cd backend && gcloud builds submit --config cloudbuild.yaml)

# Deploy backend to Cloud Run
echo_blue "Deploying backend to Cloud Run..."
gcloud run deploy "$BACKEND_SERVICE_NAME" \
    --image "gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --memory "1Gi" \
    --cpu "1" \
    --timeout "300s" \
    --concurrency "80" \
    --min-instances "0" \
    --max-instances "5" \
    --set-env-vars="DB_HOST=$DB_HOST,DB_PORT=$DB_PORT,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,CLOUD_SQL_INSTANCE=$CLOUD_SQL_INSTANCE,ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,CLOUD_SQL_USE_PRIVATE_IP=true,CORS_ORIGINS=*" \
    --vpc-connector "$VPC_CONNECTOR" \
    --vpc-egress all-traffic \
    --allow-unauthenticated \
    --add-cloudsql-instances "$CLOUD_SQL_INSTANCE"

# Deploy Frontend (optional)
if [[ -d "frontend" ]]; then
    echo_blue "========================================"
    echo_blue "Deploying Frontend Service"
    echo_blue "========================================"
    
    # Get backend URL for frontend configuration
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
    
    # Create environment file for frontend
    echo "Creating environment file for frontend build..."
    cat > frontend/.env.production << EOF
NEXT_PUBLIC_API_URL=$BACKEND_URL
NEXT_PUBLIC_ENVIRONMENT=production
EOF
    
    # Build frontend
    echo_blue "Building frontend application..."
    (cd frontend && npm install && npm run build)
    
    # Create Cloud Build config for frontend
    echo "Creating Cloud Build configuration YAML for frontend..."
    cat > frontend/cloudbuild.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME', '-f', 'Dockerfile.prod', '.']
images:
  - 'gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME'
EOF
    
    # Submit frontend build
    echo_blue "Building frontend container image..."
    (cd frontend && gcloud builds submit --config cloudbuild.yaml)
    
    # Deploy frontend to Cloud Run
    echo_blue "Deploying frontend to Cloud Run..."
    gcloud run deploy "$FRONTEND_SERVICE_NAME" \
        --image "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME" \
        --platform managed \
        --region "$REGION" \
        --memory "512Mi" \
        --cpu "1" \
        --concurrency "80" \
        --min-instances "0" \
        --max-instances "5" \
        --allow-unauthenticated
fi

# Clean up sensitive files
echo_blue "Cleaning up sensitive files..."
rm -f backend/cloudbuild.yaml
if [[ -f "frontend/cloudbuild.yaml" ]]; then
    rm -f frontend/cloudbuild.yaml
fi

# Get service URLs
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo_green "Backend API deployment complete! Service is running at: $BACKEND_URL"
echo_green "Health Check: ${BACKEND_URL}/health"
echo_green "API Documentation: ${BACKEND_URL}/docs"

if [[ -d "frontend" ]]; then
    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
    echo_green "Frontend deployment complete! Service is running at: $FRONTEND_URL"
fi

echo_green "========================================" 
echo_green "      DEPLOYMENT COMPLETE!             "
echo_green "========================================" 