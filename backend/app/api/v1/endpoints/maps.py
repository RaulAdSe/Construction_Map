from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.map import Map, MapCreate, MapUpdate
from app.services import map as map_service
from app.services import project as project_service
from app.api.v1.endpoints.monitoring import log_user_activity

router = APIRouter()


@router.get("/", response_model=List[Map])
def get_maps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all maps for a project.
    """
    if not project_id:
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
    request: Request,
    project_id: int = Form(...),
    map_type: str = Form(...),
    name: str = Form(...),
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
    
    # Validate map_type
    if map_type not in ["implantation", "overlay"]:
        raise HTTPException(status_code=400, detail="Map type must be 'implantation' or 'overlay'")
    
    # Create map
    try:
        map_obj = await map_service.create_map(
            db, 
            project_id, 
            map_type, 
            name, 
            file, 
            transform_data
        )
        
        # Log user activity
        log_user_activity(
            user_id=current_user.id,
            username=current_user.username,
            action="map_upload",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin" if current_user.is_admin else "member",
            details={
                "project_id": project_id,
                "map_id": map_obj.id,
                "map_name": map_obj.name,
                "map_type": map_obj.map_type
            }
        )
        
        return map_obj
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create map: {str(e)}"
        )


@router.put("/{map_id}", response_model=Map)
def update_map(
    map_id: int,
    map_update: MapUpdate,
    request: Request,
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
        transform_data=map_update.transform_data,
        map_type=map_update.map_type
    )
    
    # Log user activity
    log_user_activity(
        user_id=current_user.id,
        username=current_user.username,
        action="map_update",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if current_user.is_admin else "member",
        details={
            "project_id": updated_map.project_id,
            "map_id": updated_map.id,
            "map_name": updated_map.name,
            "map_type": updated_map.map_type
        }
    )
    
    return updated_map


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_map(
    map_id: int,
    request: Request,
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
    
    # Log user activity before deleting the map
    log_user_activity(
        user_id=current_user.id,
        username=current_user.username,
        action="map_delete",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if current_user.is_admin else "member",
        details={
            "project_id": map_obj.project_id,
            "map_id": map_obj.id,
            "map_name": map_obj.name,
            "map_type": map_obj.map_type
        }
    )
    
    # Delete map
    success = map_service.delete_map(db, map_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete map")
    
    return None 