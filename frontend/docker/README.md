# Frontend Docker Files

This directory contains Docker configuration files used during development.

## Files

- `Dockerfile` - Basic Docker configuration for development
- `Dockerfile.dev` - Development Docker configuration with hot reloading

## Production Docker File

The production Dockerfile is located at `../Dockerfile.prod` and should be used for all production deployments. It includes:
- Multi-stage build for smaller image size
- Nginx for serving static content
- Proper security configuration

## Production Configuration Files

Other important production files include:
- `../nginx.conf` - Nginx configuration for serving the frontend
- `../entrypoint.sh` - Docker entrypoint script for Cloud Run compatibility

## Usage

For local development:
```bash
docker build -t servitec-map-frontend -f docker/Dockerfile.dev .
```

For production:
```bash
docker build -t servitec-map-frontend -f Dockerfile.prod .
```

Or simply use the deployment scripts:
```bash
# For full deployment
../deploy_app.sh

# For frontend only
./deploy_frontend.sh 