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
SERVICE_NAME="servitec-map-db-explorer"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
INSTANCE_CONNECTION_NAME="deep-responder-444017-h2:us-central1:map-view-servitec"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="servitec_map"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}    SERVITEC MAP DATABASE EXPLORER    ${NC}"
echo -e "${BLUE}============================================${NC}"

# Create Dockerfile for the explorer
echo -e "${YELLOW}Creating Dockerfile for the database explorer...${NC}"
cat > explorer_dockerfile << 'EOL'
FROM node:18-alpine

WORKDIR /app

COPY minimal_package.json ./package.json
RUN npm install --only=production

COPY db_explorer.js ./app.js

EXPOSE 8080
CMD ["node", "app.js"]
EOL

# Build and push the Docker image
echo -e "${YELLOW}Building Docker image for amd64 architecture...${NC}"
docker buildx create --use --name amd64builder || echo "Builder instance already exists"
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} -f explorer_dockerfile --push .

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
echo ""

# List all tables
echo -e "${YELLOW}Getting list of tables...${NC}"
echo -e "Executing: curl ${SERVICE_URL}/tables"
curl -s ${SERVICE_URL}/tables
echo ""

echo -e "\n${YELLOW}Your database explorer is now available at:${NC}"
echo -e "${GREEN}${SERVICE_URL}${NC}"
echo -e "\n${YELLOW}Available endpoints:${NC}"
echo -e "- ${SERVICE_URL}/health (Health check)"
echo -e "- ${SERVICE_URL}/db-test (Database connection test)"
echo -e "- ${SERVICE_URL}/tables (List all tables)"
echo -e "- ${SERVICE_URL}/tables/[table_name] (Get table schema and sample data)"
echo -e "- ${SERVICE_URL}/debug (Environment variables)"

echo -e "\n${YELLOW}View logs with:${NC}"
echo "gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --limit=50" 