# Construction Map Frontend Deployment Documentation

## Deployment Summary

The Construction Map frontend has been successfully deployed to Google Cloud Run. This document details the deployment process, configuration, and troubleshooting steps.

## Deployment Architecture

- **Frontend Service**: React application running on Cloud Run
- **Static File Serving**: NGINX web server
- **Authentication**: JWT-based authentication, tokens stored in localStorage
- **Environment**: Cloud Run service with 1Gi memory and 1 CPU

## Frontend Configuration

### API Connection

The frontend is configured to connect to the backend API deployed at:
```
https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1
```

This URL is configured in the `src/config.js` file:

```javascript
export const API_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1';
```

### CORS Configuration

The backend has been configured to only accept requests from the deployed frontend domain:
```
https://construction-map-frontend-ypzdt6srya-uc.a.run.app
```

This is set in the backend's CORS middleware configuration.

## Environment Configuration

### Required Environment Files

1. `Dockerfile` - Docker container configuration
   - Uses a multi-stage build for optimal container size
   - Builds the React app and serves it with NGINX

2. `nginx.conf` - NGINX web server configuration
   - Handles static file serving
   - Manages SPA routing with history API fallbacks
   - Sets cache headers for static assets

## Deployment Process

The deployment process uses the `deploy_to_cloud_run.sh` script which:

1. Builds a Docker container with the React application
2. Configures NGINX to serve static files 
3. Pushes the image to Google Artifact Registry
4. Deploys to Cloud Run with proper settings

## Issues Encountered and Solutions

### 1. CORS Issues

**Issue**: Cross-Origin Resource Sharing (CORS) errors when the frontend tries to access the backend API.

**Solution**:
1. Modified backend CORS configuration to explicitly allow requests from the frontend domain:
   ```python
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://construction-map-frontend-ypzdt6srya-uc.a.run.app"],
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   ```
2. Removed all localhost references in the CORS configuration

### 2. API URL Configuration

**Issue**: Frontend was configured to use localhost API URL.

**Solution**: Updated the API URL in `src/config.js` to point to the deployed backend:
```javascript
export const API_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1';
```

## Maintenance and Monitoring

### Logs Location

Application logs are stored in:
1. Cloud Logging (GCP)
2. NGINX logs within the container

### Deployment Updates

To update the deployed frontend:

1. Make changes to the codebase
2. Run the deployment script again:
   ```bash
   cd frontend
   ./deploy_to_cloud_run.sh
   ```

## Security Considerations

1. HTTPS is enabled by default on Cloud Run
2. JWT tokens are stored in localStorage for authentication
3. CORS is restricted to only allow the specific frontend domain
4. Security headers are set in NGINX configuration 