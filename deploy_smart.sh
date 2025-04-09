#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Constants for deployment
PROJECT_ID="deep-responder-444017-h2"
REGION="us-central1"
SERVICE_NAME="servitec-map-api-smart"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
INSTANCE_CONNECTION_NAME="deep-responder-444017-h2:us-central1:map-view-servitec"
DB_HOST="172.24.48.3"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="servitec_map"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}     SMART DATABASE CONNECTION SCRIPT     ${NC}"
echo -e "${BLUE}============================================${NC}"

# Create a smart Node.js app that will try both connection methods
echo -e "${YELLOW}Creating smart database connector app...${NC}"
cat > smart_connector.js << 'EOL'
const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Check if running in Cloud Run
const isCloudRun = process.env.K_SERVICE ? true : false;
console.log('Running in Cloud Run:', isCloudRun);
console.log('Environment variables:', Object.keys(process.env).filter(key => !key.includes('SECRET')));

// Get connection info from environment
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT || '5432';

// Database access configuration
let connectionMethods = [];

// Method 1: VPC Connector with TCP connection
if (dbHost) {
  connectionMethods.push({
    name: 'vpc-connector',
    config: {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'servitec_map',
      host: dbHost,
      port: dbPort,
    }
  });
}

// Method 2: Cloud SQL Auth Proxy with Unix socket
if (instanceConnectionName && dbSocketPath) {
  connectionMethods.push({
    name: 'cloud-sql-proxy',
    config: {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'servitec_map',
      host: `${dbSocketPath}/${instanceConnectionName}`,
    }
  });
}

console.log(`Available connection methods (${connectionMethods.length}):`);
connectionMethods.forEach((method, index) => {
  console.log(`  ${index + 1}. ${method.name} - host: ${method.config.host}`);
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connectionMethods: connectionMethods.map(m => m.name),
    isCloudRun,
    env: {
      hasDbHost: !!dbHost,
      hasInstanceName: !!instanceConnectionName,
      hasSocketPath: !!dbSocketPath
    }
  });
});

// Test a specific connection method
async function testConnection(method) {
  const pool = new Pool(method.config);
  let result = { success: false, method: method.name };
  
  try {
    console.log(`Testing connection method: ${method.name}`);
    const client = await pool.connect();
    const queryResult = await client.query('SELECT NOW() as time');
    client.release();
    
    result.success = true;
    result.data = queryResult.rows[0];
    result.message = 'Connection successful';
    console.log(`Connection successful using ${method.name}:`, queryResult.rows[0]);
  } catch (err) {
    result.success = false;
    result.error = {
      message: err.message,
      detail: err.detail || 'No additional details'
    };
    console.error(`Connection failed using ${method.name}:`, err.message);
  }
  
  // End pool
  await pool.end().catch(err => console.error('Error ending pool:', err));
  return result;
}

// Database test endpoint
app.get('/db-test', async (req, res) => {
  console.log('DB test requested');
  
  if (connectionMethods.length === 0) {
    return res.status(500).json({
      status: 'error',
      message: 'No database connection methods configured',
      environment: {
        dbHost,
        dbPort,
        dbSocketPath,
        instanceConnectionName
      }
    });
  }
  
  // Test all methods and collect results
  const results = [];
  for (const method of connectionMethods) {
    results.push(await testConnection(method));
  }
  
  // Check if any method succeeded
  const anySuccess = results.some(r => r.success);
  
  if (anySuccess) {
    const successResult = results.find(r => r.success);
    res.status(200).json({
      status: 'success',
      message: `Database connection successful using ${successResult.method}`,
      data: successResult.data,
      allResults: results
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'All database connection methods failed',
      details: results
    });
  }
});

// Debug endpoint for environment variables
app.get('/debug', (req, res) => {
  console.log('Debug endpoint requested');
  
  res.status(200).json({
    environment: {
      K_SERVICE: process.env.K_SERVICE || 'not set',
      INSTANCE_CONNECTION_NAME: instanceConnectionName || 'not set',
      DB_SOCKET_PATH: dbSocketPath || 'not set',
      DB_HOST: dbHost || 'not set',
      DB_PORT: dbPort || 'not set',
      DB_USER: process.env.DB_USER || 'not set',
      DB_NAME: process.env.DB_NAME || 'not set',
      hasPassword: !!process.env.DB_PASSWORD,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    },
    connectionMethods: connectionMethods.map(m => ({
      name: m.name,
      host: m.config.host,
      database: m.config.database,
      user: m.config.user
    }))
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Routes: /health, /db-test, and /debug`);
});
EOL

# Create Dockerfile for the smart app
echo -e "${YELLOW}Creating Dockerfile for the smart app...${NC}"
cat > smart_dockerfile << 'EOL'
FROM node:18-alpine

WORKDIR /app

COPY minimal_package.json ./package.json
RUN npm install --only=production

COPY smart_connector.js ./app.js

EXPOSE 8080
CMD ["node", "app.js"]
EOL

# Check VPC connectors
echo -e "${YELLOW}Checking VPC connectors...${NC}"
VPC_CONNECTORS=$(gcloud compute networks vpc-access connectors list --region=${REGION} --format="json" | jq -r '.[] | "\(.name) - \(.state)"')

# Find a READY connector
echo -e "${YELLOW}Available VPC connectors:${NC}"
echo "$VPC_CONNECTORS"

READY_CONNECTOR=$(echo "$VPC_CONNECTORS" | grep "READY" | head -1 | awk '{print $1}')
if [ -n "$READY_CONNECTOR" ]; then
  echo -e "${GREEN}Using VPC connector: ${READY_CONNECTOR}${NC}"
  VPC_CONNECTOR_ARG="--vpc-connector=${READY_CONNECTOR}"
else
  echo -e "${YELLOW}No READY VPC connectors found. Will skip VPC connector.${NC}"
  VPC_CONNECTOR_ARG=""
fi

# Build and push the Docker image
echo -e "${YELLOW}Building Docker image for amd64 architecture...${NC}"
docker buildx create --use --name amd64builder || echo "Builder instance already exists"
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} -f smart_dockerfile --push .

if [ $? -ne 0 ]; then
  echo -e "${RED}Docker build failed.${NC}"
  exit 1
fi

# Deploy to Cloud Run with both connection options
echo -e "${YELLOW}Deploying to Cloud Run with both connection options...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --add-cloudsql-instances=${INSTANCE_CONNECTION_NAME} \
  ${VPC_CONNECTOR_ARG} \
  --set-env-vars=DB_SOCKET_PATH=/cloudsql,INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME},DB_HOST=${DB_HOST},DB_PORT=${DB_PORT},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_NAME=${DB_NAME}

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

# Test the debug endpoint first
echo -e "${YELLOW}Checking environment variables...${NC}"
echo -e "Executing: curl ${SERVICE_URL}/debug"
curl -s ${SERVICE_URL}/debug
echo ""

# Test the database connection
echo -e "${YELLOW}Testing the database connection...${NC}"
echo -e "Executing: curl ${SERVICE_URL}/db-test"
curl -s ${SERVICE_URL}/db-test
echo ""

echo -e "\n${YELLOW}View logs with:${NC}"
echo "gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --limit=50" 