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
    
    # Configuration - use only model_config, not both Config and model_config
    model_config = SettingsConfigDict(env_file=".env.production", extra="ignore")
    
    def model_post_init(self, __context):
        # Add database configuration
        self.init_database_config()
        self.init_monitoring_config()
        self.init_cloud_db_config()
        self.init_security_config()
        self.init_email_config()
        self.init_storage_config()
    
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
    
    def init_monitoring_config(self):
        # Monitoring configuration
        class MonitoringConfig:
            def __init__(self):
                # Default monitoring settings
                self.HEALTH_CHECK_INTERVAL = int(os.environ.get("HEALTH_CHECK_INTERVAL", "60"))
                self.ENABLE_PERFORMANCE_TRACKING = os.environ.get("ENABLE_PERFORMANCE_TRACKING", "true").lower() in ("true", "1", "yes")
                self.LOG_SLOW_REQUESTS = True
                self.SLOW_REQUEST_THRESHOLD = float(os.environ.get("SLOW_REQUEST_THRESHOLD", "0.5"))  # in seconds
                self.ENABLE_REQUEST_LOGGING = True
                self.ENABLE_ERROR_REPORTING = True
                self.LOG_PATH = os.environ.get("LOG_PATH", "/app/logs")
                
        self.monitoring = MonitoringConfig()
    
    def init_cloud_db_config(self):
        # Cloud database configuration
        class CloudDBConfig:
            def __init__(self):
                self.ENABLED = True
                self.CLOUD_ENABLED = True
                self.CONNECTION_TIMEOUT = int(os.environ.get("CLOUD_DB_CONNECTION_TIMEOUT", "30"))
                self.RETRY_LIMIT = int(os.environ.get("CLOUD_DB_RETRY_LIMIT", "3"))
                self.SOCKET_PATH = os.environ.get("CLOUD_DB_SOCKET_PATH", "")
        
        self.cloud_db = CloudDBConfig()
    
    def init_security_config(self):
        # Security configuration
        class SecurityConfig:
            def __init__(self):
                self.JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours
                self.REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
                self.ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
                self.ALLOW_CORS_ORIGINS = os.environ.get("ALLOW_CORS_ORIGINS", "*").split(",")
        
        self.security = SecurityConfig()
    
    def init_email_config(self):
        # Email configuration
        class EmailConfig:
            def __init__(self):
                self.ENABLED = os.environ.get("EMAIL_ENABLED", "false").lower() in ("true", "1", "yes")
                self.SMTP_SERVER = os.environ.get("SMTP_SERVER", "")
                self.SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
                self.SMTP_USER = os.environ.get("SMTP_USER", "")
                self.SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
                self.FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@example.com")
        
        self.email = EmailConfig()
    
    def init_storage_config(self):
        # Storage configuration
        class StorageConfig:
            def __init__(self):
                self.ENABLED = True
                self.BUCKET_NAME = os.environ.get("GCP_STORAGE_BUCKET", "")
                self.PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
                self.UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/app/uploads")
        
        self.storage = StorageConfig()
    
    def dict(self) -> Dict[str, Any]:
        """Return settings as dict for compatibility"""
        result = {k: getattr(self, k) for k in dir(self) if not k.startswith('_') and not callable(getattr(self, k)) and k not in ['database', 'monitoring', 'cloud_db', 'security', 'email', 'storage']}
        if hasattr(self, 'database'):
            result['database'] = {k: getattr(self.database, k) for k in dir(self.database) if not k.startswith('_') and not callable(getattr(self.database, k))}
        if hasattr(self, 'monitoring'):
            result['monitoring'] = {k: getattr(self.monitoring, k) for k in dir(self.monitoring) if not k.startswith('_') and not callable(getattr(self.monitoring, k))}
        if hasattr(self, 'cloud_db'):
            result['cloud_db'] = {k: getattr(self.cloud_db, k) for k in dir(self.cloud_db) if not k.startswith('_') and not callable(getattr(self.cloud_db, k))}
        if hasattr(self, 'security'):
            result['security'] = {k: getattr(self.security, k) for k in dir(self.security) if not k.startswith('_') and not callable(getattr(self.security, k))}
        if hasattr(self, 'email'):
            result['email'] = {k: getattr(self.email, k) for k in dir(self.email) if not k.startswith('_') and not callable(getattr(self.email, k))}
        if hasattr(self, 'storage'):
            result['storage'] = {k: getattr(self.storage, k) for k in dir(self.storage) if not k.startswith('_') and not callable(getattr(self.storage, k))}
        return result

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
    
    # Monitoring configuration
    class MonitoringConfig:
        def __init__(self):
            # Default monitoring settings
            self.HEALTH_CHECK_INTERVAL = int(os.environ.get("HEALTH_CHECK_INTERVAL", "60"))
            self.ENABLE_PERFORMANCE_TRACKING = os.environ.get("ENABLE_PERFORMANCE_TRACKING", "true").lower() in ("true", "1", "yes")
            self.LOG_SLOW_REQUESTS = True
            self.SLOW_REQUEST_THRESHOLD = float(os.environ.get("SLOW_REQUEST_THRESHOLD", "0.5"))  # in seconds
            self.ENABLE_REQUEST_LOGGING = True
            self.ENABLE_ERROR_REPORTING = True
            self.LOG_PATH = os.environ.get("LOG_PATH", "/app/logs")
    
    # Cloud DB configuration
    class CloudDBConfig:
        def __init__(self):
            self.ENABLED = True
            self.CLOUD_ENABLED = True
            self.CONNECTION_TIMEOUT = int(os.environ.get("CLOUD_DB_CONNECTION_TIMEOUT", "30"))
            self.RETRY_LIMIT = int(os.environ.get("CLOUD_DB_RETRY_LIMIT", "3"))
            self.SOCKET_PATH = os.environ.get("CLOUD_DB_SOCKET_PATH", "")
    
    # Security configuration
    class SecurityConfig:
        def __init__(self):
            self.JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours
            self.REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
            self.ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
            self.ALLOW_CORS_ORIGINS = os.environ.get("ALLOW_CORS_ORIGINS", "*").split(",")
    
    # Email configuration
    class EmailConfig:
        def __init__(self):
            self.ENABLED = os.environ.get("EMAIL_ENABLED", "false").lower() in ("true", "1", "yes")
            self.SMTP_SERVER = os.environ.get("SMTP_SERVER", "")
            self.SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
            self.SMTP_USER = os.environ.get("SMTP_USER", "")
            self.SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
            self.FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@example.com")
    
    # Storage configuration
    class StorageConfig:
        def __init__(self):
            self.ENABLED = True
            self.BUCKET_NAME = os.environ.get("GCP_STORAGE_BUCKET", "")
            self.PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "")
            self.UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "/app/uploads")
    
    def __init__(self):
        # Initialize the database configuration
        self.database = self.DatabaseConfig(self)
        # Initialize monitoring configuration
        self.monitoring = self.MonitoringConfig()
        # Initialize cloud DB configuration
        self.cloud_db = self.CloudDBConfig()
        # Initialize security configuration
        self.security = self.SecurityConfig()
        # Initialize email configuration
        self.email = self.EmailConfig()
        # Initialize storage configuration
        self.storage = self.StorageConfig()
    
    def dict(self):
        result = {k: getattr(self, k) for k in dir(self) if not k.startswith('_') and not callable(getattr(self, k)) and k not in ['database', 'monitoring', 'cloud_db', 'security', 'email', 'storage']}
        result['database'] = {k: getattr(self.database, k) for k in dir(self.database) if not k.startswith('_') and not callable(getattr(self.database, k))}
        result['monitoring'] = {k: getattr(self.monitoring, k) for k in dir(self.monitoring) if not k.startswith('_') and not callable(getattr(self.monitoring, k))}
        result['cloud_db'] = {k: getattr(self.cloud_db, k) for k in dir(self.cloud_db) if not k.startswith('_') and not callable(getattr(self.cloud_db, k))}
        result['security'] = {k: getattr(self.security, k) for k in dir(self.security) if not k.startswith('_') and not callable(getattr(self.security, k))}
        result['email'] = {k: getattr(self.email, k) for k in dir(self.email) if not k.startswith('_') and not callable(getattr(self.email, k))}
        result['storage'] = {k: getattr(self.storage, k) for k in dir(self.storage) if not k.startswith('_') and not callable(getattr(self.storage, k))}
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