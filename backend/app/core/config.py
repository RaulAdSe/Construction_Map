from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any, List, Union
import os
import json
import secrets
import logging
import pathlib
from pydantic import validator, AnyHttpUrl

logger = logging.getLogger(__name__)

# Function to get or create a stable SECRET_KEY
def get_or_create_secret_key():
    # First check if an environment variable is set
    env_key = os.getenv("SECRET_KEY")
    if env_key:
        logger.info("Using SECRET_KEY from environment variables")
        return env_key
    
    # Next, try to load from a file
    key_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".secret_key")
    try:
        if os.path.exists(key_file):
            with open(key_file, "r") as f:
                secret_key = f.read().strip()
                if secret_key:
                    logger.info("Using SECRET_KEY from file")
                    return secret_key
    except Exception as e:
        logger.warning(f"Error reading SECRET_KEY file: {e}")

    # If no file exists or couldn't read it, generate a new key
    logger.info("Generating new SECRET_KEY and saving to file")
    new_key = secrets.token_hex(32)  
    
    # Try to save the key for future use
    try:
        with open(key_file, "w") as f:
            f.write(new_key)
        logger.info(f"Saved new SECRET_KEY to {key_file}")
    except Exception as e:
        logger.warning(f"Could not save SECRET_KEY to file: {e}")
        
    return new_key


class CloudDatabaseSettings(BaseSettings):
    """Cloud database specific settings"""
    CLOUD_ENABLED: bool = os.getenv("CLOUD_DB_ENABLED", "false").lower() == "true"
    CONNECTION_STRING: Optional[str] = os.getenv("CLOUD_DB_CONNECTION_STRING")
    POOL_SIZE: int = int(os.getenv("CLOUD_DB_POOL_SIZE", "5"))
    MAX_OVERFLOW: int = int(os.getenv("CLOUD_DB_MAX_OVERFLOW", "10"))
    POOL_TIMEOUT: int = int(os.getenv("CLOUD_DB_POOL_TIMEOUT", "30"))
    POOL_RECYCLE: int = int(os.getenv("CLOUD_DB_POOL_RECYCLE", "600"))  # 10 minutes
    IAM_AUTHENTICATION: bool = os.getenv("CLOUD_DB_IAM_AUTHENTICATION", "false").lower() == "true"
    INSTANCE_CONNECTION_NAME: str = os.getenv("CLOUD_DB_INSTANCE", "")
    IAM_USER: str = os.getenv("CLOUD_DB_IAM_USER", "")
    DB_NAME: str = os.getenv("CLOUD_DB_NAME", "construction_map")
    SSL_MODE: str = os.getenv("CLOUD_DB_SSL_MODE", "require")
    SSL_CA_CERT: Optional[str] = os.getenv("CLOUD_DB_SSL_CA_CERT")
    
    class Config:
        env_file = ".env"
        extra = "ignore"


class MonitoringSettings(BaseSettings):
    """Monitoring specific settings"""
    SLOW_QUERY_THRESHOLD: float = float(os.getenv("SLOW_QUERY_THRESHOLD", "0.5"))  # in seconds
    ACTIVITY_RETENTION_DAYS: int = int(os.getenv("ACTIVITY_RETENTION_DAYS", "90"))
    MAX_ACTIVITIES_PER_USER: int = int(os.getenv("MAX_ACTIVITIES_PER_USER", "1000"))
    MAX_SLOW_QUERIES: int = int(os.getenv("MAX_SLOW_QUERIES", "100"))
    LOG_PATH: str = os.getenv("LOG_PATH", "./logs")
    
    class Config:
        env_file = ".env"
        extra = "ignore"


class EmailSettings(BaseSettings):
    """Email configuration settings."""
    
    # SMTP Settings
    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", "465"))
    EMAIL_USERNAME: str = os.getenv("EMAIL_USERNAME", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "")
    EMAIL_TLS: bool = os.getenv("EMAIL_TLS", "False").lower() == "true"
    EMAIL_SSL: bool = os.getenv("EMAIL_SSL", "True").lower() == "true"
    
    class Config:
        env_file = ".env"
        extra = "ignore"


