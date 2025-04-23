import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import logging

from app.models.map import Map
from app.core.config import settings
from app.services.storage import save_file, delete_file, get_file_url


def get_map(db: Session, map_id: int) -> Optional[Map]:
    try:
        map_obj = db.query(Map).filter(Map.id == map_id).first()
        
        # If map was found but has no file_url, ensure it's explicitly set to None
        if map_obj and not hasattr(map_obj, 'file_url'):
            try:
                setattr(map_obj, 'file_url', None)
            except Exception as e:
                print(f"Warning: Could not set file_url on Map object: {str(e)}")
                
        return map_obj
        
    except Exception as e:
        print(f"Error retrieving map {map_id}: {str(e)}")
        
        # Try a fallback with just the basic columns
        try:
            print("Attempting fallback map retrieval...")
            map_data = db.query(
                Map.id, Map.project_id, Map.name, Map.map_type, 
                Map.filename, Map.uploaded_at
            ).filter(Map.id == map_id).first()
            
            if not map_data:
                return None
                
            # Create a Map object with minimal fields
            try:
                map_obj = Map(
                    id=map_data.id,
                    project_id=map_data.project_id,
                    name=map_data.name,
                    map_type=map_data.map_type,
                    filename=map_data.filename,
                    uploaded_at=map_data.uploaded_at,
                    file_url=None,  # Explicitly set to None to avoid issues
                    transform_data=None
                )
                return map_obj
            except Exception as inner_e:
                print(f"Error creating map object: {str(inner_e)}")
                return None
                
        except Exception as fallback_e:
            print(f"Fallback retrieval also failed: {str(fallback_e)}")
            return None


def get_maps(db: Session, project_id: int, skip: int = 0, limit: int = 100) -> List[Map]:
    try:
        maps = (db.query(Map)
                .filter(Map.project_id == project_id)
                .offset(skip)
                .limit(limit)
                .all())
                
        # Log successful retrieval
        print(f"Successfully retrieved {len(maps)} maps for project {project_id}")
        return maps
        
    except Exception as e:
        # Log error but return empty list instead of failing
        print(f"Error retrieving maps for project {project_id}: {str(e)}")
        
        # In case of error, try to get basic map data without processing relationships
        try:
            print("Attempting fallback map retrieval...")
            maps = (db.query(Map.id, Map.name, Map.map_type, Map.filename, Map.uploaded_at)
                    .filter(Map.project_id == project_id)
                    .offset(skip)
                    .limit(limit)
                    .all())
            
            # Convert the result tuples to Map objects with minimal fields
            basic_maps = []
            for map_data in maps:
                try:
                    map_obj = Map(
                        id=map_data.id,
                        project_id=project_id,
                        name=map_data.name,
                        map_type=map_data.map_type,
                        filename=map_data.filename,
                        uploaded_at=map_data.uploaded_at,
                        file_url=None,  # Explicitly set to None to avoid issues
                        transform_data=None
                    )
                    basic_maps.append(map_obj)
                except Exception as inner_e:
                    print(f"Error creating map object: {str(inner_e)}")
                    
            print(f"Fallback retrieved {len(basic_maps)} basic maps")
            return basic_maps
        except Exception as fallback_e:
            print(f"Fallback retrieval also failed: {str(fallback_e)}")
            return []


def get_implantation_map(db: Session, project_id: int) -> Optional[Map]:
    return (db.query(Map)
              .filter(Map.project_id == project_id, Map.map_type == 'implantation')
              .order_by(Map.uploaded_at.desc())
              .first())


