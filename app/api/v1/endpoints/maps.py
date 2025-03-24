from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Path
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.map import Map, MapCreate, MapUpdate
from app.services import map as map_service
from app.services import project as project_service

router = APIRouter()


@router.get("/", response_model=List[Map])
def get_maps(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all maps for a project.
    """
    if project_id is None:
        # Project ID is required either from path or query
        raise HTTPException(status_code=400, detail="Project ID is required")
        
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get maps
    maps = map_service.get_maps(db, project_id, skip, limit)
    return maps

# ... rest of the file remains unchanged 