from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


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
    
    class Config:
        orm_mode = True 