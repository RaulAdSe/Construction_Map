#!/bin/bash

# Servitec Map Frontend - Production Deployment Script
# This deploys the frontend to Cloud Run

set -e

# Function for colored output
echo_blue() {
  echo -e "\e[34m$1\e[0m"
}

echo_green() {
  echo -e "\e[32m$1\e[0m"
}

echo_yellow() {
  echo -e "\e[33m$1\e[0m"
}

echo_red() {
  echo -e "\e[31m$1\e[0m"
}

# Load environment variables
if [ -f ".env.production" ]; then
  source .env.production
  echo_blue "Loaded environment variables from .env.production"
elif [ -f ".env" ]; then
  source .env
  echo_blue "Loaded environment variables from .env"
fi

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-frontend"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
BACKEND_SERVICE=${BACKEND_SERVICE:-"servitec-map-api"}

# Print banner
echo_blue "=============================================="
echo_blue "  Servitec Map Frontend - Production Deployment  "
echo_blue "=============================================="
echo

# Confirm deployment
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
    echo_red "ERROR: Could not retrieve backend URL. Make sure the backend service '$BACKEND_SERVICE' is deployed."
    exit 1
fi

echo_green "Backend URL: $BACKEND_URL"

# Update backend CORS settings to allow the frontend domain
echo "Updating backend CORS settings..."
# First, get the frontend URL if it already exists
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' 2>/dev/null || echo "")

# Set frontend URL to a placeholder if it doesn't exist yet
if [ -z "$FRONTEND_URL" ]; then
    # Use the expected URL format
    FRONTEND_URL="https://$SERVICE_NAME-$(gcloud config get-value project | tr : -).a.run.app"
    echo_yellow "Frontend URL not found, using expected URL format: $FRONTEND_URL"
fi

# Update backend CORS settings
echo "Updating backend CORS settings to include frontend URL: $FRONTEND_URL"
gcloud run services update $BACKEND_SERVICE \
    --platform managed \
    --region $REGION \
    --update-env-vars CORS_ORIGINS="*"

# Move to frontend directory if needed
if [ ! -f "package.json" ]; then
    if [ -d "frontend" ]; then
        cd frontend
        echo_blue "Changed directory to frontend/"
    else
        echo_red "ERROR: Could not find frontend directory or package.json"
        exit 1
    fi
fi

# Update .env.production with the correct API URL
echo "Updating .env.production with backend URL..."
if [ -f ".env.production" ]; then
    # Check if NEXT_PUBLIC_API_URL is already set
    if grep -q "NEXT_PUBLIC_API_URL" .env.production; then
        # Update the existing line
        sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$BACKEND_URL|g" .env.production
    else
        # Add it if it doesn't exist
        echo "NEXT_PUBLIC_API_URL=$BACKEND_URL" >> .env.production
    fi
    echo_green "Updated .env.production with backend URL: $BACKEND_URL"
else
    # Create .env.production if it doesn't exist
    echo "NEXT_PUBLIC_API_URL=$BACKEND_URL" > .env.production
    echo "NEXT_PUBLIC_ENVIRONMENT=production" >> .env.production
    echo_yellow "Created new .env.production with backend URL: $BACKEND_URL"
fi

# Build the application
echo_blue "Building the React application..."
echo "Installing dependencies..."
npm ci

echo "Building production version..."
npm run build

# Create a simple nginx.conf for Cloud Run
echo "Creating nginx configuration..."
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
    location /api/ {
        # Ensure the full path is passed to the backend
        proxy_pass ${BACKEND_URL}/api/;
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

    # Proxy health check endpoint to backend
    location /health-backend {
        proxy_pass ${BACKEND_URL}/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$proxy_host;
    }

    # Proxy db-test endpoint to backend for diagnostics
    location /db-test {
        proxy_pass ${BACKEND_URL}/db-test;
        proxy_http_version 1.1;
        proxy_set_header Host \$proxy_host;
    }

    # Serve static files with proper caching
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Serve index.html for all routes (React routing)
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF
echo_green "Nginx configuration created"

# Create a Dockerfile for the frontend
echo "Creating Dockerfile..."
cat > Dockerfile << EOF
FROM nginx:alpine

# Copy built React app
COPY build/ /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 for Cloud Run
EXPOSE 8080

# Start Nginx and keep it in the foreground
CMD ["nginx", "-g", "daemon off;"]
EOF
echo_green "Dockerfile created"

# Build and deploy with Cloud Run
echo_blue "Building and deploying to Cloud Run..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy to Cloud Run with configuration
echo_blue "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory $MEMORY \
    --cpu $CPU

# Get deployed URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

# Clean up
echo "Cleaning up temporary files..."
rm -f nginx.conf Dockerfile

# Final output
echo_blue "=============================================="
echo_green "Servitec Map Frontend deployment completed successfully!"
echo_green "Frontend URL: $FRONTEND_URL"
echo_green "Backend API: $BACKEND_URL"
echo_blue "=============================================="
echo
echo "You can access the application at: $FRONTEND_URL"
echo "You can check the backend health at: $FRONTEND_URL/health-backend"
echo "You can test the database connection at: $FRONTEND_URL/db-test"
echo_blue "==============================================" 