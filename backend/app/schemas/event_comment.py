from pydantic import BaseModel
from typing import Optional, Any, Dict
from datetime import datetime


class EventCommentBase(BaseModel):
    event_id: int
    content: str


class EventCommentCreate(EventCommentBase):
    pass


class EventCommentUpdate(BaseModel):
    content: Optional[str] = None


class EventComment(EventCommentBase):
    id: int
    user_id: int
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    comment_data: Optional[Dict[str, Any]] = None
    
    class Config:
        orm_mode = True


class EventCommentDetail(EventComment):
    username: str 