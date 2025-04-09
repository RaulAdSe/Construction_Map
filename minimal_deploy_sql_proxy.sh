#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Constants for deployment
PROJECT_ID="deep-responder-444017-h2"
REGION="us-central1"
SERVICE_NAME="servitec-map-api-proxy"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
INSTANCE_CONNECTION_NAME="deep-responder-444017-h2:us-central1:map-view-servitec"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="servitec_map"

# Update the database connector for Cloud SQL Auth Proxy
echo -e "${YELLOW}Updating db_connector.js for Cloud SQL Auth Proxy...${NC}"
cat > db_connector_proxy.js << 'EOL'
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Check if running in Cloud Run with Cloud SQL Auth Proxy
const isCloudRun = process.env.K_SERVICE ? true : false;
console.log('Running in Cloud Run:', isCloudRun);

// Get connection info from environment
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

// Determine connection config based on environment
let dbConfig;
let connectionType;

if (isCloudRun && instanceConnectionName) {
  // Use Cloud SQL Auth Proxy with Unix socket when in Cloud Run
  connectionType = 'Unix Socket';
  dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'servitec_map',
    host: `${dbSocketPath}/${instanceConnectionName}`,
  };
} else {
  // Use TCP connection when running locally
  connectionType = 'TCP';
  dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'servitec_map',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '5432',
  };
}

// Create a new pool
const pool = new Pool(dbConfig);

console.log('Connection type:', connectionType);
console.log('Connection config:', {
  ...dbConfig,
  password: '********',
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connectionType
  });
});

// Database test endpoint
app.get('/db-test', async (req, res) => {
  console.log('DB test requested');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    console.log('Database query successful:', result.rows[0]);
    
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
      data: result.rows[0],
      connectionType,
      connection: {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  } catch (err) {
    console.error('Database connection error:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      connectionType,
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details'
      },
      connection: {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  }
});

// Debug endpoint for environment variables
app.get('/debug', (req, res) => {
  console.log('Debug endpoint requested');
  res.status(200).json({
    environment: {
      K_SERVICE: process.env.K_SERVICE || 'not set',
      INSTANCE_CONNECTION_NAME: process.env.INSTANCE_CONNECTION_NAME || 'not set',
      DB_SOCKET_PATH: process.env.DB_SOCKET_PATH || 'not set',
      DB_USER: process.env.DB_USER || 'not set',
      DB_NAME: process.env.DB_NAME || 'not set',
      hasPassword: !!process.env.DB_PASSWORD,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    },
    connectionType,
    connectionHost: dbConfig.host
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Routes: /health, /db-test, and /debug`);
});
EOL

# Update Dockerfile for the proxy approach
echo -e "${YELLOW}Updating Dockerfile for Cloud SQL Auth Proxy...${NC}"
cat > minimal_dockerfile_proxy << 'EOL'
FROM node:18-alpine

WORKDIR /app

COPY minimal_package.json ./package.json
RUN npm install --only=production

COPY db_connector_proxy.js ./app.js

EXPOSE 8080
CMD ["node", "app.js"]
EOL

# Build and push the Docker image
echo -e "${YELLOW}Building Docker image for amd64 architecture...${NC}"
docker buildx create --use --name amd64builder || echo "Builder instance already exists"
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} -f minimal_dockerfile_proxy --push .

if [ $? -ne 0 ]; then
  echo -e "${RED}Docker build failed.${NC}"
  exit 1
fi

# Deploy to Cloud Run with Cloud SQL Auth Proxy
echo -e "${YELLOW}Deploying to Cloud Run with Cloud SQL Auth Proxy...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances=${INSTANCE_CONNECTION_NAME} \
  --set-env-vars=DB_SOCKET_PATH=/cloudsql,INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_NAME=${DB_NAME}

if [ $? -ne 0 ]; then
  echo -e "${RED}Deployment failed.${NC}"
  exit 1
fi

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region=${REGION} --format="value(status.url)")
echo -e "${GREEN}Deployment successful!${NC}"
echo -e "Service URL: ${SERVICE_URL}"

# Test the health endpoint
echo -e "${YELLOW}Testing the health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" ${SERVICE_URL}/health)

if [ "$HEALTH_RESPONSE" == "200" ]; then
  echo -e "${GREEN}Health check passed!${NC}"
else
  echo -e "${RED}Health check failed with status code: ${HEALTH_RESPONSE}${NC}"
fi

# Wait a moment for the service to be fully ready
echo -e "${YELLOW}Waiting 10 seconds for service to be fully ready...${NC}"
sleep 10

# Test the database connection
echo -e "${YELLOW}Testing the database connection...${NC}"
echo -e "Executing: curl ${SERVICE_URL}/db-test"
curl -s ${SERVICE_URL}/db-test

# Check the environment variables
echo -e "${YELLOW}Checking environment variables...${NC}"
echo -e "Executing: curl ${SERVICE_URL}/debug"
curl -s ${SERVICE_URL}/debug

echo -e "\n${YELLOW}View logs with:${NC}"
echo "gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --limit=50" 