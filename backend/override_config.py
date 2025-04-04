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
    from pydantic_settings import BaseSettings, SettingsConfigDict
    from pydantic import Field
except ImportError:
    logger.error("pydantic-settings not installed. Installing now...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pydantic-settings>=2.0.0"])
    from pydantic_settings import BaseSettings, SettingsConfigDict
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
    # Hard-coded, not read from environment
    CORS_ORIGINS: List[str] = Field(["*"], exclude=True)
    
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
    
    class Config:
        env_file = ".env.production"
        extra = "ignore"
    
    def __post_init__(self):
        # Add database configuration
        self.init_database_config()
    
    def init_database_config(self):
        # Database configuration
        class DatabaseConfig:
            def __init__(self, parent):
                # Check for individual database environment variables
                db_host = os.environ.get("DB_HOST")
                db_port = os.environ.get("DB_PORT", "5432")
                db_name = os.environ.get("DB_NAME")
                db_user = os.environ.get("DB_USER")
                db_pass = os.environ.get("DB_PASS")
                
                # Build database URL
                if db_host and db_name and db_user and db_pass:
                    import urllib.parse
                    encoded_pass = urllib.parse.quote_plus(db_pass)
                    self.DATABASE_URL = f"postgresql://{db_user}:{encoded_pass}@{db_host}:{db_port}/{db_name}"
                else:
                    # Fallback to legacy environment variables or hardcoded values
                    postgres_pass = parent.POSTGRES_PASSWORD or ""
                    import urllib.parse
                    encoded_pass = urllib.parse.quote_plus(postgres_pass)
                    self.DATABASE_URL = f"postgresql://{parent.POSTGRES_USER}:{encoded_pass}@{parent.POSTGRES_SERVER}:{parent.POSTGRES_PORT}/{parent.POSTGRES_DB}"
                
                # Default connection pool settings
                self.POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "5"))
                self.POOL_OVERFLOW = int(os.environ.get("DB_POOL_OVERFLOW", "10"))
                self.POOL_TIMEOUT = int(os.environ.get("DB_POOL_TIMEOUT", "30"))
                self.POOL_RECYCLE = int(os.environ.get("DB_POOL_RECYCLE", "1800"))
        
        self.database = DatabaseConfig(self)
    
    def dict(self) -> Dict[str, Any]:
        """Return settings as dict for compatibility"""
        result = {k: getattr(self, k) for k in dir(self) if not k.startswith('_') and not callable(getattr(self, k)) and k != 'database'}
        if hasattr(self, 'database'):
            result['database'] = {k: getattr(self.database, k) for k in dir(self.database) if not k.startswith('_') and not callable(getattr(self.database, k))}
        return result
    
    model_config = SettingsConfigDict(env_file=".env.production", extra="ignore")

# Create a simpler implementation that doesn't rely on pydantic-settings
class HardcodedSettings:
    """Hardcoded settings that don't use pydantic-settings at all"""
    CORS_ORIGINS = ["*"]
    POSTGRES_SERVER = "34.123.51.251"
    POSTGRES_PORT = "5432" 
    POSTGRES_USER = "postgres"
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_DB = "servitec_map"
    SECRET_KEY = os.getenv("SECRET_KEY", "development_secret_key")
    API_PREFIX = "/api"
    API_V1_STR = "/v1"
    CLOUD_DB_ENABLED = True
    CLOUD_STORAGE_ENABLED = True
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
    GCP_STORAGE_BUCKET = os.getenv("GCP_STORAGE_BUCKET", "")
    ENVIRONMENT = "production"
    DEBUG = False
    UPLOAD_FOLDER = "/app/uploads"
    LOG_LEVEL = "INFO"
    
    # Create database configuration directly on the class initialization
    class DatabaseConfig:
        def __init__(self, parent):
            # Check for individual database environment variables
            db_host = os.environ.get("DB_HOST")
            db_port = os.environ.get("DB_PORT", "5432")
            db_name = os.environ.get("DB_NAME")
            db_user = os.environ.get("DB_USER")
            db_pass = os.environ.get("DB_PASS")
            
            # Build database URL
            if db_host and db_name and db_user and db_pass:
                import urllib.parse
                encoded_pass = urllib.parse.quote_plus(db_pass)
                self.DATABASE_URL = f"postgresql://{db_user}:{encoded_pass}@{db_host}:{db_port}/{db_name}"
            else:
                # Fallback to legacy environment variables or hardcoded values
                postgres_pass = parent.POSTGRES_PASSWORD or os.environ.get("POSTGRES_PASSWORD", "")
                import urllib.parse
                encoded_pass = urllib.parse.quote_plus(postgres_pass)
                self.DATABASE_URL = f"postgresql://{parent.POSTGRES_USER}:{encoded_pass}@{parent.POSTGRES_SERVER}:{parent.POSTGRES_PORT}/{parent.POSTGRES_DB}"
            
            # Default connection pool settings
            self.POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "5"))
            self.POOL_OVERFLOW = int(os.environ.get("DB_POOL_OVERFLOW", "10"))
            self.POOL_TIMEOUT = int(os.environ.get("DB_POOL_TIMEOUT", "30"))
            self.POOL_RECYCLE = int(os.environ.get("DB_POOL_RECYCLE", "1800"))
    
    def __init__(self):
        # Initialize the database configuration
        self.database = self.DatabaseConfig(self)
    
    def dict(self):
        result = {k: getattr(self, k) for k in dir(self) if not k.startswith('_') and not callable(getattr(self, k)) and k != 'database'}
        result['database'] = {k: getattr(self.database, k) for k in dir(self.database) if not k.startswith('_') and not callable(getattr(self.database, k))}
        return result

# Try to create using pydantic-settings, fall back to hardcoded if it fails
try:
    settings = SimpleSettings()
    # Initialize database config
    if not hasattr(settings, 'database'):
        settings.init_database_config()
    logger.info(f"Settings created with CORS_ORIGINS: {settings.CORS_ORIGINS}")
    logger.info(f"Database URL: {settings.database.DATABASE_URL.split('@')[-1]}")
except Exception as e:
    logger.error(f"Error creating settings with pydantic-settings: {e}")
    logger.info("Falling back to hardcoded settings")
    settings = HardcodedSettings()
    logger.info(f"Hardcoded settings created with CORS_ORIGINS: {settings.CORS_ORIGINS}")
    logger.info(f"Database URL: {settings.database.DATABASE_URL.split('@')[-1]}")

# Create a dummy module to replace app.core.config
class DummyConfigModule(ModuleType):
    """A dummy module to replace app.core.config"""
    settings = settings
    Settings = SimpleSettings

# Create and register the dummy module
dummy_config = DummyConfigModule("app.core.config")
sys.modules["app.core.config"] = dummy_config

logger.info("Config module has been overridden") 