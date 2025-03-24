import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
import pandas as pd
import io

from app.models.event import Event
from app.core.config import settings


def get_event(db: Session, event_id: int) -> Optional[Event]:
    return db.query(Event).filter(Event.id == event_id).first()


def get_events(
    db: Session, 
    project_id: int, 
    user_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[Event]:
    query = db.query(Event).filter(Event.project_id == project_id)
    
    if user_id:
        query = query.filter(Event.created_by_user_id == user_id)
    
    return query.order_by(desc(Event.created_at)).offset(skip).limit(limit).all()


def get_events_by_map(
    db: Session,
    map_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Event]:
    """Get all events for a specific map"""
    query = db.query(Event).filter(Event.map_id == map_id)
    return query.order_by(desc(Event.created_at)).offset(skip).limit(limit).all()


async def save_event_image(file: UploadFile) -> str:
    """Save event image to the upload directory and return the filename"""
    # Check if file is an image
    content_type = file.content_type
    if not content_type.startswith("image/"):
        raise HTTPException(400, detail="Only image files are allowed")
    
    # Ensure uploads directory exists
    image_dir = os.path.join(settings.UPLOAD_FOLDER, "events")
    os.makedirs(image_dir, exist_ok=True)
    
    # Generate a unique filename with appropriate extension
    ext = content_type.split("/")[1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(image_dir, filename)
    
    # Save the file
    with open(filepath, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Return the relative path for storing in the database
    return f"events/{filename}"


async def create_event(
    db: Session,
    project_id: int,
    map_id: int,
    created_by_user_id: int,
    title: str,
    x_coordinate: float,
    y_coordinate: float,
    status: str = "open",
    active_maps: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    image: Optional[UploadFile] = None
) -> Event:
    """Create a new event"""
    # Save image if provided
    image_url = None
    if image:
        image_url = await save_event_image(image)
    
    # Create event
    event = Event(
        project_id=project_id,
        map_id=map_id,
        created_by_user_id=created_by_user_id,
        title=title,
        description=description,
        status=status,
        active_maps=active_maps,
        image_url=image_url,
        tags=tags,
        x_coordinate=x_coordinate,
        y_coordinate=y_coordinate
    )
    
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def update_event(
    db: Session,
    event_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None
) -> Optional[Event]:
    """Update an existing event"""
    event = get_event(db, event_id)
    if not event:
        return None
    
    if title is not None:
        event.title = title
    if description is not None:
        event.description = description
    if tags is not None:
        event.tags = tags
    
    db.commit()
    db.refresh(event)
    return event


def delete_event(db: Session, event_id: int) -> bool:
    """Delete an event"""
    event = get_event(db, event_id)
    if not event:
        return False
    
    # Delete image file if exists
    if event.image_url:
        try:
            filepath = os.path.join(settings.UPLOAD_FOLDER, event.image_url)
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass  # Continue even if file deletion fails
    
    db.delete(event)
    db.commit()
    return True


def export_events(
    db: Session, 
    project_id: int,
    format: str = "csv",
    user_id: Optional[int] = None
) -> bytes:
    """Export events to CSV or Excel format"""
    # Get events
    events = get_events(db, project_id, user_id, skip=0, limit=1000)
    
    # Convert to dataframe
    data = []
    for event in events:
        # Get username
        username = db.query(db.model.User.username).filter(
            db.model.User.id == event.created_by_user_id
        ).scalar()
        
        data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "created_by": username,
            "x_coordinate": event.x_coordinate,
            "y_coordinate": event.y_coordinate,
            "tags": ', '.join(event.tags) if event.tags else "",
            "created_at": event.created_at,
            "has_image": bool(event.image_url)
        })
    
    df = pd.DataFrame(data)
    
    # Export to requested format
    buffer = io.BytesIO()
    
    if format.lower() == "xlsx":
        df.to_excel(buffer, index=False, engine="openpyxl")
        mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        file_ext = "xlsx"
    else:  # Default to CSV
        df.to_csv(buffer, index=False)
        mime_type = "text/csv"
        file_ext = "csv"
    
    buffer.seek(0)
    return {
        "content": buffer.getvalue(),
        "media_type": mime_type,
        "filename": f"events-project-{project_id}.{file_ext}"
    } 