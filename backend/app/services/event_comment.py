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
from app.services import event_history


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
    db_comment = None
    
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
        
        # Remember the project_id for later use (to avoid DB access issues)
        project_id = event.project_id
        
        # Handle file upload if provided
        if image:
            try:
                print(f"Processing file upload: {image.filename}")
                
                # Create uploads directory if it doesn't exist
                upload_dir = os.path.join(settings.UPLOAD_FOLDER, "comments")
                try:
                    os.makedirs(upload_dir, exist_ok=True)
                except PermissionError:
                    print(f"Cannot create comments uploads directory (read-only filesystem): {upload_dir}")
                    # If we're on a read-only filesystem, use a temporary directory for this operation
                    upload_dir = os.path.join("/tmp", "comments")
                    os.makedirs(upload_dir, exist_ok=True)
                except OSError as e:
                    print(f"Error creating comments uploads directory: {str(e)}")
                    # Fall back to temporary directory
                    upload_dir = os.path.join("/tmp", "comments")
                    os.makedirs(upload_dir, exist_ok=True)
                
                # Determine file type
                is_pdf = False
                if image.filename.lower().endswith('.pdf') or image.content_type == 'application/pdf':
                    is_pdf = True
                    print("Detected PDF file")
                    file_prefix = "pdf_"
                else:
                    print("Detected image file")
                    file_prefix = "img_"
                
                # Generate unique filename with appropriate prefix
                file_extension = os.path.splitext(image.filename)[1]
                unique_filename = f"{file_prefix}{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(upload_dir, unique_filename)
                
                print(f"Saving file to: {file_path}")
                
                # Save the file
                try:
                    with open(file_path, "wb") as buffer:
                        content = await image.read()
                        if not content:
                            print("Warning: File content is empty")
                        buffer.write(content)
                except (PermissionError, OSError) as e:
                    print(f"Error writing comment attachment file: {str(e)}")
                    # If we're in the normal directory path and encounter an error, try the tmp path
                    if not upload_dir.startswith("/tmp"):
                        upload_dir = os.path.join("/tmp", "comments")
                        os.makedirs(upload_dir, exist_ok=True)
                        file_path = os.path.join(upload_dir, unique_filename)
                        with open(file_path, "wb") as buffer:
                            buffer.write(content)
                        print(f"Successfully saved file to fallback location: {file_path}")
                    else:
                        # If we're already using the tmp directory and still have an error, raise it
                        raise Exception(f"Could not save file due to filesystem error: {str(e)}")
                
                # Set image URL and file type in database
                # Store as /comments/{filename} - FastAPI serves this from the uploads directory
                relative_path = f"/comments/{unique_filename}"
                db_comment.image_url = relative_path
                db_comment.file_type = "pdf" if is_pdf else "image"
                print(f"File saved, URL set to: {relative_path}, type: {db_comment.file_type}")
            except Exception as img_error:
                print(f"Error processing file: {str(img_error)}")
                # Continue without image if there's an error
                # This ensures the comment gets created even if file upload fails
        
        # Add comment to database (but don't commit yet)
        db.add(db_comment)
        
        # First try to flush the changes to get an ID
        try:
            db.flush()
            
            # Now that we have an ID, we can try to create event history
            # Try to record comment creation in event history (before commit)
            # If this fails, we can still continue and commit the comment
            try:
                event_history.create_event_history(
                    db=db,
                    event_id=event_id,
                    user_id=user_id,
                    action_type="comment",
                    new_value=content[:50] + ("..." if len(content) > 50 else ""),  # Truncate content for history
                    additional_data={"comment_id": db_comment.id}
                )
            except Exception as history_error:
                print(f"Error recording comment history (non-critical): {str(history_error)}")
                # This error is non-critical, so we'll roll back just this part
                # but still proceed with the comment creation
                db.rollback()
                
                # Re-add the comment to the session after rollback
                db.add(db_comment)
            
            # Now we can finally commit the comment
            db.commit()
            db.refresh(db_comment)
        except Exception as db_error:
            # If any database error occurs, roll back
            db.rollback()
            print(f"Database error: {str(db_error)}")
            raise
        
        # Create link to the event with comment 
        # (use stored project_id to avoid DB access issues)
        link = f"/project/{project_id}?event={event_id}&comment={db_comment.id}"
        print(f"Generated notification link: {link}")
        
        # Notifications are also non-critical - wrap in try/except
        try:
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
        except Exception as all_notif_error:
            print(f"Error handling notifications (non-critical): {str(all_notif_error)}")
            # Continue even if all notifications fail
        
        return db_comment
    except Exception as e:
        # Log the full error details for debugging
        import traceback
        print(f"Error creating comment: {str(e)}")
        print(traceback.format_exc())
        
        # If the comment was created but we hit an error in notifications or other non-critical areas,
        # we can still return the comment
        if db_comment and db_comment.id:
            return db_comment
            
        # Otherwise, re-raise the exception to be caught by the endpoint
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
            link = f"/project/{event.project_id}?event={event.id}&comment={comment_id}"
            
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