from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.event_comment import EventComment, EventCommentCreate, EventCommentUpdate, EventCommentDetail
from app.services import event_comment as comment_service
from app.services import event as event_service
from app.services import project as project_service
from app.api.v1.endpoints.monitoring import log_user_activity

router = APIRouter()


@router.get("/{event_id}/comments", response_model=List[EventCommentDetail])
def get_event_comments(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all comments for a specific event.
    """
    # Get event to verify access
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not project or not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get comments
    comments = comment_service.get_comments_for_event(db, event_id, skip, limit)
    
    # Enhance comments with usernames
    result = []
    for comment in comments:
        username = db.query(User.username).filter(User.id == comment.user_id).scalar()
        comment_detail = EventCommentDetail(
            id=comment.id,
            event_id=comment.event_id,
            user_id=comment.user_id,
            username=username or f"User {comment.user_id}",
            content=comment.content,
            image_url=comment.image_url,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            comment_data=comment.comment_data
        )
        result.append(comment_detail)
    
    return result


@router.post("/{event_id}/comments", response_model=EventComment)
async def create_event_comment(
    event_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    content: str = Form(...),
    attachment: Optional[UploadFile] = File(None)
):
    """
    Create a new comment for an event.
    Supports both image and PDF attachments.
    """
    # Get event to verify access
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not project or not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Validate file type
    if attachment:
        # Check file type
        file_type = attachment.content_type
        filename = attachment.filename.lower()
        
        is_image = file_type.startswith('image/')
        is_pdf = file_type == 'application/pdf' or filename.endswith('.pdf')
        
        if not (is_image or is_pdf):
            raise HTTPException(
                status_code=400, 
                detail="Only image or PDF files are allowed"
            )
        
        # Check file size - limit to 10MB to prevent abuse
        file_size_limit = 10 * 1024 * 1024  # 10MB
        file_content = await attachment.read()
        if len(file_content) > file_size_limit:
            raise HTTPException(
                status_code=400, 
                detail="File size exceeds the limit of 10MB"
            )
        
        # Reset file position for later reading
        await attachment.seek(0)
    
    # Create comment
    try:
        comment = await comment_service.create_comment(
            db=db,
            event_id=event_id,
            user_id=current_user.id,
            content=content,
            image=attachment  # Pass attachment to the service (can be None, image, or PDF)
        )
        
        # Determine attachment type for activity log
        attachment_type = None
        if attachment:
            if attachment.content_type == 'application/pdf' or attachment.filename.lower().endswith('.pdf'):
                attachment_type = 'pdf'
            else:
                attachment_type = 'image'
        
        # Log user activity
        log_user_activity(
            user_id=current_user.id,
            username=current_user.username,
            action="event_comment_create",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin" if current_user.is_admin else "member",
            details={
                "event_id": event_id,
                "comment_id": comment.id,
                "project_id": event.project_id,
                "has_attachment": attachment is not None,
                "attachment_type": attachment_type,
                "event_title": event.title
            }
        )
        
        return comment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{event_id}/comments/{comment_id}", response_model=EventComment)
def update_event_comment(
    event_id: int,
    comment_id: int,
    comment_update: EventCommentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a comment.
    """
    # Get comment
    comment = comment_service.get_comment(db, comment_id)
    if not comment or comment.event_id != event_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user owns the comment
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed to update this comment")
    
    # Get event for activity log
    event = event_service.get_event(db, event_id)
    
    # Update comment
    updated_comment = comment_service.update_comment(
        db=db,
        comment_id=comment_id,
        content=comment_update.content
    )
    
    if not updated_comment:
        raise HTTPException(status_code=500, detail="Failed to update comment")
    
    # Log user activity
    log_user_activity(
        user_id=current_user.id,
        username=current_user.username,
        action="event_comment_update",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if current_user.is_admin else "member",
        details={
            "event_id": event_id,
            "comment_id": comment_id,
            "project_id": event.project_id,
            "event_title": event.title
        }
    )
    
    return updated_comment


@router.delete("/{event_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_comment(
    event_id: int,
    comment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete a comment.
    """
    # Get comment
    comment = comment_service.get_comment(db, comment_id)
    if not comment or comment.event_id != event_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Check if user owns the comment or is an admin
    if comment.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    
    # Get event for activity log
    event = event_service.get_event(db, event_id)
    
    # Log user activity before deletion
    log_user_activity(
        user_id=current_user.id,
        username=current_user.username,
        action="event_comment_delete",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if current_user.is_admin else "member",
        details={
            "event_id": event_id,
            "comment_id": comment_id,
            "project_id": event.project_id,
            "event_title": event.title,
            "is_own_comment": comment.user_id == current_user.id
        }
    )
    
    # Delete comment
    success = comment_service.delete_comment(db, comment_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete comment")
    
    return None 