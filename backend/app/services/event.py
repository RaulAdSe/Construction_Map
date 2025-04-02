import os
import uuid
import json
from typing import List, Optional, Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
import pandas as pd
import io

from app.models.event import Event
from app.models.event_comment import EventComment
from app.models.user import User
from app.core.config import settings
from app.services.notification import NotificationService


def get_event(db: Session, event_id: int) -> Optional[Event]:
    return db.query(Event).filter(Event.id == event_id).first()


def get_events(
    db: Session, 
    project_id: int, 
    user_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100,
    include_closed: bool = False
) -> List[Event]:
    """
    Get all events for a project.
    Admin users can see all events, regular users cannot see closed events.
    """
    from sqlalchemy.orm import joinedload
    
    # Use join to get user info
    query = db.query(Event).options(joinedload(Event.created_by_user)).filter(Event.project_id == project_id)
    
    # Filter by user
    if user_id:
        query = query.filter(Event.created_by_user_id == user_id)
    
    # Filter out closed events if include_closed is False
    if not include_closed:
        query = query.filter(Event.status != 'closed')
    
    # Order by most recent first
    query = query.order_by(Event.created_at.desc())
    
    # Get events
    events = query.offset(skip).limit(limit).all()
    
    # Add username to each event
    for event in events:
        if not hasattr(event, 'created_by_user_name') or not event.created_by_user_name:
            event.created_by_user_name = event.created_by_user.username if event.created_by_user else f"User {event.created_by_user_id}"
    
    return events


def get_events_by_map(
    db: Session,
    map_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Event]:
    """
    Get all events for a specific map.
    """
    from sqlalchemy.orm import joinedload
    
    # Use join to get user info
    events = db.query(Event).options(joinedload(Event.created_by_user)).filter(
        Event.map_id == map_id
    ).order_by(Event.created_at.desc()).offset(skip).limit(limit).all()
    
    # Process each event
    for event in events:
        # Fix active_maps for each event
        if event.active_maps == [] or event.active_maps is None:
            event.active_maps = {}
            
        # Add username to each event
        if not hasattr(event, 'created_by_user_name') or not event.created_by_user_name:
            event.created_by_user_name = event.created_by_user.username if event.created_by_user else f"User {event.created_by_user_id}"
    
    return events


def get_event_with_comments_count(db: Session, event_id: int) -> Optional[Dict[str, Any]]:
    """Get event with comment count"""
    result = db.query(
        Event,
        func.count(EventComment.id).label('comment_count')
    ).outerjoin(
        EventComment, 
        Event.id == EventComment.event_id
    ).filter(
        Event.id == event_id
    ).group_by(
        Event.id
    ).first()
    
    if not result:
        return None
        
    event, comment_count = result
    # Convert event to dict and add comment count
    event_dict = {c.name: getattr(event, c.name) for c in event.__table__.columns}
    event_dict['comment_count'] = comment_count
    
    # Fix for active_maps - convert empty array to empty dict if needed
    if event_dict['active_maps'] == [] or event_dict['active_maps'] is None:
        event_dict['active_maps'] = {}
        
    return event_dict


