# Cloud Deployment Guide

This guide explains how to deploy the Construction Map application to Google Cloud Platform.

## Prerequisites

1. Google Cloud SDK installed and authenticated
2. Docker installed for building and pushing images
3. Access to Google Cloud project with necessary permissions
4. Created resources:
   - Cloud SQL PostgreSQL instance named `construction-map-db`
   - Service account `cloud-run-backend-sa` with proper permissions
   - Secret Manager secrets for database credentials and app secrets

## Deployment Steps

### 1. Configure Environment

Update the deployment script variables in `deploy_to_cloud_run.sh`:

```bash
PROJECT_ID=deep-responder-444017-h2  # Your GCP project ID
REGION=us-central1                  # Your preferred region
SERVICE_NAME=construction-map-backend
DB_INSTANCE=construction-map-db
DB_NAME=construction_map
SERVICE_ACCOUNT=cloud-run-backend-sa
STORAGE_BUCKET=construction-map-storage
```

### 2. Create Secret Manager Secrets

Ensure you have created the necessary secrets in Secret Manager:

```bash
# Create a secret for app encryption key
echo "your-secure-key-here" | gcloud secrets create app-secret-key --data-file=-

# Create a secret for database password (if needed)
echo "your-database-password" | gcloud secrets create db-password --data-file=-
```

### 3. Deploy to Cloud Run

Run the deployment script:

```bash
./deploy_to_cloud_run.sh
```

This script will:
1. Build and push the Docker image to Google Container Registry
2. Create a Cloud Storage bucket if it doesn't exist
3. Deploy the application to Cloud Run with proper configurations
4. Connect it to the Cloud SQL instance
5. Inject the necessary secrets

### 4. Verify Deployment

After deployment, visit the URL provided in the output to ensure the application is running correctly.

### 5. Troubleshooting

If you encounter any issues:

1. Check Cloud Run logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend" --limit=50
   ```

2. Check Cloud SQL connectivity:
   ```bash
   gcloud sql instances describe construction-map-db
   ```

3. Verify IAM permissions:
   ```bash
   gcloud projects get-iam-policy $PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role)" --filter="bindings.members:cloud-run-backend-sa@$PROJECT_ID.iam.gserviceaccount.com"
   ```

## Ongoing Maintenance

### Updating the Application

To update the application, simply make your changes and re-run the deployment script. The Cloud Run service will be updated with the new version.

### Database Migrations

Database migrations are run automatically when the container starts up. If you need to run migrations manually:

1. Connect to Cloud SQL using the Cloud SQL Auth Proxy
2. Run the migration script manually

### Monitoring and Logging

- Access logs in Google Cloud Console under Logging
- Set up monitoring alerts for your Cloud Run service and Cloud SQL instance 