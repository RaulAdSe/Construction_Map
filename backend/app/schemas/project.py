from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProjectUserBase(BaseModel):
    project_id: int
    user_id: int


class ProjectUserCreate(ProjectUserBase):
    pass


class ProjectUser(ProjectUserBase):
    class Config:
        orm_mode = True


class Project(ProjectBase):
    id: int
    users: List[ProjectUser] = []
    
    class Config:
        orm_mode = True


class ProjectDetail(Project):
    user_count: int = 0
    map_count: int = 0
    event_count: int = 0 