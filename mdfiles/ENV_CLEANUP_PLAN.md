# Environment Files Cleanup Plan

## Current Issues
1. Too many environment files spread across the project
2. Duplicated configuration in multiple files
3. Secrets stored in files committed to the repository
4. Unclear which files are actually used in production

## Files to Keep

### Root Directory
- `.env` - Main environment file for root-level scripts
- `.env.example` - Example template for the main environment file

### Backend Directory
- `backend/.env` - Main backend environment file for local development
- `backend/.env.gcp` - Production environment for Google Cloud Platform deployment
- `backend/.env.example` - Example template for backend development
- `backend/.env.gcp.example` - Example template for GCP deployment

### Frontend Directory
- `frontend/.env` - Default environment variables
- `frontend/.env.local` - Local development overrides
- `frontend/.env.production` - Production settings
- `frontend/.env.example` - Example template for all frontend environments

## Files to Delete (After Backup)
- `.env.backend` - Redundant, use `backend/.env` instead
- `.env.cloud` - Redundant, use `.env.gcp` instead
- `backend/.env.gcp.new` - Temporary file, merge changes into `.env.gcp` if needed
- `backend/app/.env` - Nested environment file, consolidate with `backend/.env`
- Multiple duplicated example files in different locations

## Implementation Steps

1. **Backup All Environment Files**
   ```bash
   mkdir -p env_backup
   find . -name ".env*" -exec cp {} env_backup/ \;
   ```

2. **Create Consolidated Example Files**
   - Place all example files in the `example_env_files/` directory
   - Make sure each file has clear documentation and comments

3. **Implement the Secret Manager Module**
   As described in `SECRETS_MANAGEMENT.md`, create a central secrets management module:
   - Path: `backend/app/core/config/secrets.py`
   - Update code to use this module instead of direct environment variables

4. **Update Scripts and Documentation**
   - Update deployment scripts to use the correct environment files
   - Update documentation to reflect the simplified structure
   - Create a README in each directory with environment files

5. **Clean Up Redundant Files**
   After verifying everything works, delete the redundant files.

## Environment File Structure

The standardized environment file structure should be:

```
project/
├── .env (link to backend/.env)
├── .env.example (link to example_env_files/.env.example)
├── example_env_files/
│   ├── .env.example (base example)
│   ├── .env.gcp.example (GCP example)
│   ├── .env.local.example (local dev example)
│   └── .env.production.example (production example)
├── backend/
│   ├── .env (actual development config)
│   ├── .env.gcp (actual GCP config)
│   └── .env.example (symlink to example_env_files/.env.example)
└── frontend/
    ├── .env (actual development config)
    ├── .env.local (local overrides)
    ├── .env.production (production config)
    └── .env.example (symlink to example_env_files/.env.frontend.example)
```

## Security Improvements

1. Remove all hardcoded secrets from deployment scripts
2. Add clear warnings about sensitive data to example files
3. Configure CI/CD to validate that no real secrets are committed
4. Implement the Secret Manager as described in `SECRETS_MANAGEMENT.md` 