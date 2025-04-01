from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.notification import Notification, NotificationList, NotificationUpdate
from app.services.notification import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationList)
def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's notifications
    """
    notifications = NotificationService.get_user_notifications(
        db, current_user.id, skip=skip, limit=limit
    )
    unread_count = NotificationService.get_unread_count(db, current_user.id)
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.get("/unread-count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the count of unread notifications for the current user
    """
    return NotificationService.get_unread_count(db, current_user.id)


@router.patch("/{notification_id}", response_model=Notification)
def update_notification(
    notification_id: int = Path(..., gt=0),
    notification_update: NotificationUpdate = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a notification (mark as read/unread)
    """
    if notification_update and notification_update.read is not None:
        notification = NotificationService.mark_as_read(
            db, notification_id, current_user.id
        )
        if not notification:
            raise HTTPException(
                status_code=404, 
                detail="Notification not found or does not belong to current user"
            )
        return notification
    
    raise HTTPException(
        status_code=400,
        detail="No valid update data provided"
    )


@router.post("/mark-all-read", response_model=int)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read for the current user
    """
    count = NotificationService.mark_all_as_read(db, current_user.id)
    return count


@router.delete("/{notification_id}", response_model=bool)
def delete_notification(
    notification_id: int = Path(..., gt=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a notification
    """
    success = NotificationService.delete_notification(
        db, notification_id, current_user.id
    )
    if not success:
        raise HTTPException(
            status_code=404, 
            detail="Notification not found or does not belong to current user"
        )
    return True 