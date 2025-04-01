# GCP Cloud SQL Deployment Guide

This guide provides instructions for deploying the Construction Map application with GCP Cloud SQL as the database backend.

## Prerequisites

- A Google Cloud Platform account with a project set up
- GCP Cloud SQL instance running PostgreSQL
- Permissions to create and manage databases
- Google Cloud SDK installed (optional, but recommended)

## Setup Steps

### 1. Create a Cloud SQL PostgreSQL instance

If you haven't already created a Cloud SQL instance:

```bash
# Create a PostgreSQL instance
gcloud sql instances create construction-map-db \
  --database-version=POSTGRES_13 \
  --cpu=2 \
  --memory=4GB \
  --region=us-central1
```

### 2. Create a database and user

```bash
# Create a database
gcloud sql databases create construction_map --instance=construction-map-db

# Create a user
gcloud sql users create app-user \
  --instance=construction-map-db \
  --password=<secure-password>
```

### 3. Generate environment variables

Use the included `cloud_setup.py` script to generate the required environment variables:

```bash
cd backend
python cloud_setup.py --generate-gcp-env \
  --project-id=your-project-id \
  --instance-name=construction-map-db \
  --region=us-central1 \
  --db-name=construction_map \
  --db-user=app-user \
  --db-password=your-password \
  --output=.env.gcp
```

This will create a file with all the necessary environment variables for connecting to your Cloud SQL instance.

### 4. Connection Methods

#### Option 1: Direct Socket Connection (For GCP services like Cloud Run, App Engine)

When deploying to GCP services:

1. Ensure your service has the Cloud SQL Client IAM role
2. Add the Cloud SQL instance as a connection in your service configuration
3. Use the socket path connection string format:
   ```
   postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
   ```

#### Option 2: Cloud SQL Auth Proxy (For local development or other environments)

1. Download and install the [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/connect-auth-proxy)
2. Start the proxy:
   ```bash
   ./cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME
   ```
3. Use a standard connection string with localhost:
   ```
   postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE
   ```

### 5. Migrations and Database Setup

After setting environment variables:

```bash
# Run migrations
cd backend
alembic upgrade head
```

## Optimizing for GCP Cloud SQL

1. **Connection Pooling**: The application is configured with connection pooling optimized for Cloud SQL
2. **SSL**: SSL is required for all Cloud SQL connections
3. **Pool Recycling**: Connections are recycled every 30 minutes to prevent idle connection timeouts
4. **Log Path**: Set LOG_PATH to a writeable directory in your cloud environment

## Monitoring

The monitoring dashboard can track key database metrics like slow queries and performance. For advanced database monitoring:

1. Enable Cloud SQL Insights for advanced query monitoring
2. Set up Cloud Monitoring alerts for database metrics
3. Use Cloud Logging to aggregate application and database logs

## Backup Strategy

Set up backup schedules for your Cloud SQL instance:

```bash
gcloud sql instances patch construction-map-db \
  --backup-start-time=23:00 \
  --enable-bin-log
```

## Troubleshooting

For connection issues:

1. Run the database test command: `python cloud_setup.py --test`
2. Check IAM permissions for your service account
3. Verify firewall rules allow access if using non-socket connections
4. Check Cloud SQL logs for errors

For more detailed troubleshooting, see the GCP Cloud SQL documentation. 