#!/bin/bash
# Script to grant all necessary IAM roles to the service account

# Set variables
PROJECT_ID="deep-responder-444017-h2"
SERVICE_ACCOUNT="servitec-map-service@$PROJECT_ID.iam.gserviceaccount.com"

echo "=== Granting IAM roles to service account ==="
echo "Project: $PROJECT_ID"
echo "Service account: $SERVICE_ACCOUNT"

# Cloud SQL roles
echo "Granting Cloud SQL roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.instanceUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.admin"

# Storage roles
echo "Granting Cloud Storage roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/storage.objectAdmin"

# Necessary service account roles
echo "Granting Service Account roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/iam.serviceAccountUser"

# Secret Manager roles for accessing secrets
echo "Granting Secret Manager roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"

echo "All IAM roles have been granted!" 