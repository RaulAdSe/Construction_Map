#!/bin/bash
# Cloud Run Deployment Script for IAM Authentication

# Variables
PROJECT_ID=deep-responder-444017-h2
REGION=us-central1
SERVICE_NAME=construction-map-backend
DB_INSTANCE=construction-map-db
DB_NAME=construction_map
SERVICE_ACCOUNT=servitec-map-service
STORAGE_BUCKET=construction-map-storage
VPC_CONNECTOR=cloudrun-sql-connector

echo "==== Cloud Run Deployment with IAM Authentication ===="

# Check if the Storage bucket exists, create if not
echo "Checking if storage bucket exists..."
if ! gsutil ls -b gs://$STORAGE_BUCKET &>/dev/null; then
  echo "Creating Cloud Storage bucket..."
  gsutil mb -l $REGION gs://$STORAGE_BUCKET
  # Make bucket publicly readable for file access
  gsutil iam ch allUsers:objectViewer gs://$STORAGE_BUCKET
else
  echo "Storage bucket already exists."
fi

# Verify IAM authentication is enabled on the Cloud SQL instance
echo "Verifying IAM authentication on Cloud SQL instance..."
IAM_AUTH=$(gcloud sql instances describe $DB_INSTANCE --format="value(settings.databaseFlags[].value)" | grep -i "on")
if [ -z "$IAM_AUTH" ]; then
  echo "Warning: IAM authentication may not be enabled on your Cloud SQL instance."
  echo "Consider enabling it with: gcloud sql instances patch $DB_INSTANCE --database-flags cloudsql.iam_authentication=on"
else
  echo "IAM authentication is enabled on the Cloud SQL instance."
fi

# Build and push the Docker image
echo "Building Docker image..."
IMAGE_NAME=gcr.io/$PROJECT_ID/$SERVICE_NAME:latest
docker build -t $IMAGE_NAME ./

echo "Pushing Docker image to Google Container Registry..."
docker push $IMAGE_NAME

# Grant the Cloud SQL Client role to the service account if needed
echo "Ensuring service account has Cloud SQL Client role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Deploy to Cloud Run with IAM authentication
echo "Deploying to Cloud Run with IAM authentication..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --service-account $SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances $PROJECT_ID:$REGION:$DB_INSTANCE \
  --vpc-connector $VPC_CONNECTOR \
  --vpc-egress private-ranges-only \
  --memory 1Gi \
  --cpu 1 \
  --set-env-vars "CLOUD_DB_ENABLED=true" \
  --set-env-vars "CLOUD_DB_IAM_AUTHENTICATION=true" \
  --set-env-vars "USE_CLOUD_STORAGE=true" \
  --set-env-vars "STORAGE_BUCKET=$STORAGE_BUCKET" \
  --set-env-vars "DB_NAME=$DB_NAME" \
  --set-env-vars "DB_CONNECTION_STRING=postgresql://app_user@localhost/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$DB_INSTANCE" \
  --update-secrets="SECRET_KEY=app-secret-key:latest" \
  --max-instances=5

# Verify deployment
echo "Deployment complete! Your service is now available at:"
URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo $URL

echo "You can check the logs with:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME\" --limit=20" 