# Backend Deployment Documentation (15/4)

## Overview

This document outlines the deployment process and configuration of our backend service on Google Cloud Platform, specifically using Cloud Run and Cloud SQL with IAM authentication.

## Backend Service Features

- **RESTful API**: FastAPI-based backend with JSON responses
- **Authentication**: JWT-based authentication with role-based access control
- **Database Access**: PostgreSQL database hosted on Cloud SQL with IAM authentication
- **Monitoring**: System health, database performance, and user activity monitoring
- **Project Management**: CRUD operations for projects, maps, and events
- **User Management**: User registration, authentication, and profile management
- **Notifications**: Event notification system
- **File Storage**: Google Cloud Storage integration for file uploads

## Deployment Architecture

### Components
- **Backend Service**: Containerized Python (FastAPI) application running on Cloud Run
- **Database**: PostgreSQL on Cloud SQL with IAM authentication
- **Storage**: Google Cloud Storage for file uploads (bucket: `construction-map-storage`)
- **Secrets**: Google Secret Manager for sensitive configuration (`jwt-secret-key`)
- **IAM**: Service account (`servitec-map-service`) for authentication between services
- **VPC Connector**: Connection to private networks via `cloudrun-sql-connector`

### Deployment Process

The deployment was done using a custom script (`deploy_to_cloud_run.sh`) that:

1. Creates/confirms Artifact Registry repository (`construction-map`)
2. Creates/confirms Cloud Storage bucket (`construction-map-storage`)
3. Verifies IAM authentication on Cloud SQL instance (`construction-map-db`)
4. Configures Docker for cross-platform builds using Docker buildx
5. Builds a Docker image for AMD64 architecture (important for Cloud Run)
6. Pushes the image to Artifact Registry
7. Ensures the service account has necessary IAM roles
8. Deploys the service to Cloud Run with appropriate permissions and configurations

### Database Connectivity

The service connects to Cloud SQL using IAM authentication instead of traditional username/password:

- **IAM Authentication**: Uses a service account (`servitec-map-service`) to authenticate to Cloud SQL
- **Connection String**: Uses PostgreSQL connection string in the format `postgresql://app_user@localhost/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE`
- **SQL Connector**: Uses the Cloud SQL Python connector library (`cloud-sql-python-connector[pg8000]`)
- **VPC Connector**: Uses a VPC connector for secure connectivity to Cloud SQL
- **Database Schema**: Creates the database schema using a custom script (`create_cloud_schema.py`) that runs during container startup

## Service Configuration

The deployment configuration includes:

- Memory: 1GB
- CPU: 1 core
- Max instances: 5
- VPC Connector: `cloudrun-sql-connector` for private connectivity
- VPC Egress: `private-ranges-only` to route only private traffic through the connector

## Required Environment Variables

The service requires the following environment variables (set in Cloud Run deployment):

```
# Database Configuration
DB_NAME=construction_map
DB_CONNECTION_STRING=postgresql://app_user@localhost/construction_map?host=/cloudsql/deep-responder-444017-h2:us-central1:construction-map-db
SQL_INSTANCE=deep-responder-444017-h2:us-central1:construction-map-db

# Feature Flags
CLOUD_DB_ENABLED=true
CLOUD_DB_IAM_AUTHENTICATION=true
USE_CLOUD_STORAGE=true

# Google Cloud Configuration
STORAGE_BUCKET=construction-map-storage

# Secrets (loaded from Secret Manager)
SECRET_KEY=<retrieved-from-secret-manager>
```

The `.env.gcp` file is baked into the Docker container for additional configuration.

## Service Account Permissions

The deployment uses the `servitec-map-service` service account with the following roles:
- `roles/cloudsql.client` - Allows connection to Cloud SQL
- `roles/secretmanager.secretAccessor` - Allows reading secrets
- `roles/storage.objectAdmin` - Allows file storage operations

## Key Endpoints

