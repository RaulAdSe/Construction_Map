from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.event import Event, EventCreate, EventUpdate, EventDetail
from app.services import event as event_service
from app.services import project as project_service
from app.services import event_comment as comment_service
from app.models.map import Map

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


@router.get("/map/{map_id}", response_model=List[Event])
def get_events_by_map(
    map_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
):
    """
    Get all events for a specific map.
    """
    # Get the map to check project access
    map_obj = db.query(Map).filter(Map.id == map_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found")
    
    # Check if user has access to the project
    project = project_service.get_project(db, map_obj.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get events for this map
    events = event_service.get_events_by_map(db, map_id, skip, limit)
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
    # Get event with comment count
    event_data = event_service.get_event_with_comments_count(db, event_id)
    if not event_data:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event_data["project_id"])
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get username for the creator
    username = db.query(User.username).filter(User.id == event_data["created_by_user_id"]).scalar()
    
    # Create EventDetail
    event_detail = EventDetail(
        id=event_data["id"],
        project_id=event_data["project_id"],
        map_id=event_data["map_id"],
        created_by_user_id=event_data["created_by_user_id"],
        created_by_user_name=username,
        title=event_data["title"],
        description=event_data["description"],
        status=event_data["status"],
        state=event_data["state"],
        active_maps=event_data["active_maps"],
        image_url=event_data["image_url"],
        tags=event_data["tags"],
        x_coordinate=event_data["x_coordinate"],
        y_coordinate=event_data["y_coordinate"],
        created_at=event_data["created_at"],
        comment_count=event_data["comment_count"]
    )
    
    return event_detail


@router.post("/", response_model=Event)
async def create_event(
    project_id: int = Form(...),
    map_id: int = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    status: Optional[str] = Form("open"),
    state: Optional[str] = Form("green"),
    active_maps: Optional[str] = Form(None),
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
    
    # Check if map exists and belongs to the project
    map_obj = db.query(Map).filter(Map.id == map_id, Map.project_id == project_id).first()
    if not map_obj:
        raise HTTPException(status_code=404, detail="Map not found or doesn't belong to this project")
    
    # Create event
    try:
        event = await event_service.create_event(
            db=db,
            project_id=project_id,
            map_id=map_id,
            created_by_user_id=current_user.id,
            title=title,
            status=status,
            state=state,
            active_maps=active_maps,
            x_coordinate=x_coordinate,
            y_coordinate=y_coordinate,
            description=description,
            tags=tags,
            image=image
        )
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        status=event_update.status,
        state=event_update.state,
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