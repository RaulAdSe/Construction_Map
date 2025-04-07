# Deployment Scripts

## Production Deployment
Use these scripts for production deployment:
- `../deploy_app.sh` - Deploy the entire application (backend + frontend)
- `../backend/deploy_final.sh` - Deploy only the backend API
- `../frontend/deploy_frontend.sh` - Deploy only the frontend

## Development/Archive
The `archive` directory contains intermediate scripts used during
development of the deployment process. These should not be used for production.

## Directory Structure
```
/
├── deploy_app.sh           # Main deployment script (deploys everything)
├── backend/
│   ├── deploy_final.sh     # Production backend deployment
│   ├── Dockerfile.prod     # Production Docker configuration
│   └── ...
├── frontend/
│   ├── deploy_frontend.sh  # Production frontend deployment
│   ├── Dockerfile.prod     # Production Docker configuration
│   ├── nginx.conf          # Nginx configuration for serving frontend
│   ├── entrypoint.sh       # Docker entrypoint script
│   └── ...
└── deployment/
    ├── archive/            # Older development scripts (not for production)
    │   └── ...
    ├── nginx_cloud_run_proxy.conf  # Nginx configuration for proxying to Cloud Run
    └── ...
``` 