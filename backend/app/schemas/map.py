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


class Map(MapBase):
    id: int
    filename: str
    uploaded_at: datetime
    
    @computed_field
    def content_url(self) -> str:
        # Use absolute URL with the backend base URL
        return f"http://localhost:8000/uploads/{self.filename}"
    
    class Config:
        orm_mode = True
        from_attributes = True 