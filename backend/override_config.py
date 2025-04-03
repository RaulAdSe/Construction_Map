#!/usr/bin/env python3
"""
Override config module to handle environment variable parsing issues in Google Cloud Run.
This script is imported before app.main to fix settings issues.
"""

import os
import sys
import logging
import importlib.util
from types import ModuleType
from typing import List, Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("override_config")

# First check if pydantic-settings is available
try:
    from pydantic_settings import BaseSettings
    from pydantic import Field
except ImportError:
    logger.error("pydantic-settings not installed. Installing now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pydantic-settings>=2.0.0"])
    from pydantic_settings import BaseSettings
    from pydantic import Field

logger.info("Creating simplified settings class")

# Create a minimal settings class
class SimpleSettings(BaseSettings):
    """Simplified settings class for Cloud Run deployment"""
    
    # Database settings
    POSTGRES_SERVER: str = "34.123.51.251"
    POSTGRES_PORT: str = "5432"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB: str = "servitec_map"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "development_secret_key")
    
    # CORS settings - critical fix for Cloud Run
    CORS_ORIGINS: List[str] = ["*"]
    
    # API settings
    API_PREFIX: str = "/api"
    API_V1_STR: str = "/v1"
    
    # Cloud settings
    CLOUD_DB_ENABLED: bool = True
    CLOUD_STORAGE_ENABLED: bool = True
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "")
    GCP_STORAGE_BUCKET: str = os.getenv("GCP_STORAGE_BUCKET", "")
    
    # Environment
    ENVIRONMENT: str = "production"
    DEBUG: bool = False
    
    # Other settings
    UPLOAD_FOLDER: str = "/app/uploads"
    LOG_LEVEL: str = "INFO"
    
    def dict(self) -> Dict[str, Any]:
        """Return settings as dict for compatibility"""
        return {k: getattr(self, k) for k in dir(self) if not k.startswith('_')}
        
    class Config:
        case_sensitive = True
        env_file = ".env.production"


# Create a dummy settings instance
settings = SimpleSettings()
logger.info(f"Settings created with CORS_ORIGINS: {settings.CORS_ORIGINS}")

# Create a dummy module to replace app.core.config
class DummyConfigModule(ModuleType):
    """A dummy module to replace app.core.config"""
    settings = settings
    Settings = SimpleSettings

# Create and register the dummy module
dummy_config = DummyConfigModule("app.core.config")
sys.modules["app.core.config"] = dummy_config

logger.info("Config module has been overridden") 