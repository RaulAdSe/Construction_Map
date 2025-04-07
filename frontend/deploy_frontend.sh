#!/bin/bash

# Servitec Map Frontend - Production Deployment Script
# This deploys the frontend to Cloud Run

set -e

# Configuration variables
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-frontend"}
MIN_INSTANCES=${MIN_INSTANCES:-"0"}
MAX_INSTANCES=${MAX_INSTANCES:-"2"}
MEMORY=${MEMORY:-"512Mi"}
CPU=${CPU:-"1"}
TIMEOUT=${TIMEOUT:-"300"}
CONCURRENCY=${CONCURRENCY:-"80"}
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
    --update-env-vars "CORS_ORIGINS=$FRONTEND_URL"

# Create nginx configuration
echo "Creating Nginx configuration..."
cat > nginx.conf << EOF
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_min_length 256;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript application/vnd.ms-fontobject application/x-font-ttf font/opentype image/svg+xml image/x-icon;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ${BACKEND_URL} ${BACKEND_URL}/api/v1 https:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; media-src 'self' https:; worker-src 'self' blob:; frame-src 'self';";
    
    # Cache static assets
    location ~* \.(?:jpg|jpeg|gif|png|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    location ~* \.(?:css|js)$ {
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
    
    # Serve SPA for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Health check endpoint - Cloud Run requires this
    location = /health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 'ok';
    }

    # Explicit health check endpoint to avoid 404 errors in logs
    location = /_ah/health {
        access_log off;
        add_header Content-Type text/plain;
        return 200 'ok';
    }
}
EOF

# Create environment config file for build-time
echo "Creating environment configuration..."
cat > .env.production << EOF
REACT_APP_API_URL=${BACKEND_URL}/api/v1
GENERATE_SOURCEMAP=false
EOF

# Create a file to inject runtime env variables
cat > env.sh << EOF
#!/bin/sh
# Inject runtime environment variables
echo "window.RUNTIME_ENV = { REACT_APP_API_URL: '${BACKEND_URL}/api/v1' };" > /usr/share/nginx/html/env-config.js
# Start nginx
exec nginx -g 'daemon off;'
EOF

# Create Dockerfile
echo "Creating Dockerfile..."
cat > Dockerfile << EOF
# Build stage
FROM node:16-alpine AS build
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./
RUN npm ci

# Copy source code
COPY public/ ./public/
COPY src/ ./src/
COPY .env.production ./

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine
# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html
# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copy startup script
COPY env.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/env.sh

# Create a health check file
RUN echo "OK" > /usr/share/nginx/html/health

EXPOSE 8080
CMD ["/usr/local/bin/env.sh"]
EOF

# Create a temporary directory to hold build context
echo "Creating build context..."
mkdir -p deploy-context
cp package*.json deploy-context/
cp -r public deploy-context/
cp -r src deploy-context/
cp .env.production deploy-context/
cp nginx.conf deploy-context/
cp env.sh deploy-context/
cp Dockerfile deploy-context/

# Build and push container image
echo "Building and pushing container image..."
cd deploy-context
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME .
cd ..

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
    --timeout ${TIMEOUT}s \
    --port 8080 \
    --command="/usr/local/bin/env.sh" \
    --set-env-vars API_URL=${BACKEND_URL}

# Clean up
echo "Cleaning up..."
rm -rf deploy-context
rm -f nginx.conf Dockerfile env.sh .env.production

# Get URL
FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo
echo "=============================================="
echo "Servitec Map Frontend deployment completed successfully!"
echo "Frontend URL: $FRONTEND_URL"
echo "Backend API: $BACKEND_URL"
echo "==============================================" 