#!/bin/bash

# Servitec Map API - Node.js Express Deployment Script
# This deploys the Node.js Express application to Cloud Run with Cloud SQL Auth Proxy

set -e

# Set color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print with colors
echo_green() { echo -e "${GREEN}$1${NC}"; }
echo_blue() { echo -e "${BLUE}$1${NC}"; }
echo_yellow() { echo -e "${YELLOW}$1${NC}"; }
echo_red() { echo -e "${RED}$1${NC}"; }

# Load environment variables
if [ -f ".env.production" ]; then
  source .env.production
  echo_blue "Loaded environment variables from .env.production"
elif [ -f ".env" ]; then
  source .env
  echo_blue "Loaded environment variables from .env"
fi

# Check if PROJECT_ID is set
if [ -z "$PROJECT_ID" ]; then
  echo_red "ERROR: PROJECT_ID is not defined. Please set it in .env file or export it."
  exit 1
fi

# Essential configuration variables with fallbacks
PROJECT_ID=${PROJECT_ID:-"deep-responder-444017-h2"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME=${SERVICE_NAME:-"servitec-map-api"}
CONNECTOR_NAME=${CONNECTOR_NAME:-"cloudrun-sql-connector"}
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"map-service-account@${PROJECT_ID}.iam.gserviceaccount.com"}

# Cloud SQL settings
DB_INSTANCE=${DB_INSTANCE:-"map-view-servitec"}
DB_REGION=${DB_REGION:-"us-central1"}
CLOUD_SQL_CONNECTION_NAME="${PROJECT_ID}:${DB_REGION}:${DB_INSTANCE}"
DB_NAME=${DB_NAME:-"servitec_map"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"postgres"}
DB_SOCKET_PATH=${DB_SOCKET_PATH:-"/cloudsql"}

# Print deployment banner
echo "========================================"
echo "   DEPLOYING NODE.JS APP TO CLOUD RUN  "
echo "========================================"

# Print configuration
echo "Project ID:      $PROJECT_ID"
echo "Region:          $REGION"
echo "Service Name:    $SERVICE_NAME"
echo "Connection Type: Cloud SQL Auth Proxy (Unix Socket)"
echo "Socket Path:     $DB_SOCKET_PATH"
echo "Instance Name:   $CLOUD_SQL_CONNECTION_NAME"
echo "DB Name:         $DB_NAME"
echo "DB User:         $DB_USER"
echo "DB Password:     ${DB_PASSWORD:0:2}***${DB_PASSWORD: -2} (${#DB_PASSWORD} chars)"
echo "Service Account: $SERVICE_ACCOUNT"
echo "========================================"

# Set Google Cloud project
echo "Setting Google Cloud project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required services
echo "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com sqladmin.googleapis.com

# Create temporary package.json with all required dependencies
echo "Creating complete package.json with all dependencies..."
cat > temp_package.json << EOF
{
  "name": "servitec-map-api",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.js",
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "cors": "^2.8.5",
    "morgan": "^1.10.0",
    "helmet": "^7.0.0",
    "dotenv": "^16.0.3"
  },
  "scripts": {
    "start": "node src/index.js"
  }
}
EOF

