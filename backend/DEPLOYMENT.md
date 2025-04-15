# Construction Map Application Deployment Guide

This document outlines the complete process for deploying the Construction Map application to Google Cloud Platform, including database setup, schema initialization, and Cloud Run deployment.

## Prerequisites

- Google Cloud SDK installed and configured
- Docker installed locally
- Access to the GCP project (`deep-responder-444017-h2`)
- Required permissions: Cloud SQL Admin, Cloud Run Admin, Artifact Registry Admin
- Service account with appropriate IAM permissions

## 1. Database Setup

### 1.1 Connect to Cloud SQL Database

```bash
# Connect to the Cloud SQL instance
gcloud sql connect construction-map-db --user=postgres
# You will be prompted for password
```

### 1.2 Create/Update Database Schema

The schema can be created using the provided SQL script or by running the application's schema creation tools:

**Option 1: Using SQL Script Directly**

```bash
# Run the schema creation script to set up all tables
cd ~/Work/Servitec/Map/backend
gcloud sql connect construction-map-db --user=postgres < create_db_schema.sql
```

**Option 2: Using Python Script**

```bash
# Run the schema creation script
cd ~/Work/Servitec/Map/backend
python create_cloud_schema.py
```

### 1.3 Verify Database Schema

Check that the database has all required tables and the admin user:

```sql
-- When connected to the database:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT id, username, email, is_admin, is_active FROM users;
```

Make sure the `users` table has the `password_hash` column:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'users';
```

## 2. IAM Configuration

Ensure the service account has the necessary permissions:

```bash
# Add Cloud SQL Client role
gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
    --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

# Add Cloud SQL Instance User role
gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
    --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
    --role="roles/cloudsql.instanceUser"

# Add Secret Manager Access
gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
    --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Add Storage Object Admin (with condition for the specific bucket)
gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
    --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin" \
    --condition="expression=resource.name.startsWith(\"projects/_/buckets/construction-map-storage-deep-responder-444017-h2\"),title=access_to_construction_map_storage"
```

## 3. Cloud Run Deployment

### 3.1 Update Environment Files

Make sure `.env.gcp` has the correct settings:

```
# Database configuration using IAM authentication
DATABASE_URL=postgresql+pg8000://localhost/construction_map
CLOUD_DB_ENABLED=true
CLOUD_DB_INSTANCE=deep-responder-444017-h2:us-central1:construction-map-db
CLOUD_DB_NAME=construction_map
CLOUD_DB_IAM_USER=servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com
CLOUD_DB_POOL_SIZE=10
CLOUD_DB_MAX_OVERFLOW=20
CLOUD_DB_POOL_TIMEOUT=30
CLOUD_DB_POOL_RECYCLE=1800
CLOUD_DB_IAM_AUTHENTICATION=true
```

### 3.2 Deploy to Cloud Run

Use the deployment script which handles building and deploying the Docker image:

```bash
cd ~/Work/Servitec/Map/backend
./deploy_to_cloud_run.sh
```

The deployment script performs the following actions:
- Creates Artifact Registry repository (if it doesn't exist)
- Checks if storage bucket exists
- Enables IAM authentication for Cloud SQL
- Builds and pushes the Docker image
- Updates service account roles
- Deploys to Cloud Run with the appropriate configurations

### 3.3 Verify Deployment

After deployment, verify that the service is running and accessible:

```bash
# Check service status
gcloud run services describe construction-map-backend --region us-central1

# Test endpoints
curl https://construction-map-backend-77413952899.us-central1.run.app/health
curl https://construction-map-backend-77413952899.us-central1.run.app/api/v1/monitoring/health/db
```

## 4. Troubleshooting

### 4.1 Check Cloud Run Logs

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend" --limit=20
```

### 4.2 Check Cloud SQL Configuration

```bash
# Verify the Cloud SQL instance is properly attached
gcloud run services describe construction-map-backend --region us-central1 --format="yaml(spec.template.metadata.annotations)"
```

### 4.3 Directly Test Database Connection

```bash
# Test direct SQL connection
cd ~/Work/Servitec/Map/backend
python check_db.py
```

### 4.4 Fixing Common Issues

**Missing password_hash column:**
```sql
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By';
```

**No Cloud SQL connection in Cloud Run:**
Make sure the `--add-cloudsql-instances` parameter is correctly specified in the deploy command with the full instance name:
```
--add-cloudsql-instances="PROJECT_ID:REGION:INSTANCE_NAME"
```

## 5. Admin User Information

Default admin credentials:
- Username: `admin`
- Email: `seritec.ingenieria.rd@gmail.com`
- Password: `password123` (hashed as `$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By`)

---

**Note:** After deployment, the application should automatically create necessary directories and initialize database tables if they don't exist. The admin user will be created automatically during container startup. 