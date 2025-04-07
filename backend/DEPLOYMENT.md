# Backend Deployment Guide

## Production Deployment Files

The following files are used for production deployment:

1. **`deploy_final.sh`** - The main deployment script for the backend API.
   - Deploys to Google Cloud Run
   - Configures the database connection
   - Sets up environment variables

2. **`Dockerfile.prod`** - The production Docker configuration.
   - Optimized for production use
   - Minimal size and dependencies
   - Proper security configuration

## Development Files (Not for Production)

These files were used during development and testing but should not be used for production:

- `deploy_minimal.sh` - Minimal deployment for testing
- `deploy_cloudbuild.sh` - Testing Cloud Build deployment
- `deploy_minimal_with_db.sh` - Testing database connection
- `deploy_absolute_minimal.sh` - Bare minimum deployment
- `deploy_simple.sh` - Simple deployment for testing
- `deploy_cloud_run.sh` - Initial Cloud Run test

## How to Deploy the Backend

To deploy the backend API to production:

```bash
# From the backend directory
./deploy_final.sh

# When prompted, enter your database password
# Follow the prompts to complete deployment
```

Or use the full application deployment script:

```bash
# From the project root
./deploy_app.sh
``` 