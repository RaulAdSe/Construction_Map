from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Request
from sqlalchemy.orm import Session
import os
from datetime import datetime

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.map import Map, MapCreate, MapUpdate
from app.services import map as map_service
from app.services import project as project_service
from app.api.v1.endpoints.monitoring import log_user_activity

from fastapi.responses import JSONResponse  # Import missing JSONResponse
import traceback  # Import missing module for traceback
import sys

# Import ALLOWED_ORIGINS from main.py if available
try:
    from main import ALLOWED_ORIGINS
except ImportError:
    # Fallback if import fails
    ALLOWED_ORIGINS = [
        "https://construction-map-frontend-ypzdt6srya-uc.a.run.app",
        "https://construction-map-frontend-77413952899.us-central1.run.app",
        "https://coordino.servitecingenieria.com",
        "http://localhost:3000"
    ]

router = APIRouter()


@router.get("/", response_model=List[Map])
def get_maps(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    project_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100
):
    try:
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
        
        # Fix any maps with NULL uploaded_at values before returning
        for map_obj in maps:
            if not hasattr(map_obj, 'uploaded_at') or map_obj.uploaded_at is None:
                map_obj.uploaded_at = datetime.now()
                
        # Ensure all maps have cloud storage URLs in production
        in_cloud_run = os.getenv("K_SERVICE") is not None
        if in_cloud_run:
            from app.services.storage import get_file_url
            for map_obj in maps:
                # Only update if file_url is missing
                if not map_obj.file_url and map_obj.filename:
                    try:
                        map_obj.file_url = get_file_url(map_obj.filename, directory="maps")
                    except Exception as e:
                        print(f"Error generating file_url for map {map_obj.id}: {str(e)}")
        
        return maps
    
    except Exception as e:
        # Log detailed error for troubleshooting
        print(f"Error in get_maps: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        
        # Get origin from request
        origin = request.headers.get("origin", "")
        
        # If origin is in allowed origins, use it; otherwise use default
        if origin in ALLOWED_ORIGINS:
            response_origin = origin
        else:
            response_origin = ALLOWED_ORIGINS[0]
        
        # Return error with CORS headers
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error accessing maps: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": response_origin,
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
            }
        )


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
    
    # Ensure the map has a file_url (particularly in cloud environment)
    in_cloud_run = os.getenv("K_SERVICE") is not None
    if (in_cloud_run or not map_obj.file_url) and map_obj.filename:
        try:
            # Update the file_url
            map_obj.file_url = map_service.get_file_url(map_obj.filename, directory="maps")
            
            # Ensure URL uses HTTPS
            if map_obj.file_url and map_obj.file_url.startswith('http:'):
                map_obj.file_url = map_obj.file_url.replace('http:', 'https:')
                print(f"Converted map URL from HTTP to HTTPS: {map_obj.file_url}")
            
            # Only persist to DB if we're in cloud run to ensure URLs are saved
            if in_cloud_run:
                db.commit()
        except Exception as e:
            print(f"Error updating file_url for map {map_id}: {str(e)}")
            # Set a default cloud storage URL if we're in cloud run and something went wrong
            if in_cloud_run and map_obj.filename:
                bucket_name = os.getenv("CLOUD_STORAGE_BUCKET", "servitec-map-storage")
                map_obj.file_url = f"https://storage.googleapis.com/{bucket_name}/maps/{map_obj.filename}"
    
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


@router.post("/update-file-urls", response_model=Dict[str, Any])
def update_map_file_urls(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update file_url for all maps that have NULL file_url.
    Only admins can run this operation.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only administrators can perform this operation")
    
    try:
        # Get all maps with NULL file_url
        maps_to_update = db.query(Map).filter(Map.file_url.is_(None)).all()
        
        updated_count = 0
        not_updated_count = 0
        
        # Process each map
        for map_obj in maps_to_update:
            try:
                if map_obj.filename:
                    # Get the correct URL using the storage service
                    file_url = map_service.get_file_url(map_obj.filename, directory="maps")
                    
                    # Ensure URL uses HTTPS
                    if file_url and file_url.startswith('http:'):
                        file_url = file_url.replace('http:', 'https:')
                    
                    map_obj.file_url = file_url
                    updated_count += 1
                else:
                    not_updated_count += 1
            except Exception as e:
                print(f"Error updating file_url for map {map_obj.id}: {str(e)}")
                not_updated_count += 1
        
        # Update ALL maps to ensure they use HTTPS (not just NULL ones)
        maps_with_http = db.query(Map).filter(Map.file_url.like('http:%')).all()
        http_fixed_count = 0
        
        for map_obj in maps_with_http:
            if map_obj.file_url and map_obj.file_url.startswith('http:'):
                map_obj.file_url = map_obj.file_url.replace('http:', 'https:')
                http_fixed_count += 1
        
        # Commit changes
        db.commit()
        
        # Log the activity
        log_user_activity(
            user_id=current_user.id,
            username=current_user.username,
            action="update_map_urls",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin",
            details={
                "updated_count": updated_count,
                "not_updated_count": not_updated_count,
                "http_fixed_count": http_fixed_count,
                "total_processed": len(maps_to_update) + len(maps_with_http)
            }
        )
        
        return {
            "success": True,
            "updated_count": updated_count,
            "not_updated_count": not_updated_count,
            "http_fixed_count": http_fixed_count,
            "total_processed": len(maps_to_update) + len(maps_with_http)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update map file URLs: {str(e)}"
        )


@router.get("/check-mixed-content", response_model=Dict[str, Any])
def check_mixed_content(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Check for potential mixed content issues with map URLs.
    Returns maps that have HTTP URLs which could cause mixed content warnings.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only administrators can perform this operation")
    
    try:
        # Find maps with HTTP URLs
        http_maps = db.query(Map).filter(Map.file_url.like('http:%')).all()
        
        # Get a sample of maps for checking
        sample_maps = db.query(Map).limit(5).all()
        
        # Check storage service configuration
        storage_info = {
            "cloud_storage_enabled": os.getenv("USE_CLOUD_STORAGE", "false").lower() == "true",
            "storage_bucket": os.getenv("CLOUD_STORAGE_BUCKET", "servitec-map-storage"),
            "in_cloud_run": os.getenv("K_SERVICE") is not None
        }
        
        # Collect data about each map for diagnosis
        map_data = []
        for map_obj in http_maps + sample_maps:
            # Skip duplicates
            if any(m["id"] == map_obj.id for m in map_data):
                continue
                
            # Get map details for diagnosis
            map_data.append({
                "id": map_obj.id,
                "name": map_obj.name,
                "filename": map_obj.filename,
                "file_url": map_obj.file_url,
                "has_http": map_obj.file_url and map_obj.file_url.startswith('http:') if map_obj.file_url else False,
                "computed_url": map_service.get_file_url(map_obj.filename, directory="maps") if map_obj.filename else None,
            })
        
        return {
            "maps_with_http": len(http_maps),
            "storage_config": storage_info,
            "sample_maps": map_data,
            "in_cloud_run": os.getenv("K_SERVICE") is not None
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check mixed content: {str(e)}"
        ) 