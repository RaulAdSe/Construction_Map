from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel

# Base model with common event fields
class EventBase(BaseModel):
    map_id: int
    title: str
    description: Optional[str] = None
    x_coordinate: float
    y_coordinate: float
    status: Optional[str] = "open"
    state: Optional[str] = "periodic check"
    active_maps: Optional[Dict[str, Any]] = {}
    image_url: Optional[str] = None

class EventCreate(BaseModel):
    map_id: int
    title: str
    description: Optional[str] = None
    x_coordinate: float
    y_coordinate: float
    status: Optional[str] = "open"
    state: Optional[str] = "periodic check"
    active_maps: Optional[Dict[str, Any]] = {}
    created_by_user_id: Optional[int] = None

# Add dedicated schemas for status and state updates
class EventStatusUpdate(BaseModel):
    status: str

class EventStateUpdate(BaseModel):
    state: str

class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by_user_id: int
    created_by_user_name: Optional[str] = None
    comment_count: Optional[int] = 0
    
    class Config:
        orm_mode = True 