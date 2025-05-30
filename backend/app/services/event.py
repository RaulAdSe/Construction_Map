from typing import List, Dict, Optional, Any, Union
import os
import json
import logging
from fastapi import HTTPException, UploadFile
from sqlalchemy import func, desc, or_, and_
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from uuid import uuid4

from app.core.config import settings
from app.models.event import Event
from app.models.user import User
from app.models.event_comment import EventComment
from app.services import event_history
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
    
    if file_size > MAX_SIZE:
        raise HTTPException(400, detail=f"File size exceeds the limit of 10MB")
    
    # Determine file type prefix for the path
    file_type_prefix = "pdf" if content_type == "application/pdf" else "img"
    
    # Generate a unique filename with appropriate extension
    if content_type == "application/pdf":
        ext = ".pdf"
    else:
        ext = "." + content_type.split("/")[1]
    
    # Create a unique filename
    unique_filename = f"{file_type_prefix}_{uuid4()}{ext}"
    
    # Check if we should use Cloud Storage
    use_cloud_storage = os.getenv("USE_CLOUD_STORAGE", "false").lower() == "true"
    in_cloud_run = os.getenv("K_SERVICE") is not None
    logger = logging.getLogger("event_service")
    
    if use_cloud_storage or in_cloud_run:
        try:
            logger.info("Using Cloud Storage for event attachment")
            from app.services.storage import upload_file_to_cloud_storage
            
            # Set destination path in Cloud Storage
            destination_blob_name = f"events/{unique_filename}"
            
            # Upload to Cloud Storage
            cloud_storage_bucket = os.getenv("CLOUD_STORAGE_BUCKET", "construction-map-storage-deep-responder-444017-h2")
            file_url = await upload_file_to_cloud_storage(
                content, 
                destination_blob_name, 
                file.content_type or "application/octet-stream"
            )
            
            logger.info(f"File uploaded to Cloud Storage, URL: {file_url}")
            return file_url  # Return the full Cloud Storage URL
        except Exception as cloud_error:
            logger.error(f"Error using Cloud Storage: {str(cloud_error)}")
            logger.info("Falling back to local storage")
            # Continue with local storage as fallback
    
    # If not using Cloud Storage or it failed, use local storage
    # Ensure uploads directory exists
    attachment_dir = os.path.join(settings.UPLOAD_FOLDER, "events")
    
    try:
        os.makedirs(attachment_dir, exist_ok=True)
    except PermissionError:
        logger = logging.getLogger("event_service")
        logger.warning(f"Cannot create event uploads directory (read-only filesystem): {attachment_dir}")
        # If we're on a read-only filesystem, use a temporary directory for this operation
        # The file will be later copied to persistent storage through other means
        attachment_dir = os.path.join("/tmp", "events")
        os.makedirs(attachment_dir, exist_ok=True)
    except OSError as e:
        logger = logging.getLogger("event_service")
        logger.warning(f"Error creating event uploads directory: {str(e)}")
        # Fall back to temporary directory
        attachment_dir = os.path.join("/tmp", "events")
        os.makedirs(attachment_dir, exist_ok=True)
    
    # Write file to disk
    file_path = os.path.join(attachment_dir, unique_filename)
    try:
        with open(file_path, "wb") as f:
            await file.seek(0)  # Reset file position
            f.write(content)
    except Exception as e:
        logger = logging.getLogger("event_service")
        logger.error(f"Error saving file: {str(e)}")
        raise HTTPException(500, detail=f"Error saving file: {str(e)}")
    
    # Return the relative path to be stored in the database
    return f"/events/{unique_filename}"


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
        # Fix for tags handling - ensure proper format
        if isinstance(tags, str):
            try:
                # Try to parse as JSON
                parsed_tags = json.loads(tags)
                # If it's a list, use it directly
                if isinstance(parsed_tags, list):
                    tags_json = parsed_tags
                else:
                    # If it's not a list but some other JSON, convert to list
                    tags_json = [str(parsed_tags)]
            except json.JSONDecodeError:
                # If not valid JSON, treat as a single tag
                tags_json = [tags]
        else:
            # If already a list, use as is
            tags_json = tags
        
        # Final safety check to ensure valid tags
        if not isinstance(tags_json, list):
            tags_json = []
        
        # Ensure all tags are strings
        tags_json = [str(tag) for tag in tags_json if tag]
    
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
    
    # Create event history record for creation (wrapped in try-except)
    try:
        event_history.create_event_history(
            db=db,
            event_id=db_event.id,
            user_id=created_by_user_id,
            action_type="create",
            new_value=status
        )
    except Exception as e:
        print(f"Error recording event creation history (non-critical): {str(e)}")
        # This error is non-critical, the event has already been created
    
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
    db_event = get_event(db, event_id)
    if not db_event:
        return None
    
    # Store original values before update for history tracking
    original_status = db_event.status
    original_state = db_event.state
    
    # Update fields if provided
    update_data = event_update.dict(exclude_unset=True)
    
    # Special handling for tags
    if 'tags' in update_data:
        tags = update_data['tags']
        # Fix for tags handling - ensure proper format
        if isinstance(tags, str):
            try:
                # Try to parse as JSON
                parsed_tags = json.loads(tags)
                # If it's a list, use it directly
                if isinstance(parsed_tags, list):
                    update_data['tags'] = parsed_tags
                else:
                    # If it's not a list but some other JSON, convert to list
                    update_data['tags'] = [str(parsed_tags)]
            except json.JSONDecodeError:
                # If not valid JSON, treat as a single tag
                update_data['tags'] = [tags]
        
        # Final safety check to ensure valid tags
        if not isinstance(update_data['tags'], list):
            update_data['tags'] = []
        
        # Ensure all tags are strings
        update_data['tags'] = [str(tag) for tag in update_data['tags'] if tag]
    
    for field, value in update_data.items():
        # Set the attribute first
        setattr(db_event, field, value)
    
    # First commit the actual changes to ensure they're saved
    try:
        # Now commit the changes
        db.commit()
        db.refresh(db_event)
        
        # After successful commit, try to record history (non-critical)
        
        # Track status changes in history (wrapped in try-except)
        if 'status' in update_data and update_data['status'] != original_status:
            try:
                event_history.create_event_history(
                    db=db,
                    event_id=event_id,
                    user_id=current_user_id,
                    action_type="status_change",
                    previous_value=original_status,
                    new_value=update_data['status']
                )
            except Exception as e:
                print(f"Error recording status change history (non-critical): {str(e)}")
                # This error is non-critical, the update has already been saved
                # Make sure we don't have a transaction that needs to be rolled back
                try:
                    db.rollback()
                except Exception as rollback_error:
                    print(f"Error during rollback after history error: {str(rollback_error)}")
                
        # Track state/type changes in history (wrapped in try-except)
        if 'state' in update_data and update_data['state'] != original_state:
            try:
                event_history.create_event_history(
                    db=db,
                    event_id=event_id,
                    user_id=current_user_id,
                    action_type="type_change",
                    previous_value=original_state,
                    new_value=update_data['state']
                )
            except Exception as e:
                print(f"Error recording state change history (non-critical): {str(e)}")
                # This error is non-critical, the update has already been saved
                # Make sure we don't have a transaction that needs to be rolled back
                try:
                    db.rollback()
                except Exception as rollback_error:
                    print(f"Error during rollback after history error: {str(rollback_error)}")
        
        # Add a general "edit" history entry if fields other than status/state were updated
        excluded_fields = ["status", "state", "is_admin_request"]
        other_fields_updated = [f for f in update_data.keys() if f not in excluded_fields]
        if other_fields_updated:
            try:
                event_history.create_event_history(
                    db=db,
                    event_id=event_id,
                    user_id=current_user_id,
                    action_type="edit",
                    additional_data={"updated_fields": other_fields_updated}
                )
            except Exception as e:
                print(f"Error recording edit history (non-critical): {str(e)}")
                # This error is non-critical, the update has already been saved
                # Make sure we don't have a transaction that needs to be rolled back
                try:
                    db.rollback()
                except Exception as rollback_error:
                    print(f"Error during rollback after history error: {str(rollback_error)}")
        
        # Create notifications for status/state changes
        link = f"/project/{db_event.project_id}?event={db_event.id}"
        
        try:
            if 'status' in update_data and update_data['status'] != original_status:
                # Notify event creator if current user is not the creator
                if db_event.created_by_user_id != current_user_id:
                    NotificationService.notify_event_interaction(
                        db, 
                        event_id, 
                        current_user_id, 
                        f"updated the status to '{db_event.status}'", 
                        link
                    )
                    
            if 'state' in update_data and update_data['state'] != original_state:
                # Notify event creator if current user is not the creator
                if db_event.created_by_user_id != current_user_id:
                    NotificationService.notify_event_interaction(
                        db, 
                        event_id, 
                        current_user_id, 
                        f"changed the state to '{db_event.state}'", 
                        link
                    )
            
            # Check for new mentions if description was updated
            if 'description' in update_data:
                NotificationService.notify_mentions(
                    db, 
                    db_event.description, 
                    current_user_id, 
                    event_id=db_event.id, 
                    link=link
                )
                
            # Notify admins about the update
            if current_user_id != db_event.created_by_user_id:
                action = "updated an event"
                if 'status' in update_data:
                    action = f"changed event status to '{db_event.status}'"
                elif 'state' in update_data:
                    action = f"changed event state to '{db_event.state}'"
                    
                NotificationService.notify_admins(
                    db, 
                    action, 
                    current_user_id, 
                    event_id=db_event.id, 
                    link=link
                )
        except Exception as notif_error:
            print(f"Error sending notifications (non-critical): {str(notif_error)}")
            # Notifications are non-critical, the update has already been saved
            # Make sure we don't have a transaction that needs to be rolled back
            try:
                db.rollback()
            except Exception as rollback_error:
                print(f"Error during rollback after notification error: {str(rollback_error)}")
                
    except Exception as e:
        # If we fail during the initial commit, roll back and re-raise
        try:
            db.rollback()
        except Exception as rollback_error:
            print(f"Error during rollback: {str(rollback_error)}")
        
        # Re-raise the original exception so the caller knows something went wrong
        raise e
    
    return db_event


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


