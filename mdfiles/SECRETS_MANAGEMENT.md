# Secrets Management Strategy

## Current Issues
- Secrets are spread across multiple files
- Some secrets are committed to the repository
- No standardized approach for handling different environments

## Centralized Secrets Management Proposal

### 1. Standardized Structure

We will use a consistent approach for all environment files:

1. **Example Files**: Keep ONLY example files with placeholder values in the repository
   - `.env.local.example`
   - `.env.gcp.example` 
   - `.env.cloud.example`
   - `.env.production.example`

2. **Real Config Files**: Keep actual configuration files with real secrets OUT of the repository
   - These files should be in the `.gitignore` (which they already are)

3. **Centralized Location**: Store all example files in the `example_env_files/` directory

### 2. Environment Variables Hierarchy

Create a clear hierarchy of environment files:

1. **Base Configuration** (.env.base.example):
   - Common settings used across all environments
   - No secrets, only default configurations

2. **Environment-Specific Files**:
   - `.env.local` - Local development 
   - `.env.gcp` - Google Cloud Platform
   - `.env.production` - Production environment

### 3. Secrets Management Options

#### Option A: Environment Variables with Documentation

- Keep all secrets in environment variables
- Provide comprehensive documentation
- Use scripts to validate environment setup before running

#### Option B: Secret Management Service (Recommended)

- Use Google Secret Manager for GCP deployments
- Use environment variables only for local development
- Implement a secrets loading module that can fetch from different sources

### 4. Implementation Plan

1. **Clean Up Existing Secrets**:
   - Remove all secrets from the codebase
   - Create example files for all environments
   - Update documentation

2. **Create Central Secrets Module**:
   - Implement a `secrets.py` module that loads secrets from appropriate sources
   - Make all parts of the application use this central module

3. **Standardize Environment Files**:
   - Consolidate duplicate environment files
   - Ensure consistent naming and formatting

4. **Documentation**:
   - Update all documentation to reflect the new approach
   - Provide setup guides for different environments

## Example: Central Secrets Module

```python
# backend/app/core/config/secrets.py

import os
from pathlib import Path
from typing import Dict, Any, Optional

# Optional: For Google Secret Manager
try:
    from google.cloud import secretmanager
    HAS_SECRET_MANAGER = True
except ImportError:
    HAS_SECRET_MANAGER = False

class SecretManager:
    """Centralized secrets management."""
    
    def __init__(self):
        self.env = os.getenv("ENVIRONMENT", "development")
        self.project_id = os.getenv("PROJECT_ID")
        self._secrets_cache: Dict[str, Any] = {}
    
    def get_secret(self, key: str, default: Optional[Any] = None) -> Any:
        """Get a secret from the appropriate source based on environment."""
        if key in self._secrets_cache:
            return self._secrets_cache[key]
            
        # First check environment variables
        value = os.getenv(key)
        if value is not None:
            self._secrets_cache[key] = value
            return value
            
        # If in cloud and Secret Manager is available, try to get from there
        if self.env in ("production", "staging") and HAS_SECRET_MANAGER and self.project_id:
            try:
                client = secretmanager.SecretManagerServiceClient()
                name = f"projects/{self.project_id}/secrets/{key}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                value = response.payload.data.decode("UTF-8")
                self._secrets_cache[key] = value
                return value
            except Exception:
                # Fall back to default if Secret Manager fails
                pass
                
        return default
        
    def get_database_config(self) -> Dict[str, Any]:
        """Get database configuration from secrets."""
        if self.env in ("production", "staging"):
            # Cloud DB configuration
            return {
                "ENABLED": self.get_secret("CLOUD_DB_ENABLED", "false").lower() == "true",
                "SERVER": self.get_secret("POSTGRES_SERVER"),
                "PORT": self.get_secret("POSTGRES_PORT", "5432"),
                "USER": self.get_secret("POSTGRES_USER"),
                "PASSWORD": self.get_secret("POSTGRES_PASSWORD"),
                "DB": self.get_secret("POSTGRES_DB"),
                "POOL_SIZE": int(self.get_secret("CLOUD_DB_POOL_SIZE", "10")),
                "MAX_OVERFLOW": int(self.get_secret("CLOUD_DB_MAX_OVERFLOW", "20")),
            }
        else:
            # Local DB configuration
            return {
                "SERVER": self.get_secret("POSTGRES_SERVER", "localhost"),
                "PORT": self.get_secret("POSTGRES_PORT", "5432"),
                "USER": self.get_secret("POSTGRES_USER", "postgres"),
                "PASSWORD": self.get_secret("POSTGRES_PASSWORD", "postgres"),
                "DB": self.get_secret("POSTGRES_DB", "servitec_map"),
            }

# Create a singleton instance
secrets = SecretManager()
```

## Security Best Practices

1. Never commit real secrets to the repository
2. Rotate secrets regularly
3. Use different secrets for different environments
4. Limit access to production secrets
5. Use a secure method to share secrets with team members 