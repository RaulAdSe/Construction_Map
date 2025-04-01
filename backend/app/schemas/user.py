from pydantic import BaseModel, EmailStr
from typing import Optional, List


class UserBase(BaseModel):
    username: str
    email: EmailStr
    is_admin: bool = False


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserInDBBase(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True


class User(UserInDBBase):
    pass


class UserResponse(UserInDBBase):
    """User response schema without sensitive information"""
    pass


class UserInDB(UserInDBBase):
    password_hash: str


class ProjectMember(User):
    """User with additional project-specific information"""
    field: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None 