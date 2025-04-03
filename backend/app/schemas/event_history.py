from typing import Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel


class EventHistoryBase(BaseModel):
    event_id: int
    user_id: int
    action_type: str
    previous_value: Optional[str] = None
    new_value: Optional[str] = None
    additional_data: Optional[Dict[str, Any]] = None


class EventHistoryCreate(EventHistoryBase):
    pass


class EventHistory(EventHistoryBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class EventHistoryDetail(EventHistory):
    """Detailed event history with user information"""
    username: Optional[str] = None
    event_title: Optional[str] = None 