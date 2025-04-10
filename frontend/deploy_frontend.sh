#!/bin/bash

# Servitec Map Frontend - Production Deployment Script
# This deploys the frontend to Cloud Run

set -e

# Configuration variables - Load from environment if available
if [ -f ".env.production" ]; then
  source .env.production
  echo "Loaded environment variables from .env.production"
elif [ -f ".env" ]; then
  source .env
  echo "Loaded environment variables from .env"
fi

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
# Save to .env.production for the build
echo "REACT_APP_API_URL=${BACKEND_URL}/api/v1" > .env.production.build
echo "REACT_APP_ENVIRONMENT=production" >> .env.production.build

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
    --update-env-vars CORS_ORIGINS="*"

# Build the application locally
echo "Building the React application..."
# Create a .env file for the build process with the appropriate API URL
echo "REACT_APP_API_URL=${BACKEND_URL}/api/v1" > .env.production.build
echo "REACT_APP_ENVIRONMENT=production" >> .env.production.build
cp .env.production.build .env.production
cp .env.production.build .env

# Install dependencies and build
echo "Installing dependencies..."
npm ci

echo "Building application..."
npm run build

# Verify that build completed successfully
if [ ! -d "build" ]; then
    echo "ERROR: Build directory not found. The build may have failed."
    exit 1
fi

echo "Build completed successfully."

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

    # Proxy API requests to avoid CORS issues
    # Match the specific API prefix used by the frontend
    location /api/v1/ {
        # Ensure the full path is passed to the backend
        proxy_pass ${BACKEND_URL}/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        # Send the correct host header (backend's hostname)
        proxy_set_header Host \$proxy_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Increase timeouts for longer requests
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
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
    --command="nginx" \
    --args="-g,daemon off;"

# Clean up
echo "Cleaning up..."
rm -f nginx.conf Dockerfile .env.production.build

# Test the frontend health endpoint
echo "Testing frontend health endpoint..."
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/health")

if [ "$HEALTH_RESPONSE" == "200" ]; then
    echo "Frontend health check: SUCCESS (HTTP 200)"
else
    echo "Frontend health check: FAILED (HTTP $HEALTH_RESPONSE)"
    echo "The frontend may not be functioning correctly. Check the logs."
fi

echo
echo "=============================================="
echo "Servitec Map Frontend deployment completed successfully!"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend API: $BACKEND_URL"
echo
echo "To view the frontend logs, run:"
echo "gcloud run services logs read $SERVICE_NAME --region $REGION"
echo "==============================================" 