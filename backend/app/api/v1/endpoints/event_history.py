from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, verify_project_access
from app.services import event_history as event_history_service
from app.models.user import User

router = APIRouter()


@router.get("/{event_id}/history", response_model=List[Dict[str, Any]])
def get_event_history(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get history for a specific event.
    """
    # Verify project access (this will raise an exception if the user doesn't have access)
    verify_project_access(db, event_id=event_id, user_id=current_user.id)
    
    return event_history_service.get_event_history(
        db=db,
        event_id=event_id,
        skip=skip,
        limit=limit
    )


@router.get("/project/{project_id}/history", response_model=List[Dict[str, Any]])
def get_project_event_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Get history for all events in a project.
    """
    # Verify project access
    verify_project_access(db, project_id=project_id, user_id=current_user.id)
    
    return event_history_service.get_all_event_history(
        db=db,
        project_id=project_id,
        skip=skip,
        limit=limit
    ) 