def update_event_status(db: Session, event_id: int, new_status: str, user_id: int) -> Optional[Event]:
    """Update just the status of an event"""
    db_event = get_event(db, event_id)
    if not db_event:
        return None
    
    # Record previous status for history
    previous_status = db_event.status
    
    # Update status
    db_event.status = new_status
    
    try:
        # Commit the status change first
        db.commit()
        db.refresh(db_event)
        
        # Record in history (wrapped in try-except)
        try:
            event_history.create_event_history(
                db=db,
                event_id=event_id,
                user_id=user_id,
                action_type="status_change",
                previous_value=previous_status,
                new_value=new_status
            )
        except Exception as e:
            print(f"Error recording status change history (non-critical): {str(e)}")
            # This error is non-critical, the status has already been updated
            # Make sure we don't have a transaction that needs to be rolled back
            try:
                db.rollback()
            except Exception as rollback_error:
                print(f"Error during rollback after history error: {str(rollback_error)}")
    except Exception as e:
        # If we fail during the initial commit, roll back and re-raise
        try:
            db.rollback()
        except Exception as rollback_error:
            print(f"Error during rollback: {str(rollback_error)}")
        
        # Re-raise the original exception so the caller knows something went wrong
        raise e
    
    return db_event


def update_event_state(db: Session, event_id: int, new_state: str, user_id: int) -> Optional[Event]:
    """Update just the state/type of an event"""
    db_event = get_event(db, event_id)
    if not db_event:
        return None
    
    # Record previous state for history
    previous_state = db_event.state
    
    # Update state
    db_event.state = new_state
    
    try:
        # Commit the state change first
        db.commit()
        db.refresh(db_event)
        
        # Record in history (wrapped in try-except)
        try:
            event_history.create_event_history(
                db=db,
                event_id=event_id,
                user_id=user_id,
                action_type="type_change",
                previous_value=previous_state,
                new_value=new_state
            )
        except Exception as e:
            print(f"Error recording state change history (non-critical): {str(e)}")
            # This error is non-critical, the state has already been updated
            # Make sure we don't have a transaction that needs to be rolled back
            try:
                db.rollback()
            except Exception as rollback_error:
                print(f"Error during rollback after history error: {str(rollback_error)}")
    except Exception as e:
        # If we fail during the initial commit, roll back and re-raise
        try:
            db.rollback()
        except Exception as rollback_error:
            print(f"Error during rollback: {str(rollback_error)}")
        
        # Re-raise the original exception so the caller knows something went wrong
        raise e
    
    return db_event


