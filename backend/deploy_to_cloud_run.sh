#!/bin/bash
# Cloud Run Deployment Script

# Variables
PROJECT_ID=deep-responder-444017-h2
REGION=us-central1
SERVICE_NAME=construction-map-backend
DB_INSTANCE=construction-map-db
DB_NAME=construction_map
SERVICE_ACCOUNT=cloud-run-backend-sa
STORAGE_BUCKET=construction-map-storage  # Create this if it doesn't exist

# Build and push the Docker image
echo "Building and pushing Docker image..."
IMAGE_NAME=gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# Build the image
docker build -t $IMAGE_NAME ./

# Push to Google Container Registry
docker push $IMAGE_NAME

# Create the Cloud Storage bucket if it doesn't exist
echo "Ensuring Cloud Storage bucket exists..."
gsutil ls -b gs://$STORAGE_BUCKET || gsutil mb -l $REGION gs://$STORAGE_BUCKET

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --service-account $SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances $PROJECT_ID:$REGION:$DB_INSTANCE \
  --set-env-vars "CLOUD_DB_ENABLED=true" \
  --set-env-vars "USE_CLOUD_STORAGE=true" \
  --set-env-vars "STORAGE_BUCKET=$STORAGE_BUCKET" \
  --set-env-vars "DB_CONNECTION_STRING=postgresql://app_user:PASSWORD@localhost/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$DB_INSTANCE" \
  --update-secrets="SECRET_KEY=app-secret-key:latest"

echo "Deployment complete! Your service is now available at:"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)' 