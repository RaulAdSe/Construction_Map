from pydantic import BaseModel, computed_field
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.config import settings
import os


class MapBase(BaseModel):
    project_id: int
    map_type: str  # 'implantation' or 'overlay'
    name: str
    transform_data: Optional[Dict[str, Any]] = None


class MapCreate(MapBase):
    pass


class MapUpdate(BaseModel):
    name: Optional[str] = None
    transform_data: Optional[Dict[str, Any]] = None
    map_type: Optional[str] = None


class Map(MapBase):
    id: int
    filename: str
    uploaded_at: datetime
    file_url: Optional[str] = None
    
    @computed_field
    def content_url(self) -> str:
        # Check if running in Cloud Run environment
        in_cloud_run = os.getenv("K_SERVICE") is not None
        
        # If we have a valid file_url from cloud storage, use that directly
        # Check for None or empty string
        if self.file_url and self.file_url.strip():
            # Ensure URL uses HTTPS
            file_url = self.file_url
            if file_url.startswith('http:'):
                file_url = file_url.replace('http:', 'https:')
            return file_url
        
        # In production/Cloud Run, we MUST have cloud storage URLs
        if in_cloud_run:
            # Generate a GCS URL for the file
            bucket_name = os.getenv("CLOUD_STORAGE_BUCKET", "servitec-map-storage")
            return f"https://storage.googleapis.com/{bucket_name}/maps/{self.filename}"
            
        # Only for local development, fallback to local storage URL
        # In production this code should never execute
        from app.core.config import settings
        
        if settings.DEBUG:
            # In debug mode, use localhost with HTTPS
            base_url = "https://localhost:8000"
        else:
            # In production but not Cloud Run, use secure backend URL
            base_url = "https://construction-map-backend-ypzdt6srya-uc.a.run.app"
            
        return f"{base_url}/uploads/maps/{self.filename}"
    
    class Config:
        orm_mode = True
        from_attributes = True 