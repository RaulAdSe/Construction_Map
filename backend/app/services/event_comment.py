import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.event_comment import EventComment
from app.models.user import User
from app.core.config import settings


def get_comment(db: Session, comment_id: int) -> Optional[EventComment]:
    """Get a single comment by ID"""
    return db.query(EventComment).filter(EventComment.id == comment_id).first()


def get_comments_for_event(
    db: Session, 
    event_id: int,
    skip: int = 0, 
    limit: int = 100
) -> List[EventComment]:
    """Get all comments for a specific event"""
    return db.query(EventComment)\
        .filter(EventComment.event_id == event_id)\
        .order_by(desc(EventComment.created_at))\
        .offset(skip)\
        .limit(limit)\
        .all()


def get_comment_count_for_event(db: Session, event_id: int) -> int:
    """Get the count of comments for an event"""
    return db.query(EventComment).filter(EventComment.event_id == event_id).count()


async def create_comment(
    db: Session,
    event_id: int,
    user_id: int,
    content: str,
    image: Optional[UploadFile] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> EventComment:
    """Create a new comment for an event"""
    # Initialize new comment
    db_comment = EventComment(
        event_id=event_id,
        user_id=user_id,
        content=content,
        comment_data=metadata
    )
    
    # Handle image upload if provided
    if image:
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(settings.UPLOAD_FOLDER, "comments")
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(image.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(upload_dir, unique_filename)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            content = await image.read()
            buffer.write(content)
        
        # Set image URL in database
        relative_path = os.path.join("comments", unique_filename)
        db_comment.image_url = relative_path
    
    # Save to database
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    return db_comment


def update_comment(
    db: Session,
    comment_id: int,
    content: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[EventComment]:
    """Update an existing comment"""
    db_comment = get_comment(db, comment_id)
    if not db_comment:
        return None
    
    # Update fields if provided
    if content is not None:
        db_comment.content = content
    
    if metadata is not None:
        if not db_comment.comment_data:
            db_comment.comment_data = {}
        db_comment.comment_data.update(metadata)
    
    # Save changes
    db.commit()
    db.refresh(db_comment)
    
    return db_comment


def delete_comment(db: Session, comment_id: int) -> bool:
    """Delete a comment by ID"""
    db_comment = get_comment(db, comment_id)
    if not db_comment:
        return False
    
    # Delete image file if exists
    if db_comment.image_url:
        file_path = os.path.join(settings.UPLOAD_FOLDER, db_comment.image_url)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                # Log error but continue with deletion
                pass
    
    # Delete from database
    db.delete(db_comment)
    db.commit()
    
    return True 