def get_events_with_filters(
    db: Session, 
    project_id: int,
    user_id: Optional[int] = None,
    status_filter: Optional[List[str]] = None,
    type_filter: Optional[List[str]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tags_filter: Optional[List[str]] = None,
    skip: int = 0, 
    limit: int = 100,
    include_closed: bool = False
) -> List[Dict[str, Any]]:
    """
    Get events with filtering options and comment counts
    
    Parameters:
    - db: Database session
    - project_id: Project ID to filter by
    - user_id: Optional user ID to filter by
    - status_filter: Optional list of status values to filter by
    - type_filter: Optional list of type/state values to filter by
    - start_date: Optional start date to filter by (YYYY-MM-DD)
    - end_date: Optional end date to filter by (YYYY-MM-DD)
    - tags_filter: Optional list of tags to filter by
    - skip: Number of records to skip for pagination
    - limit: Maximum number of records to return
    - include_closed: Whether to include closed events
    """
    from sqlalchemy.orm import joinedload
    from sqlalchemy import and_, func, or_, cast, Date
    from datetime import datetime, timedelta
    
    # Start with base query
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
    
    # Filter by user if specified
    if user_id:
        query = query.filter(Event.created_by_user_id == user_id)
    
    # Filter by status if specified
    if status_filter:
        query = query.filter(Event.status.in_(status_filter))
    elif not include_closed:
        # If no status filter and not including closed, exclude closed status
        query = query.filter(Event.status != 'closed')
    
    # Filter by type/state if specified
    if type_filter:
        query = query.filter(Event.state.in_(type_filter))
    
    # Filter by date range if specified
    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            query = query.filter(Event.created_at >= start_datetime)
        except ValueError:
            # Invalid date format, ignore this filter
            pass
    
    if end_date:
        try:
            # Add one day to include the entire end date
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            query = query.filter(Event.created_at < end_datetime)
        except ValueError:
            # Invalid date format, ignore this filter
            pass
    
    # Filter by tags if specified
    if tags_filter and len(tags_filter) > 0:
        # For each tag, check if it exists in the tags array
        tag_conditions = []
        for tag in tags_filter:
            # This was using PostgreSQL's array containment operator which may not work as expected with JSON
            # Use a more compatible approach with JSON data
            # Try various match approaches to ensure tags are found
            tag_str = str(tag).strip().lower()
            if tag_str:
                # Check if tag exists in the array using JSON containment
                # This works with most SQL backends supporting JSON
                tag_conditions.append(func.lower(func.cast(Event.tags, db.String)).contains(tag_str))
        
        # Join conditions with OR (event has any of the specified tags)
        if tag_conditions:
            query = query.filter(or_(*tag_conditions))
    
    # Group by necessary fields
    query = query.group_by(
        Event.id,
        User.username
    )
    
    # Order by newest first
    query = query.order_by(desc(Event.created_at))
    
    # Apply pagination
    results = query.offset(skip).limit(limit).all()
    
    # Process results
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