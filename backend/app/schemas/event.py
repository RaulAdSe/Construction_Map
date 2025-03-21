from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


class EventBase(BaseModel):
    project_id: int
    map_id: int
    title: str
    description: Optional[str] = None
    status: Optional[str] = "open"
    active_maps: Optional[str] = None
    x_coordinate: float
    y_coordinate: float
    tags: Optional[List[str]] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


class Event(EventBase):
    id: int
    created_by_user_id: int
    image_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        orm_mode = True


class EventDetail(Event):
    created_by_user_name: str 