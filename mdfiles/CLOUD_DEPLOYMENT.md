# Cloud Deployment Guide with IAM Authentication

This guide explains how to deploy the Construction Map application to Google Cloud Platform using IAM authentication for database access.

## Prerequisites

1. Google Cloud SDK installed and authenticated
2. Docker installed for building and pushing images
3. Access to Google Cloud project with necessary permissions
4. Created resources:
   - Cloud SQL PostgreSQL instance named `construction-map-db` with IAM authentication enabled
   - Service account `servitec-map-service` with proper permissions
   - Secret Manager secrets for application secrets

## IAM Authentication Overview

This deployment uses IAM authentication to connect to Cloud SQL, which is more secure than password authentication:

- No database passwords need to be stored or managed
- Authentication is handled by Google Cloud IAM
- Service accounts are granted specific database access rights

## Deployment Steps

### 1. Verify IAM Authentication on Cloud SQL

Ensure IAM authentication is enabled on your Cloud SQL instance:

```bash
# Check if IAM authentication is enabled
gcloud sql instances describe construction-map-db --format="value(settings.databaseFlags[].value)" | grep -i "on"

# If not enabled, enable it with:
gcloud sql instances patch construction-map-db --database-flags cloudsql.iam_authentication=on
```

### 2. Grant IAM Roles to the Service Account

The service account needs permissions to access Cloud SQL:

```bash
# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
  --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### 3. Create App User in the Database

Cloud SQL requires a database user that matches the IAM principal:

```bash
# Create the app_user via gcloud
gcloud sql users create app_user \
  --instance=construction-map-db \
  --type=CLOUD_IAM_SERVICE_ACCOUNT \
  --cloud-iam-service-account=servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com
```

### 4. Create Secret for Application Key

Create a secret for the application encryption key:

```bash
# Create a secret for app encryption key
echo "your-secure-key-here" | gcloud secrets create app-secret-key --data-file=-
```

### 5. Run the Deployment Script

Execute the deployment script to build, push and deploy the application:

```bash
./deploy_to_cloud_run.sh
```

This script will:
1. Verify IAM authentication is enabled on Cloud SQL
2. Check/create the Cloud Storage bucket for file uploads
3. Build and push the Docker image to Google Container Registry
4. Grant necessary IAM roles to the service account
5. Deploy the application to Cloud Run with proper configurations
6. Display the service URL when complete

### 6. Verify Deployment

After deployment, access the URL provided in the output to ensure the application is running correctly.

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Check Cloud Run logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend" --limit=20
   ```

2. Verify IAM authentication is enabled on your instance:
   ```bash
   gcloud sql instances describe construction-map-db --format="value(settings.databaseFlags)"
   ```

3. Verify database user exists and has correct permissions:
   ```bash
   gcloud sql users list --instance=construction-map-db
   ```

4. Verify service account has Cloud SQL Client role:
   ```bash
   gcloud projects get-iam-policy deep-responder-444017-h2 \
     --format="table(bindings.role,bindings.members)" \
     --filter="bindings.members:servitec-map-service AND bindings.role=roles/cloudsql.client"
   ```

### Connection Pooling with IAM Authentication

When using IAM authentication with Cloud SQL:

1. Tokens are automatically refreshed by the Cloud SQL Python Connector
2. Connection pooling is optimized for IAM authentication
3. No need to manually manage database passwords or rotate credentials

## Ongoing Maintenance

### Updating the Application

To update the application:

1. Make your code changes
2. Re-run the deployment script:
   ```bash
   ./deploy_to_cloud_run.sh
   ```

### Monitoring and Scaling

- View logs in Google Cloud Console under Logging
- Adjust max instances in the deployment script if needed
- Set up Cloud Monitoring alerts for your service 