#!/bin/bash

# Servitec Map Frontend - Production Deployment Script
# This deploys the frontend to Cloud Run

set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-frontend"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
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

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Get backend URL
echo "Retrieving backend URL..."
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --platform managed --region $REGION --format 'value(status.url)')

if [ -z "$BACKEND_URL" ]; then
    echo "ERROR: Could not retrieve backend URL. Make sure the backend service '$BACKEND_SERVICE' is deployed."
    exit 1
fi

echo "Backend URL: $BACKEND_URL"

# Update backend CORS settings to allow the frontend domain
echo "Updating backend CORS settings..."
# First, get the frontend URL if it already exists
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' 2>/dev/null || echo "")

# Set frontend URL to a placeholder if it doesn't exist yet
if [ -z "$FRONTEND_URL" ]; then
    # Use the expected URL format
    FRONTEND_URL="https://$SERVICE_NAME-$(gcloud config get-value project | tr : -).a.run.app"
    echo "Frontend URL not found, using expected URL format: $FRONTEND_URL"
fi

# Update backend CORS settings
echo "Updating backend CORS settings to include frontend URL: $FRONTEND_URL"
gcloud run services update $BACKEND_SERVICE \
    --platform managed \
    --region $REGION \
    --update-env-vars CORS_ORIGINS="$FRONTEND_URL"

# Build the application locally
echo "Building the React application..."
export REACT_APP_API_URL="${BACKEND_URL}/api/v1"
npm ci
npm run build

# Create a simple nginx.conf for Cloud Run
cat > nginx.conf << EOF
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    # Health check endpoint
    location = /health {
        access_log off;
        return 200 'ok';
    }

    # Serve static files
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Create a simple Dockerfile
cat > Dockerfile << EOF
FROM nginx:alpine
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
EOF

# Build and deploy with Cloud Run
echo "Building and deploying to Cloud Run..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run with minimal configuration
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory $MEMORY \
    --cpu $CPU \
    --port 8080 \
    --clear-command

# Clean up
echo "Cleaning up..."
rm -f nginx.conf Dockerfile

# Get URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Servitec Map Frontend deployment completed successfully!"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend API: $BACKEND_URL"
echo "==============================================" 