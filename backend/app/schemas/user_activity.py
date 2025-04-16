from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class UserActivityBase(BaseModel):
    user_id: Optional[int] = None
    username: str
    action: str
    ip_address: Optional[str] = None
    user_type: str
    details: Optional[Dict[str, Any]] = None


class UserActivityCreate(UserActivityBase):
    pass


class UserActivity(UserActivityBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
        
        
class UserActivityList(BaseModel):
    total: int
    activities: list[UserActivity] 