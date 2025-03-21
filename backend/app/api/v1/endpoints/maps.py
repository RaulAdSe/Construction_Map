from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.map import Map, MapCreate, MapUpdate
from app.services import map as map_service
from app.services import project as project_service

router = APIRouter()


@router.get("/", response_model=List[Map])
def get_maps(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all maps for a project.
    """
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


@router.get("/{map_id}", response_model=Map)
def get_map(
    map_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific map.
    """
    # Get map
    map_obj = map_service.get_map(db, map_id)
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, map_obj.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return map_obj


@router.post("/", response_model=Map)
async def create_map(
    project_id: int = Form(...),
    map_type: str = Form(...),
    name: str = Form(...),
    version: float = Form(1.0),
    transform_data: Optional[Dict[str, Any]] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Upload a new map (PDF file).
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Validate file is PDF
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        map_obj = await map_service.create_map(
            db=db,
            project_id=project_id,
            map_type=map_type,
            name=name,
            version=version,
            file=file,
            transform_data=transform_data
        )
        return map_obj
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{map_id}", response_model=Map)
def update_map(
    map_id: int,
    map_update: MapUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update map details.
    """
    # Get map
    map_obj = map_service.get_map(db, map_id)
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, map_obj.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update map
    updated_map = map_service.update_map(
        db,
        map_id,
        name=map_update.name,
        transform_data=map_update.transform_data
    )
    
    return updated_map


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_map(
    map_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a map.
    """
    # Get map
    map_obj = map_service.get_map(db, map_id)
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, map_obj.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Delete map
    success = map_service.delete_map(db, map_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete map")
    
    return None 