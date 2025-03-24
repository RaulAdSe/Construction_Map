from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.map import Map
from app.services import map as map_service
from app.services import project as project_service

# Router specifically for maps nested under projects
nested_maps_router = APIRouter()

@nested_maps_router.get("/", response_model=List[Map])
async def get_project_maps(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all maps for a specific project.
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get maps
    maps_list = map_service.get_maps(db, project_id, skip, limit)
    return maps_list 