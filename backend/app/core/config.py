from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any, List
import os
import json
import logging

logger = logging.getLogger(__name__)

class DatabaseSettings(BaseSettings):
    """Database connection settings"""
    SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    PORT: str = os.getenv("POSTGRES_PORT", "5432")
    USER: str = os.getenv("POSTGRES_USER", "postgres")
    PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    DB: str = os.getenv("POSTGRES_DB", "servitec_map")
    
    # Connection pool settings
    POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "5"))
    POOL_OVERFLOW: int = int(os.getenv("DB_POOL_OVERFLOW", "10"))
    POOL_TIMEOUT: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    POOL_RECYCLE: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 minutes
    
    # Direct URL from environment (overrides individual settings if provided)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set the connection URL if not directly provided
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"postgresql://{self.USER}:{self.PASSWORD}@{self.SERVER}:{self.PORT}/{self.DB}"
        
        logger.info(f"Database configured with pool size {self.POOL_SIZE}, max overflow {self.POOL_OVERFLOW}")


class CloudDatabaseSettings(BaseSettings):
    """Cloud database specific settings"""
    CLOUD_ENABLED: bool = os.getenv("CLOUD_DB_ENABLED", "false").lower() == "true"
    CONNECTION_STRING: Optional[str] = os.getenv("CLOUD_DB_CONNECTION_STRING")
    POOL_SIZE: int = int(os.getenv("CLOUD_DB_POOL_SIZE", "5"))
    MAX_OVERFLOW: int = int(os.getenv("CLOUD_DB_MAX_OVERFLOW", "10"))
    POOL_TIMEOUT: int = int(os.getenv("CLOUD_DB_POOL_TIMEOUT", "30"))
    POOL_RECYCLE: int = int(os.getenv("CLOUD_DB_POOL_RECYCLE", "1800"))  # 30 minutes
    SSL_MODE: str = os.getenv("CLOUD_DB_SSL_MODE", "require")
    SSL_CA_CERT: Optional[str] = os.getenv("CLOUD_DB_SSL_CA_CERT")


class MonitoringSettings(BaseSettings):
    """Monitoring specific settings"""
    SLOW_QUERY_THRESHOLD: float = float(os.getenv("SLOW_QUERY_THRESHOLD", "0.5"))  # in seconds
    ACTIVITY_RETENTION_DAYS: int = int(os.getenv("ACTIVITY_RETENTION_DAYS", "90"))
    MAX_ACTIVITIES_PER_USER: int = int(os.getenv("MAX_ACTIVITIES_PER_USER", "1000"))
    MAX_SLOW_QUERIES: int = int(os.getenv("MAX_SLOW_QUERIES", "100"))
    LOG_PATH: str = os.getenv("LOG_PATH", "./logs")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")


class SecuritySettings(BaseSettings):
    """Security specific settings"""
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "11520"))  # 8 days
    ALGORITHM: str = "HS256"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Check if we're in production with a weak default key
        if os.getenv("ENVIRONMENT") == "production" and self.SECRET_KEY == "your-secret-key-for-development-only":
            logger.warning("WARNING: Using default SECRET_KEY in production environment!")


class StorageSettings(BaseSettings):
    """File storage settings"""
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "./uploads")
    MAX_CONTENT_LENGTH: int = int(os.getenv("MAX_CONTENT_LENGTH", "16777216"))  # 16MB limit for file uploads
    CLOUD_STORAGE_ENABLED: bool = os.getenv("CLOUD_STORAGE_ENABLED", "false").lower() == "true"
    GCP_PROJECT_ID: Optional[str] = os.getenv("GCP_PROJECT_ID")
    GCP_STORAGE_BUCKET: Optional[str] = os.getenv("GCP_STORAGE_BUCKET")


class Settings(BaseSettings):
    # Base
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Construction Map API"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    VERSION: str = "1.0.0"
    
    # Modular settings
    database: DatabaseSettings = DatabaseSettings()
    cloud_db: CloudDatabaseSettings = CloudDatabaseSettings()
    monitoring: MonitoringSettings = MonitoringSettings()
    security: SecuritySettings = SecuritySettings()
    storage: StorageSettings = StorageSettings()
    
    # CORS settings
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Create logs directory if it doesn't exist
        os.makedirs(self.monitoring.LOG_PATH, exist_ok=True)
        
        # Create uploads directory if it doesn't exist
        os.makedirs(self.storage.UPLOAD_FOLDER, exist_ok=True)
        
        # Log configuration summary
        logger.info(f"Application initialized in {self.ENVIRONMENT} environment")
        logger.info(f"Debug mode: {self.DEBUG}")
        
        if self.ENVIRONMENT == "production":
            # Validate production configuration
            self._validate_production_config()
    
    def _validate_production_config(self):
        """Validate that production configuration meets requirements"""
        warnings = []
        
        # Check for weak secret key
        if self.security.SECRET_KEY == "your-secret-key-for-development-only":
            warnings.append("Using default SECRET_KEY in production")
        
        # Check for proper database configuration
        if "localhost" in self.database.DATABASE_URL or "127.0.0.1" in self.database.DATABASE_URL:
            warnings.append("Using localhost database in production")
        
        # Check for proper CORS configuration
        if any(origin in ["http://localhost:3000", "http://127.0.0.1:3000"] for origin in self.CORS_ORIGINS):
            warnings.append("Using development CORS origins in production")
        
        # Log any warnings
        if warnings:
            for warning in warnings:
                logger.warning(f"PRODUCTION WARNING: {warning}")


settings = Settings() 