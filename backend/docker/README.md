# Backend Docker Files

This directory contains Docker configuration files used during development.

## Files

- `Dockerfile` - Basic Docker configuration for development
- `Dockerfile.dev` - Development Docker configuration with debugging support

## Production Docker File

The production Dockerfile is located at `../Dockerfile.prod` and should be used for all production deployments.

## Usage

For local development:
```bash
docker build -t servitec-map-backend -f docker/Dockerfile.dev .
```

For production:
```bash
docker build -t servitec-map-backend -f Dockerfile.prod .
```

Or simply use the deployment scripts:
```bash
# For full deployment
../deploy_app.sh

# For backend only
./deploy_final.sh 