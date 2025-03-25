from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.event_comment import EventComment, EventCommentCreate, EventCommentUpdate, EventCommentDetail
from app.services import event_comment as comment_service
from app.services import event as event_service
from app.services import project as project_service

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
    content: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new comment for an event.
    """
    # Get event to verify access
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not project or not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Create comment
    try:
        comment = await comment_service.create_comment(
            db=db,
            event_id=event_id,
            user_id=current_user.id,
            content=content,
            image=image
        )
        return comment
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{event_id}/comments/{comment_id}", response_model=EventComment)
def update_event_comment(
    event_id: int,
    comment_id: int,
    comment_update: EventCommentUpdate,
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
    
    # Update comment
    updated_comment = comment_service.update_comment(
        db=db,
        comment_id=comment_id,
        content=comment_update.content
    )
    
    if not updated_comment:
        raise HTTPException(status_code=500, detail="Failed to update comment")
    
    return updated_comment


@router.delete("/{event_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_comment(
    event_id: int,
    comment_id: int,
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
    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    
    # Delete comment
    success = comment_service.delete_comment(db, comment_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete comment")
    
    return None 