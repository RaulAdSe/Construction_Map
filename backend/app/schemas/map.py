from pydantic import BaseModel, computed_field
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.config import settings


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
    
    @computed_field
    def content_url(self) -> str:
        # Use HTTPS protocol to ensure Content Security Policy compliance
        from app.core.config import settings
        
        # In production, use the domain from settings with HTTPS
        base_url = "https://construction-map-backend-ypzdt6srya-uc.a.run.app"
        
        # For development, use localhost with HTTPS or domain override
        if settings.ENVIRONMENT == "development":
            base_url = "https://localhost:8000"
            
        return f"{base_url}/uploads/{self.filename}"
    
    class Config:
        orm_mode = True
        from_attributes = True 