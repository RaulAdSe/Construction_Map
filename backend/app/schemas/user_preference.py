from typing import Optional
from pydantic import BaseModel


class UserPreferenceBase(BaseModel):
    email_notifications: bool = True


class UserPreferenceCreate(UserPreferenceBase):
    user_id: int


class UserPreferenceUpdate(UserPreferenceBase):
    pass


class UserPreference(UserPreferenceBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True 