def get_events_with_comments_count(
    db: Session, 
    project_id: int,
    user_id: Optional[int] = None, 
    skip: int = 0, 
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Get events with comment counts and creator usernames"""
    query = db.query(
        Event,
        func.count(EventComment.id).label('comment_count'),
        User.username.label('created_by_user_name')
    ).outerjoin(
        EventComment, 
        Event.id == EventComment.event_id
    ).join(
        User,
        Event.created_by_user_id == User.id
    ).filter(
        Event.project_id == project_id
    )
    
    if user_id:
        query = query.filter(Event.created_by_user_id == user_id)
    
    results = query.group_by(
        Event.id,
        User.username
    ).order_by(
        desc(Event.created_at)
    ).offset(skip).limit(limit).all()
    
    events_with_counts = []
    for event, comment_count, created_by_user_name in results:
        # Convert event to dict and add comment count
        event_dict = {c.name: getattr(event, c.name) for c in event.__table__.columns}
        event_dict['comment_count'] = comment_count
        event_dict['created_by_user_name'] = created_by_user_name
        
        # Fix for active_maps - convert empty array to empty dict if needed
        if event_dict['active_maps'] == [] or event_dict['active_maps'] is None:
            event_dict['active_maps'] = {}
            
        events_with_counts.append(event_dict)
    
    return events_with_counts


async def save_event_attachment(file: UploadFile) -> str:
    """Save event attachment (image or PDF) to the upload directory and return the filename with type info"""
    # Check if file is an image or PDF
    content_type = file.content_type
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        raise HTTPException(400, detail="Only image and PDF files are allowed")
    
    # Check file size limit (10MB)
    MAX_SIZE = 10 * 1024 * 1024  # 10MB in bytes
    file_size = 0
    
    # Read content to check size and then seek back to start
    content = await file.read()
    file_size = len(content)
    await file.seek(0)
    
    if file_size > MAX_SIZE:
        raise HTTPException(400, detail=f"File size exceeds the limit of 10MB")
    
    # Determine file type prefix for the path
    file_type_prefix = "pdf" if content_type == "application/pdf" else "img"
    
    # Ensure uploads directory exists
    attachment_dir = os.path.join(settings.UPLOAD_FOLDER, "events")
    os.makedirs(attachment_dir, exist_ok=True)
    
    # Generate a unique filename with appropriate extension
    if content_type == "application/pdf":
        ext = "pdf"
    else:
        ext = content_type.split("/")[1]
        
    filename = f"{file_type_prefix}_{uuid.uuid4()}.{ext}"
    filepath = os.path.join(attachment_dir, filename)
    
    # Save the file
    with open(filepath, "wb") as buffer:
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
    description: Optional[str] = None,
    status: Optional[str] = "open",
    state: Optional[str] = "green",
    active_maps: Optional[str] = None,
    tags: Optional[List[str]] = None,
    image: Optional[UploadFile] = None
) -> Event:
    """Create a new event"""
    # Process tags
    tags_json = None
    if tags:
        # Ensure tags is a list of strings
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except json.JSONDecodeError:
                tags = [tags]
        tags_json = tags
    
    # Process active_maps if provided as a string
    if active_maps and isinstance(active_maps, str):
        try:
            active_maps = json.loads(active_maps)
        except Exception:
            active_maps = {}
    
    # Check if map exists
    event_count = db.query(func.count(Event.id)).filter(Event.map_id == map_id).scalar()
    
    # Handle image upload
    image_url = None
    file_type = None
    if image:
        image_url = await save_event_attachment(image)
        # Determine file type
        content_type = image.content_type
        if content_type.startswith("image/"):
            file_type = "image"
        elif content_type == "application/pdf":
            file_type = "pdf"
    
    # Get user for notification
    user = db.query(User).filter(User.id == created_by_user_id).first()
    username = user.username if user else f"User #{created_by_user_id}"
    
    # Create event
    db_event = Event(
        project_id=project_id,
        map_id=map_id,
        created_by_user_id=created_by_user_id,
        title=title,
        description=description,
        image_url=image_url,
        file_type=file_type,
        status=status,
        state=state,
        active_maps=active_maps,
        tags=tags_json,
        x_coordinate=x_coordinate,
        y_coordinate=y_coordinate
    )
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # Create notifications for mentioned users
    if description:
        link = f"/events/{db_event.id}"
        NotificationService.notify_mentions(
            db, 
            description, 
            created_by_user_id, 
            event_id=db_event.id, 
            link=link
        )
    
    # Notify all admins about the new event
    NotificationService.notify_admins(
        db, 
        "created a new event", 
        created_by_user_id, 
        event_id=db_event.id, 
        link=f"/events/{db_event.id}"
    )
    
    return db_event


def update_event(
    db: Session, 
    event_id: int, 
    event_update,
    current_user_id: int
) -> Optional[Event]:
    """
    Update an event.
    """
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        return None
    
    # Check if status is being updated
    old_status = event.status
    old_state = event.state
    
    # Update fields if provided
    update_data = event_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(event, key):
            setattr(event, key, value)
    
    db.commit()
    db.refresh(event)
    
    # Create notifications for status/state changes
    link = f"/project/{event.project_id}?event={event.id}"
    
    if 'status' in update_data and update_data['status'] != old_status:
        # Notify event creator if current user is not the creator
        if event.created_by_user_id != current_user_id:
            NotificationService.notify_event_interaction(
                db, 
                event_id, 
                current_user_id, 
                f"updated the status to '{event.status}'", 
                link
            )
            
    if 'state' in update_data and update_data['state'] != old_state:
        # Notify event creator if current user is not the creator
        if event.created_by_user_id != current_user_id:
            NotificationService.notify_event_interaction(
                db, 
                event_id, 
                current_user_id, 
                f"changed the state to '{event.state}'", 
                link
            )
    
    # Check for new mentions if description was updated
    if 'description' in update_data:
        NotificationService.notify_mentions(
            db, 
            event.description, 
            current_user_id, 
            event_id=event.id, 
            link=link
        )
        
    # Notify admins about the update
    if current_user_id != event.created_by_user_id:
        action = "updated an event"
        if 'status' in update_data:
            action = f"changed event status to '{event.status}'"
        elif 'state' in update_data:
            action = f"changed event state to '{event.state}'"
            
        NotificationService.notify_admins(
            db, 
            action, 
            current_user_id, 
            event_id=event.id, 
            link=link
        )
    
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
        
        # Count comments
        comment_count = db.query(func.count(EventComment.id)).filter(
            EventComment.event_id == event.id
        ).scalar()
        
        data.append({
            "id": event.id,
            "title": event.title,
            "description": event.description,
            "created_by": username,
            "state": event.state,
            "x_coordinate": event.x_coordinate,
            "y_coordinate": event.y_coordinate,
            "tags": ', '.join(event.tags) if event.tags else "",
            "created_at": event.created_at,
            "has_image": bool(event.image_url),
            "comment_count": comment_count
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