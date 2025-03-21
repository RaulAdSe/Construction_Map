from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.event import Event, EventCreate, EventUpdate, EventDetail
from app.services import event as event_service
from app.services import project as project_service

router = APIRouter()


@router.get("/", response_model=List[Event])
def get_events(
    project_id: int,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all events for a project.
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get events
    events = event_service.get_events(db, project_id, user_id, skip, limit)
    return events


@router.get("/export")
def export_events(
    project_id: int,
    format: str = Query("csv", regex="^(csv|xlsx)$"),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Export events to CSV or Excel format.
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Export events
    export_data = event_service.export_events(db, project_id, format, user_id)
    
    # Return file response
    return Response(
        content=export_data["content"],
        media_type=export_data["media_type"],
        headers={"Content-Disposition": f"attachment; filename={export_data['filename']}"}
    )


@router.get("/{event_id}", response_model=EventDetail)
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific event.
    """
    # Get event
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get username for the creator
    username = db.query(User.username).filter(User.id == event.created_by_user_id).scalar()
    
    # Create EventDetail
    event_detail = EventDetail(
        id=event.id,
        project_id=event.project_id,
        created_by_user_id=event.created_by_user_id,
        created_by_user_name=username,
        title=event.title,
        description=event.description,
        image_url=event.image_url,
        tags=event.tags,
        x_coordinate=event.x_coordinate,
        y_coordinate=event.y_coordinate,
        created_at=event.created_at
    )
    
    return event_detail


@router.post("/", response_model=Event)
async def create_event(
    project_id: int = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    x_coordinate: float = Form(...),
    y_coordinate: float = Form(...),
    tags: Optional[List[str]] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new event.
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Create event
    try:
        event = await event_service.create_event(
            db,
            project_id,
            current_user.id,
            title,
            x_coordinate,
            y_coordinate,
            description,
            tags,
            image
        )
        return event
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create event: {str(e)}"
        )


@router.put("/{event_id}", response_model=Event)
def update_event(
    event_id: int,
    event_update: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update event details.
    """
    # Get event
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Update event
    updated_event = event_service.update_event(
        db,
        event_id,
        title=event_update.title,
        description=event_update.description,
        tags=event_update.tags
    )
    
    return updated_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete an event.
    """
    # Get event
    event = event_service.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Delete event
    success = event_service.delete_event(db, event_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete event")
    
    return None 