class Settings(BaseSettings):
    # Base
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Construction Map API"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"  # Default to True for development
    
    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "construction_map")
    DATABASE_URL: Optional[str] = None
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    
    # Cloud Database Settings
    cloud_db: CloudDatabaseSettings = CloudDatabaseSettings()
    
    # Monitoring Settings
    monitoring: MonitoringSettings = MonitoringSettings()
    
    # Email Settings
    email: EmailSettings = EmailSettings()
    
    # Security
    SECRET_KEY: str = get_or_create_secret_key()
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days default
    
    # File Storage
    UPLOAD_FOLDER: str = os.getenv("UPLOAD_FOLDER", "./uploads")
    
    # CORS
    CORS_ORIGINS: List[AnyHttpUrl] = []
    CORS_ORIGINS_REGEX: Optional[str] = None
    CORS_HEADERS: List[str] = []
    
    # Email settings directly accessible from settings.EMAIL_HOST, etc.
    EMAIL_HOST: str = email.EMAIL_HOST
    EMAIL_PORT: int = email.EMAIL_PORT
    EMAIL_USERNAME: str = email.EMAIL_USERNAME
    EMAIL_PASSWORD: str = email.EMAIL_PASSWORD
    EMAIL_FROM: str = email.EMAIL_FROM
    EMAIL_TLS: bool = email.EMAIL_TLS
    EMAIL_SSL: bool = email.EMAIL_SSL
    
    # Additional engine configuration
    ENGINE_ARGS: Dict[str, Any] = {}
    
    @validator("DATABASE_URL", pre=True)
    def assemble_db_url(cls, v: Optional[str], values: Dict[str, Any]) -> str:
        if v and isinstance(v, str):
            return v
        
        return f"postgresql://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}:{values.get('POSTGRES_PORT')}/{values.get('POSTGRES_DB')}"

    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Allow extra attributes (fixes the case sensitivity issue)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Check if running in Cloud Run
        in_cloud_run = os.getenv("K_SERVICE") is not None
        
        # Create logs directory if it doesn't exist and we're not in Cloud Run
        try:
            if not in_cloud_run:  # Only create directories locally
                if self.monitoring.LOG_PATH.startswith('/app'):
                    self.monitoring.LOG_PATH = './logs'
                os.makedirs(self.monitoring.LOG_PATH, exist_ok=True)
        except OSError as e:
            if 'Read-only file system' in str(e) and in_cloud_run:
                logger.warning(f"Skipping directory creation in Cloud Run environment: {e}")
            else:
                # Re-raise if not in Cloud Run or if a different error
                logger.warning(f"Error creating logs directory: {e}")
        
        # Create uploads directory if it doesn't exist
        try:
            if not in_cloud_run:  # Only create directories locally
                if self.UPLOAD_FOLDER.startswith('/app'):
                    self.UPLOAD_FOLDER = './uploads'
                os.makedirs(self.UPLOAD_FOLDER, exist_ok=True)
        except OSError as e:
            if 'Read-only file system' in str(e) and in_cloud_run:
                logger.warning(f"Skipping uploads directory creation in Cloud Run environment: {e}")
            else:
                # Re-raise if not in Cloud Run or if a different error
                logger.warning(f"Error creating uploads directory: {e}")
        
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
            self.DATABASE_URL = self.cloud_db.CONNECTION_STRING
            # Update engine args with cloud-specific settings
            self.ENGINE_ARGS.update({
                "pool_size": self.cloud_db.POOL_SIZE,
                "max_overflow": self.cloud_db.MAX_OVERFLOW,
                "pool_timeout": self.cloud_db.POOL_TIMEOUT,
                "pool_recycle": self.cloud_db.POOL_RECYCLE,
            })
            
            # Add SSL configuration if provided, but only if not using pg8000
            # Since pg8000 doesn't support sslmode argument
            if self.cloud_db.SSL_MODE and "pg8000" not in self.cloud_db.CONNECTION_STRING:
                self.ENGINE_ARGS["connect_args"] = {
                    "sslmode": self.cloud_db.SSL_MODE
                }
                
                if self.cloud_db.SSL_CA_CERT:
                    self.ENGINE_ARGS["connect_args"]["sslrootcert"] = self.cloud_db.SSL_CA_CERT
        else:
            # Standard database connection
            self.DATABASE_URL = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
        # Set SQLAlchemy database URI to same as DATABASE_URL
        self.SQLALCHEMY_DATABASE_URI = self.DATABASE_URL


settings = Settings() 