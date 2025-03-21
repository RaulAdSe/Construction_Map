import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.models.map import Map
from app.core.config import settings


def get_map(db: Session, map_id: int) -> Optional[Map]:
    return db.query(Map).filter(Map.id == map_id).first()


def get_maps(db: Session, project_id: int, skip: int = 0, limit: int = 100) -> List[Map]:
    return (db.query(Map)
              .filter(Map.project_id == project_id)
              .offset(skip)
              .limit(limit)
              .all())


def get_implantation_map(db: Session, project_id: int) -> Optional[Map]:
    return (db.query(Map)
              .filter(Map.project_id == project_id, Map.map_type == 'implantation')
              .order_by(Map.uploaded_at.desc())
              .first())


async def save_map_file(file: UploadFile) -> str:
    """Save map file (PDF) to the upload directory and return the filename"""
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
    filename = await save_map_file(file)
    
    map_obj = Map(
        project_id=project_id,
        map_type=map_type,
        name=name,
        filename=filename,
        transform_data=transform_data
    )
    
    db.add(map_obj)
    db.commit()
    db.refresh(map_obj)
    return map_obj


def update_map(
    db: Session,
    map_id: int,
    name: Optional[str] = None,
    transform_data: Optional[Dict[str, Any]] = None
) -> Optional[Map]:
    map_obj = get_map(db, map_id)
    if not map_obj:
        return None
    
    if name is not None:
        map_obj.name = name
    if transform_data is not None:
        map_obj.transform_data = transform_data
    
    db.commit()
    db.refresh(map_obj)
    return map_obj


def delete_map(db: Session, map_id: int) -> bool:
    map_obj = get_map(db, map_id)
    if not map_obj:
        return False
    
    # Delete file from disk
    try:
        filepath = os.path.join(settings.UPLOAD_FOLDER, map_obj.filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass  # Continue even if file deletion fails
    
    db.delete(map_obj)
    db.commit()
    return True 