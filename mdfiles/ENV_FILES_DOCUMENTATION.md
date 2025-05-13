# Environment Configuration Files Documentation

This document provides an overview of all environment configuration files in the project, their purpose, and their example files for reference.

## Root Directory

| File | Purpose | Example File | Status |
|------|---------|--------------|--------|
| `.env` | Main environment file used by scripts in the root directory | `.env.example` | ✅ Example exists |
| `.env.cloud` | Environment configuration for cloud deployment | `.env.gcp.example` | ✅ Example exists |
| `.env.backend` | Minimal environment file with reference to backend | N/A | 🟡 Not needed (simple reference) |
| `.env.local.example` | Example for local development | N/A | ✅ Already an example |
| `.env.gcp.example` | Example for GCP deployment | N/A | ✅ Already an example |

## Frontend Directory

| File | Purpose | Example File | Status |
|------|---------|--------------|--------|
| `.env` | Default environment for frontend | `.env.example` | ✅ Created |
| `.env.local` | Local development environment | `.env.example` | ✅ Covered by the same example |
| `.env.production` | Production deployment environment | `.env.example` | ✅ Covered by the same example |

## Backend Directory

| File | Purpose | Example File | Status |
|------|---------|--------------|--------|
| `.env` | Development environment for backend | `.env.example` | ✅ Example exists |
| `.env.gcp` | Environment for GCP deployment | `.env.gcp.example` | ✅ Example exists |
| `.env.gcp.new` | Updated GCP environment (likely temporary) | `.env.gcp.example` | ✅ Covered by GCP example |

## Key Environment Variables

### Frontend
- `REACT_APP_API_URL`: URL of the backend API
- `REACT_APP_ENVIRONMENT`: Current environment (development/production)
- `REACT_APP_FORCE_HTTPS`: Whether to force HTTPS connections

### Backend
- Database configuration (`POSTGRES_*`, `CLOUD_DB_*`)
- Security settings (`SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Storage settings (`UPLOAD_FOLDER`, `CLOUD_STORAGE_BUCKET`)
- Email configuration when applicable
- Logging and monitoring settings

## Usage Instructions

1. For new deployments, copy the appropriate `.env.example` file to create your environment configuration:
   ```bash
   # For backend
   cp backend/.env.example backend/.env
   
   # For frontend
   cp frontend/.env.example frontend/.env
   ```

2. Edit the copied files to add your specific configuration values.

3. Never commit actual `.env` files containing sensitive information to version control.

4. When adding new environment variables, always update the corresponding example file with a placeholder or default value and a comment explaining its purpose. 