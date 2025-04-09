#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Constants for deployment
PROJECT_ID="deep-responder-444017-h2"
REGION="us-central1"
SERVICE_NAME="servitec-map-api-minimal"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
INSTANCE_CONNECTION_NAME="deep-responder-444017-h2:us-central1:map-view-servitec"
DB_HOST="172.24.48.3"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="servitec_map"

# Check if we have a working VPC connector
echo -e "${YELLOW}Checking VPC connectors...${NC}"
VPC_CONNECTORS=$(gcloud compute networks vpc-access connectors list --region=${REGION} --format="json" | jq -r '.[] | "\(.name) - \(.state)"')

# Find a READY connector
echo -e "${YELLOW}Available VPC connectors:${NC}"
echo "$VPC_CONNECTORS"

READY_CONNECTOR=$(echo "$VPC_CONNECTORS" | grep "READY" | head -1 | awk '{print $1}')
if [ -z "$READY_CONNECTOR" ]; then
  echo -e "${RED}No READY VPC connectors found. Exiting.${NC}"
  exit 1
fi

echo -e "${GREEN}Using VPC connector: ${READY_CONNECTOR}${NC}"
VPC_CONNECTOR=$READY_CONNECTOR

# Build and push the Docker image
echo -e "${YELLOW}Building Docker image for amd64 architecture...${NC}"
docker buildx create --use --name amd64builder || echo "Builder instance already exists"
docker buildx build --platform linux/amd64 -t ${IMAGE_NAME} -f minimal_dockerfile --push .

if [ $? -ne 0 ]; then
  echo -e "${RED}Docker build failed.${NC}"
  exit 1
fi

# Deploy to Cloud Run
echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image=${IMAGE_NAME} \
  --platform=managed \
  --region=${REGION} \
  --allow-unauthenticated \
  --vpc-connector=${VPC_CONNECTOR} \
  --set-env-vars=DB_HOST=${DB_HOST},DB_PORT=${DB_PORT},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD},DB_NAME=${DB_NAME}

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

echo -e "\n${YELLOW}View logs with:${NC}"
echo "gcloud run services logs read ${SERVICE_NAME} --region=${REGION} --limit=50" 