async def save_map_file(file: UploadFile) -> str:
    """
    Save map file (PDF) to the storage system and return the filename
    
    This function is deprecated - use save_file from storage service instead
    """
    if file.content_type != "application/pdf":
        raise HTTPException(400, detail="Only PDF files are allowed")
    
    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_FOLDER, exist_ok=True)
    
    # Generate a unique filename
    filename = f"{uuid.uuid4()}.pdf"
    filepath = os.path.join(settings.UPLOAD_FOLDER, filename)
    
    # Save the file
    with open(filepath, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    return filename


async def create_map(
    db: Session, 
    project_id: int, 
    map_type: str, 
    name: str, 
    file: UploadFile,
    transform_data: Optional[Dict[str, Any]] = None
) -> Map:
    # Validate file type
    if file.content_type != "application/pdf":
        raise HTTPException(400, detail="Only PDF files are allowed")
    
    # Use the storage service to save the file
    filename, file_url = await save_file(
        upload_file=file,
        directory="maps",
        allowed_types=["application/pdf"],
        max_size=20 * 1024 * 1024  # 20MB limit for maps
    )
    
    # Create map object with required fields first
    map_obj = Map(
        project_id=project_id,
        map_type=map_type,
        name=name,
        filename=filename,
        transform_data=transform_data,
        uploaded_at=datetime.now()
    )
    
    # Try to set file_url if the field exists in the model
    try:
        map_obj.file_url = file_url
    except Exception as e:
        # Log the error but continue without setting file_url
        print(f"Warning: Could not set file_url on Map object: {str(e)}")
        print(f"File is still saved at: {file_url}")
    
    db.add(map_obj)
    db.commit()
    db.refresh(map_obj)
    return map_obj


def update_map(
    db: Session,
    map_id: int,
    name: Optional[str] = None,
    transform_data: Optional[Dict[str, Any]] = None,
    map_type: Optional[str] = None
) -> Optional[Map]:
    map_obj = get_map(db, map_id)
    if not map_obj:
        return None
    
    if name is not None:
        map_obj.name = name
    if transform_data is not None:
        map_obj.transform_data = transform_data
    if map_type is not None:
        map_obj.map_type = map_type
    
    db.commit()
    db.refresh(map_obj)
    return map_obj


def delete_map(db: Session, map_id: int) -> bool:
    map_obj = get_map(db, map_id)
    if not map_obj:
        return False
    
    # Delete file from storage system
    try:
        delete_file(map_obj.filename, directory="maps")
    except Exception as e:
        # Log error but continue
        print(f"Error deleting file {map_obj.filename}: {str(e)}")
    
    db.delete(map_obj)
    db.commit()
    return True


def get_file_url(filename: str, directory: str = "maps") -> str:
    """
    Get the URL for a map file using the storage service
    
    Args:
        filename: The filename to get URL for
        directory: Directory where the file is stored
        
    Returns:
        Full URL to the file in cloud storage or server
    """
    logger = logging.getLogger("map_service")
    
    try:
        # Check if running in Cloud Run environment
        import os
        in_cloud_run = os.getenv("K_SERVICE") is not None
        
        # Always use the storage service if available
        from app.services.storage import get_file_url as storage_get_file_url
        return storage_get_file_url(filename, directory)
    except Exception as e:
        logger.error(f"Error getting file URL from storage service for {filename}: {str(e)}")
        
        # Fallback to constructing the URL directly
        from app.core.config import settings
        import os
        
        # Check if we're using cloud storage or in Cloud Run
        in_cloud_run = os.getenv("K_SERVICE") is not None
        use_cloud_storage = in_cloud_run or os.getenv("USE_CLOUD_STORAGE", "false").lower() == "true"
        cloud_storage_bucket = os.getenv("CLOUD_STORAGE_BUCKET", "servitec-map-storage")
        
        if use_cloud_storage or in_cloud_run:
            # Force cloud storage in production
            full_path = f"{directory}/{filename}" if directory else filename
            full_path = full_path.strip("/")
            logger.info(f"Using cloud storage URL for {filename} in bucket {cloud_storage_bucket}")
            return f"https://storage.googleapis.com/{cloud_storage_bucket}/{full_path}"
        else:
            # Only use local URL in development
            logger.info(f"Using local URL for {filename}")
            if directory:
                return f"/uploads/{directory}/{filename}"
            else:
                return f"/uploads/{filename}" 