# Create a patched db-test route for fixed socket connection
echo "Creating a patched db-test router..."
mkdir -p temp_src/routes
cp -r src/* temp_src/
cp .env.production temp_src/ || echo_yellow "No .env.production file found to copy"

cat > temp_src/routes/db-test.js << EOF
/**
 * Database test route for Servitec Map API
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env.production or .env
const envProdPath = path.resolve(process.cwd(), '.env.production');
if (fs.existsSync(envProdPath)) {
  console.log('Loading environment variables from .env.production');
  dotenv.config({ path: envProdPath });
} else {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('Loading environment variables from .env');
    dotenv.config({ path: envPath });
  } else {
    console.log('No .env or .env.production file found, using environment variables as is');
  }
}

// Use db-socket directly to ensure socket connection in Cloud Run
const dbSocket = require('../db-socket');
const pool = dbSocket.pool;
console.log('Using socket connection for database tests');

// Database test endpoint
router.get('/', async (req, res) => {
  console.log('Received request to /db-test endpoint in routes/db-test.js');
  let client;
  
  try {
    console.log('Attempting to connect to database...');
    client = await pool.connect();
    console.log('Successfully connected to database');
    
    const result = await client.query('SELECT NOW() as time');
    console.log('Query executed successfully:', result.rows[0]);
    
    return res.json({
      status: 'success',
      message: 'Database connection successful',
      data: {
        time: result.rows[0].time,
        environment: process.env.K_SERVICE ? 'Cloud Run' : 'Local',
        connectionType: process.env.CLOUD_SQL_CONNECTION_NAME ? 'Cloud SQL Auth Proxy' : 'TCP',
        database: process.env.DB_NAME
      }
    });
  } catch (err) {
    console.error('Database connection error:', err);
    
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details',
        config: {
          host: process.env.K_SERVICE ? 'Unix Socket' : process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME,
          user: process.env.DB_USER
        }
      }
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
EOF

# Create Dockerfile that installs all required dependencies
echo "Creating Dockerfile with all dependencies..."
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app

# Copy our enhanced package.json
COPY temp_package.json ./package.json

# Install dependencies
RUN npm install

# Copy patched application code
COPY temp_src/ ./src/

# Start the application
CMD ["node", "src/index.js"]
EOF

# Create Cloud Build configuration YAML
echo "Creating Cloud Build configuration YAML..."
cat > cloudbuild.yaml << EOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/$SERVICE_NAME', '.']
images:
  - 'gcr.io/$PROJECT_ID/$SERVICE_NAME'
EOF

# Build the Docker image
echo_blue "Building Docker image..."
gcloud builds submit --config=cloudbuild.yaml

# Grant Cloud SQL Client role to service account
echo_blue "Checking service account permissions..."
# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo_blue "Creating service account $SERVICE_ACCOUNT..."
    gcloud iam service-accounts create "${SERVICE_ACCOUNT%%@*}" \
        --display-name="Map Service Account for Cloud Run"
fi

# Grant Cloud SQL Client role to service account
echo_blue "Granting Cloud SQL Client role to service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.client"

# Deploy to Cloud Run
echo_blue "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "CLOUD_SQL_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME,DB_SOCKET_PATH=$DB_SOCKET_PATH,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,NODE_ENV=production" \
  --add-cloudsql-instances $CLOUD_SQL_CONNECTION_NAME \
  --vpc-connector $CONNECTOR_NAME \
  --service-account $SERVICE_ACCOUNT

# Get the deployed service URL
URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo_green "Deployment complete! Service is running at: $URL"

# Wait for the service to initialize
echo "Waiting for service to initialize (30 seconds)..."
sleep 30

# Test the health endpoint
echo "Testing health endpoint: $URL/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")
HEALTH_DATA=$(curl -s "$URL/health")
echo "Health check returned HTTP $HEALTH_RESPONSE"
echo "Health check data: $HEALTH_DATA"

# Test the database connection
echo "Testing database connection: $URL/db-test"
DB_RESPONSE_CODE=$(curl -s -o db_response.txt -w "%{http_code}" "$URL/db-test")
DB_RESPONSE=$(cat db_response.txt)
echo "Database connection test HTTP status: $DB_RESPONSE_CODE"
echo "Database connection test response: $DB_RESPONSE"

if [[ "$DB_RESPONSE" == *"success"* ]]; then
  echo_green "Database connection test successful! Response: $DB_RESPONSE"
else
  echo_yellow "Database connection test failed. Response: $DB_RESPONSE"
  echo "View logs with: gcloud run services logs read $SERVICE_NAME --region=$REGION"
fi

# Clean up temporary files
rm -f cloudbuild.yaml db_response.txt Dockerfile temp_package.json
rm -rf temp_src

echo "========================================"
echo "      DEPLOYMENT COMPLETE               "
echo "========================================"
echo "Service URL:    $URL"
echo "Health Check:   $URL/health"
echo "DB Test:        $URL/db-test"
echo "========================================" 