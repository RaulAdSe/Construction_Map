# Frontend Deployment Guide

## Production Deployment Files

The following files are used for production deployment:

1. **`deploy_frontend.sh`** - The main deployment script for the frontend.
   - Deploys to Google Cloud Run
   - Automatically configures the connection to the backend API
   - Sets up environment variables

2. **`Dockerfile.prod`** - The production Docker configuration.
   - Optimized for production use
   - Multi-stage build for smaller image size
   - Uses Nginx to serve static files

3. **`nginx.conf`** - The Nginx configuration for serving the frontend.
   - Properly configured for security
   - Set up for client-side routing
   - Handles proper caching headers

4. **`entrypoint.sh`** - Docker entrypoint script.
   - Configures Nginx to listen on the correct port
   - Required for Cloud Run compatibility

## Development Files (Not for Production)

These files are for development use only:

- `Dockerfile` - Basic Docker configuration
- `Dockerfile.dev` - Development Docker configuration

## How to Deploy the Frontend

To deploy the frontend to production:

```bash
# From the frontend directory
./deploy_frontend.sh

# Follow the prompts to complete deployment
```

Or use the full application deployment script:

```bash
# From the project root
./deploy_app.sh
```

## Note on API Connection

The frontend automatically connects to the backend API based on the URL of the deployed backend service. The deployment script will retrieve this URL automatically. 