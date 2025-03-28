from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime


class EventBase(BaseModel):
    project_id: int
    map_id: int
    title: str
    description: Optional[str] = None
    status: Optional[str] = "open"
    state: Optional[str] = "green"
    active_maps: Optional[Dict[str, Any]] = None
    x_coordinate: float
    y_coordinate: float
    tags: Optional[List[str]] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    state: Optional[str] = None
    tags: Optional[List[str]] = None
    is_admin_request: Optional[bool] = False


class Event(EventBase):
    id: int
    created_by_user_id: int
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True


class EventDetail(Event):
    created_by_user_name: str
    comment_count: Optional[int] = 0 