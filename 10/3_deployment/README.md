# Servitec Map Production Deployment

This directory contains production deployment scripts and configuration for the Servitec Map application, implementing the successful database connection approach documented on April 10th.

## Overview

These scripts deploy the Servitec Map application to Google Cloud Run with proper Cloud SQL Auth Proxy integration for reliable database connectivity. The deployment is based on the working configuration identified in the "Thursday 10th 11 pm.md" documentation.

## Files

- `deploy_production.sh` - Main deployment script
- `db-connection.js` - Database connection module using Cloud SQL Auth Proxy
- `db-test.js` - Route for testing database connection
- `patch-app.js` - Script to patch existing application with the new DB connection

## Requirements

- Google Cloud SDK
- Docker with buildx support
- Node.js and npm
- PostgreSQL database set up in Cloud SQL

## Key Features

1. **Cloud SQL Auth Proxy Integration**
   - Uses Unix sockets for reliable connectivity
   - Automatically handles authentication and encryption
   - Properly configures environment variables and flags

2. **Automatic Environment Detection**
   - Detects Cloud Run environment
   - Uses appropriate connection method based on environment
   - Falls back to TCP for local development

3. **Comprehensive Deployment Script**
   - Handles both backend and frontend deployment
   - Sets up proper service accounts and permissions
   - Includes validation and testing

4. **Flexible Application Structure**
   - Works with backend in separate directory or in main project directory
   - Patches app.js to include database test route if not present
   - Sets up correct file structure

## Usage

To deploy the application:

```bash
cd /path/to/your/project
chmod +x 10/3_deployment/deploy_production.sh
./10/3_deployment/deploy_production.sh
```

## Environment Variables

The deployment script uses the following environment variables, which should be defined in `.env.production`:

- `GOOGLE_CLOUD_PROJECT` - Google Cloud project ID
- `CLOUD_REGION` - Google Cloud region (default: "us-central1")
- `CLOUD_SERVICE_NAME` - Backend service name (default: "servitec-map-api")
- `FRONTEND_SERVICE_NAME` - Frontend service name (default: "servitec-map-frontend")
- `CLOUD_SQL_INSTANCE` - Cloud SQL instance connection name
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

## Verification

After deployment, the script automatically tests:

1. Health endpoint: `https://<service-url>/health`
2. Database connection: `https://<service-url>/db-test`

A successful database connection should return a response similar to:

```json
{
  "status": "success",
  "message": "Database connection successful",
  "data": {
    "time": "2025-04-10T09:11:51.851Z",
    "environment": "Cloud Run",
    "connectionType": "Cloud SQL Auth Proxy",
    "database": "servitec_map"
  }
}
```

## Troubleshooting

If deployment fails or database connection issues occur:

1. Check the logs using: `gcloud run services logs read servitec-map-api --region=us-central1`
2. Verify environment variables are set correctly
3. Ensure service account has Cloud SQL Client permissions
4. Confirm the Cloud SQL instance is running and accessible 