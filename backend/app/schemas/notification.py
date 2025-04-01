from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class NotificationBase(BaseModel):
    message: str
    link: str
    notification_type: str
    event_id: Optional[int] = None
    comment_id: Optional[int] = None


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationUpdate(BaseModel):
    read: Optional[bool] = None


class Notification(NotificationBase):
    id: int
    user_id: int
    read: bool
    created_at: datetime

    class Config:
        orm_mode = True


class NotificationList(BaseModel):
    notifications: List[Notification]
    unread_count: int 