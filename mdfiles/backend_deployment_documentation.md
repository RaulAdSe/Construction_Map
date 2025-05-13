# Construction Map Backend Deployment Documentation

## Deployment Summary

The Construction Map backend has been successfully deployed to Google Cloud Run with a Cloud SQL PostgreSQL database. This document details the deployment process, configuration, and troubleshooting steps.

## Deployment Architecture

- **Backend Service**: Node.js application running on Cloud Run
- **Database**: PostgreSQL on Cloud SQL
- **Storage**: Google Cloud Storage for file uploads
- **Authentication**: JWT-based authentication
- **Environment**: Cloud Run service with 1Gi memory and 1 CPU

## Database Configuration

### Connection Methods

We used two primary database connection methods:

1. **Socket Connection** (Production Default)
   - Connects via Unix socket to Cloud SQL
   - No IP whitelisting required
   - Requires Cloud SQL proxy sidecar container
   - Configuration in `.env.gcp`:
     ```
     CLOUD_DB_ENABLED=true
     CLOUD_DB_INSTANCE=deep-responder-444017-h2:us-central1:construction-map-db-2
     CLOUD_DB_NAME=construction_map
     CLOUD_DB_USER=map-sa
     CLOUD_DB_PASSWORD=postgres
     ```

2. **IAM Authentication** (Alternative)
   - Uses IAM service account authentication
   - No passwords stored in environment variables
   - Requires proper IAM roles and permissions
   - Configuration:
     ```
     CLOUD_DB_IAM_AUTHENTICATION=true
     CLOUD_DB_IAM_USER=servitec-map-service@deep-responder-444017-h2.iam
     ```

### Schema Setup

The database schema is automatically created during deployment using `create_cloud_schema.py`. This ensures that:

1. All required tables exist
2. User permissions are correctly set
3. The admin user is created (if not exists)

## User Configuration

- **Default Admin**: Username: `admin`, Password: `admin`
- **Service Account**: `servitec-map-service@deep-responder-444017-h2.iam`
- **Database User**: `map-sa` with password `postgres`

## Environment Configuration

### Required Environment Files

1. `.env.gcp` - For Cloud Run deployment
   - Contains database connection details
   - Cloud storage configuration
   - JWT secret

2. `.env.local` - For local development
   - Contains local PostgreSQL settings
   - Local file storage paths

### Minimal Required Variables

```
# Core Application
DEBUG=false
SECRET_KEY=<jwt-secret-key>

# Database Connection
CLOUD_DB_ENABLED=true
CLOUD_DB_INSTANCE=<instance-connection-name>
CLOUD_DB_NAME=construction_map
CLOUD_DB_USER=map-sa
CLOUD_DB_PASSWORD=postgres

# Storage
STORAGE_BUCKET=construction-map-storage-deep-responder-444017-h2
```

## Health Monitoring

### Health Endpoints

The application exposes several health endpoints:

1. `/health` - Basic app health check
   - Returns: `{"status":"healthy","message":"API is running"}`
   - Used by: Cloud Run health checks

2. `/api/v1/health` - API health check
   - Checks database connectivity
   - Returns service uptime

### Testing Scripts

Health can be verified with:

```bash
# Basic health check
curl https://construction-map-backend-ypzdt6srya-uc.a.run.app/health

# API health check
curl https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/health

# Test data endpoint
curl https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/projects/
```

## Deployment Process

The deployment process uses the `deploy_to_cloud_run.sh` script which:

1. Builds a Docker container with the application
2. Configures Cloud SQL connection
3. Sets appropriate environment variables
4. Deploys to Cloud Run with proper settings
5. Sets up IAM permissions for service accounts

## Issues Encountered and Solutions

### 1. Database Schema Mismatch

**Issue**: The `user_activities` table had a NOT NULL constraint on the `user_id` column, but the application code attempted to log failed login attempts with NULL user_id values.

**Solution**:
1. Modified database schema to allow NULL values:
   ```sql
   ALTER TABLE user_activities 
   ALTER COLUMN user_id DROP NOT NULL;
   ```
2. Updated Pydantic model in `app/schemas/user_activity.py`:
   ```python
   user_id: Optional[int] = None
   ```
3. Updated SQLAlchemy model in `app/models/user_activity.py`:
   ```python
   user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
   ```

### 2. Table Name Inconsistencies

**Issue**: Code was using both `user_activity` (singular) and `user_activities` (plural) table names.

**Solution**: Standardized on `user_activities` (plural) for the table name and updated all references.

### 3. Cloud SQL Authentication

**Issue**: Initial IAM authentication failed with username too long error.

**Solution**: Switched to standard username/password authentication method using the `map-sa` user.

### 4. Form Data vs JSON Format

**Issue**: Authentication endpoint expected form data, not JSON payload.

**Solution**: Modified client requests to use proper OAuth2 form format:
```python
form_data = {
    "username": "admin",
    "password": "admin",
    "grant_type": "password"
}
response = requests.post(url, data=form_data)
```

## Maintenance and Monitoring

### Logs Location

Application logs are stored in:
1. Cloud Logging (GCP)
2. Local application logs in `/logs` directory

### Database Maintenance

1. Regular database backups are configured via Cloud SQL
2. Schema migrations should be run manually when needed
3. Password rotations should be managed through GCP Secret Manager

## Security Considerations

1. JWT tokens expire after 30 minutes
2. Failed login attempts are logged 
3. Database access is restricted to the application service account
4. Cloud Run service is private by default, accessed via IAM permissions 