### Authentication Endpoints
- `POST /api/v1/auth/login`: User login
- `POST /api/v1/auth/register`: User registration

### Project Management
- `GET /api/v1/projects`: List all projects
- `POST /api/v1/projects`: Create a new project
- `GET /api/v1/projects/{id}`: Get project details
- `PUT /api/v1/projects/{id}`: Update project
- `DELETE /api/v1/projects/{id}`: Delete project

### Maps & Events
- `GET /api/v1/projects/{project_id}/maps`: List all maps in a project
- `POST /api/v1/projects/{project_id}/maps`: Upload a new map
- `GET /api/v1/projects/{project_id}/events`: Get all events in a project
- `POST /api/v1/projects/{project_id}/events`: Create a new event

### Monitoring Endpoints
- `GET /api/v1/monitoring/health/system`: System health information (admin only)
- `GET /api/v1/monitoring/health/db`: Database health information (admin only)
- `GET /api/v1/monitoring/metrics/system`: Current system metrics (admin only)
- `GET /api/v1/monitoring/user-activity`: User activity logs (admin only)
- `GET /api/v1/monitoring/logs`: Application logs (admin only)
- `GET /api/v1/monitoring/logs/queries`: Slow query logs (admin only)

## Testing the Deployment

The backend service is accessible at:
```
https://construction-map-backend-77413952899.us-central1.run.app
```

You can test the API using curl or any API testing tool. Example:

```bash
# Check if the service is running
curl https://construction-map-backend-77413952899.us-central1.run.app/api/v1/health

# Login (get JWT token)
curl -X POST \
  https://construction-map-backend-77413952899.us-central1.run.app/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"your_password"}'
```

## Docker Build

The containerization is based on the following Dockerfile:
```dockerfile
FROM python:3.9

WORKDIR /app

# Copy requirements and remove psutil to avoid build issues
COPY requirements.txt .
RUN grep -v "psutil" requirements.txt > requirements_fixed.txt

# Install dependencies
RUN pip install --no-cache-dir -r requirements_fixed.txt \
    cloud-sql-python-connector[pg8000]==1.2.3 \
    google-cloud-secret-manager \
    bcrypt \
    email-validator \
    sendgrid \
    pandas

# Copy application files
COPY . .
COPY .env.gcp .env

# Create directories
RUN mkdir -p uploads/comments uploads/events logs

# Create start script 
RUN echo '#!/bin/bash\n\
echo "Running in Cloud Run environment..."\n\
echo "Database connection string: $DB_CONNECTION_STRING"\n\
echo "Cloud SQL instance: $SQL_INSTANCE"\n\
echo "Running database migrations..."\n\
python create_cloud_schema.py\n\
echo "Starting API server..."\n\
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run the start script
CMD ["/app/start.sh"]
```

## Known Limitations

- The system metrics in Cloud Run are static placeholders since Cloud Run doesn't expose host metrics
- The database connection uses IAM auth which is more secure but requires proper IAM permissions
- Cross-platform build is required when building from an ARM-based development machine (e.g., M1/M2 Macs)

## Troubleshooting

Common issues:
1. **Permission denied errors**: Check if the service account has the required roles
2. **Database connection issues**: Verify the `SQL_INSTANCE` environment variable is correct
3. **Secret access issues**: Confirm the service account has Secret Manager access
4. **Deployment failures**: Check if the Docker build is targeting AMD64 architecture

For database-specific issues:
- Check the logs for connection errors: `gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend AND textPayload:database"`
- Verify IAM authentication is enabled on the Cloud SQL instance: `gcloud sql instances describe construction-map-db --format="value(settings.databaseFlags)"`

## Next Steps / Improvements

- Set up continuous deployment with Cloud Build
- Implement more comprehensive monitoring and alerting
- Add automatic database backups
- Improve error handling and recovery mechanisms
- Consider implementing a separate staging environment 