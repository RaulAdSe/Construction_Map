# Archive - DO NOT USE FOR PRODUCTION

This directory contains scripts that were used during the development of the deployment process. These scripts are kept for reference only and **should not be used for production deployment**.

## Archived Scripts

- `deploy_to_cloud_run.sh` - Early version of the Cloud Run deployment script
- `deploy_minimal.sh` - Minimal deployment script for testing
- `deploy_cloudbuild.sh` - Testing Cloud Build deployment
- `deploy_minimal_with_db.sh` - Testing database connection
- `deploy_absolute_minimal.sh` - Bare minimum deployment
- `deploy_simple.sh` - Simple deployment for testing
- `deploy_cloud_run.sh` - Initial Cloud Run test

## ⚠️ WARNING ⚠️

Using these scripts may:
- Deploy non-production ready code
- Use insecure configurations
- Deploy with incorrect environment variables
- Not follow best practices

## For Production Deployment

Please use the official production deployment scripts:

- `../../deploy_app.sh` - Deploy the entire application
- `../../backend/deploy_final.sh` - Deploy only the backend API
- `../../frontend/deploy_frontend.sh` - Deploy only the frontend 