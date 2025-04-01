import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.event_comment import EventComment
from app.models.event import Event
from app.models.user import User
from app.core.config import settings
from app.services.notification import NotificationService


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
    try:
        # Get the event to validate and for linking
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise ValueError("Event not found")
        
        print(f"Creating comment for event {event_id} by user {user_id}, content: '{content}'")
        
        # Create the comment in database
        db_comment = EventComment(
            event_id=event_id,
            user_id=user_id,
            content=content,
            comment_data=metadata
        )
        
        # Handle image upload if provided
        if image:
            try:
                print(f"Processing image upload: {image.filename}")
                
                # Create uploads directory if it doesn't exist
                upload_dir = os.path.join(settings.UPLOAD_FOLDER, "comments")
                os.makedirs(upload_dir, exist_ok=True)
                
                # Generate unique filename
                file_extension = os.path.splitext(image.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                print(f"Saving file to: {file_path}")
                
                # Save the file
                with open(file_path, "wb") as buffer:
                    content = await image.read()
                    if not content:
                        print("Warning: Image content is empty")
                    buffer.write(content)
                
                # Set image URL in database
                # Store as /comments/{filename} - FastAPI serves this from the uploads directory
                relative_path = f"/comments/{unique_filename}"
                db_comment.image_url = relative_path
                print(f"Image saved, URL set to: {relative_path}")
            except Exception as img_error:
                print(f"Error processing image: {str(img_error)}")
                # Continue without image if there's an error
                # This ensures the comment gets created even if image upload fails
        
        # Save to database
        db.add(db_comment)
        db.commit()
        db.refresh(db_comment)
        
        # Create link to the event with comment
        link = f"/project/{event.project_id}?event={event_id}&comment={db_comment.id}"
        print(f"Generated notification link: {link}")
        
        # Notify event creator about the new comment
        print(f"Notifying event creator (id: {event.created_by_user_id}) about new comment")
        try:
            NotificationService.notify_comment(
                db, 
                event_id, 
                db_comment.id, 
                user_id, 
                event.created_by_user_id,
                link
            )
        except Exception as notif_error:
            print(f"Error sending notification to event creator: {str(notif_error)}")
            # Continue even if notification fails
            
        # Process mentions in comment
        print(f"Processing mentions in comment: '{content}'")
        try:
            mention_notifications = NotificationService.notify_mentions(
                db, 
                content, 
                user_id, 
                event_id=event_id, 
                comment_id=db_comment.id,
                link=link
            )
            print(f"Created {len(mention_notifications)} mention notifications")
        except Exception as mention_error:
            print(f"Error processing mentions: {str(mention_error)}")
            # Continue even if mention processing fails
        
        # Notify admins about new comment
        try:
            user = db.query(User).filter(User.id == user_id).first()
            user_name = user.username if user else "Someone"
            
            NotificationService.notify_admins(
                db, 
                f"commented on event", 
                user_id, 
                event_id=event_id, 
                comment_id=db_comment.id,
                link=link
            )
        except Exception as admin_notif_error:
            print(f"Error notifying admins: {str(admin_notif_error)}")
            # Continue even if admin notification fails
        
        return db_comment
    except Exception as e:
        # Log the full error details for debugging
        import traceback
        print(f"Error creating comment: {str(e)}")
        print(traceback.format_exc())
        # Re-raise the exception to be caught by the endpoint
        raise


def update_comment(
    db: Session,
    comment_id: int,
    user_id: int,
    content: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[EventComment]:
    """Update an existing comment"""
    db_comment = get_comment(db, comment_id)
    if not db_comment:
        return None
    
    # Update fields if provided
    if content is not None:
        old_content = db_comment.content
        db_comment.content = content
    
    if metadata is not None:
        if not db_comment.comment_data:
            db_comment.comment_data = {}
        db_comment.comment_data.update(metadata)
    
    # Save changes
    db.commit()
    db.refresh(db_comment)
    
    # If content was updated, check for new mentions
    if content is not None and content != old_content:
        event = db.query(Event).filter(Event.id == db_comment.event_id).first()
        if event:
            link = f"/events/{event.id}?comment={comment_id}"
            
            # Process mentions in updated comment
            NotificationService.notify_mentions(
                db, 
                content, 
                user_id, 
                event_id=event.id, 
                comment_id=comment_id,
                link=link
            )
    
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