from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any
import os
import json


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


class Settings(BaseSettings):
    # Base
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Construction Map API"
    DEBUG: bool = False
    
    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "construction_map")
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    
    # Cloud Database Settings
    cloud_db: CloudDatabaseSettings = CloudDatabaseSettings()
    
    # Monitoring Settings
    monitoring: MonitoringSettings = MonitoringSettings()
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development-only")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # File Storage
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "./uploads")
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16MB limit for file uploads
    
    # Additional engine configuration
    ENGINE_ARGS: Dict[str, Any] = {}
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Create logs directory if it doesn't exist
        os.makedirs(self.monitoring.LOG_PATH, exist_ok=True)
        
        # Configure SQLAlchemy engine arguments
        self.ENGINE_ARGS = {
            "pool_pre_ping": True,  # Test connections before using them
            "pool_size": 5,         # Default connection pool size
            "max_overflow": 10,     # Max number of connections beyond pool_size
            "pool_timeout": 30,     # Seconds to wait for a connection from the pool
            "pool_recycle": 1800,   # Recycle connections after 30 minutes
        }
        
        # Configure database URI based on whether cloud database is enabled
        if self.cloud_db.CLOUD_ENABLED and self.cloud_db.CONNECTION_STRING:
            self.SQLALCHEMY_DATABASE_URI = self.cloud_db.CONNECTION_STRING
            # Update engine args with cloud-specific settings
            self.ENGINE_ARGS.update({
                "pool_size": self.cloud_db.POOL_SIZE,
                "max_overflow": self.cloud_db.MAX_OVERFLOW,
                "pool_timeout": self.cloud_db.POOL_TIMEOUT,
                "pool_recycle": self.cloud_db.POOL_RECYCLE,
            })
            
            # Add SSL configuration if provided
            if self.cloud_db.SSL_MODE:
                self.ENGINE_ARGS["connect_args"] = {
                    "sslmode": self.cloud_db.SSL_MODE
                }
                
                if self.cloud_db.SSL_CA_CERT:
                    self.ENGINE_ARGS["connect_args"]["sslrootcert"] = self.cloud_db.SSL_CA_CERT
        else:
            # Standard database connection
            self.SQLALCHEMY_DATABASE_URI = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings() 