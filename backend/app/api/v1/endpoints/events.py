from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query, Response, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db
from app.models.user import User
from app.schemas.event import Event, EventCreate, EventUpdate, EventDetail
from app.services import event as event_service
from app.services import project as project_service
from app.services import event_comment as comment_service
from app.models.map import Map
from app.models.event import Event as EventModel
from app.api.v1.endpoints.monitoring import log_user_activity

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
    Admin users can see all events, regular users cannot see closed events.
    """
    # Check if project exists and user has access
    project = project_service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user has access to project
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get events - only include closed events for admin users
    events = event_service.get_events(
        db=db,
        project_id=project_id,
        user_id=user_id,
        skip=skip,
        limit=limit,
        include_closed=current_user.is_admin  # Only admins see closed events
    )
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
    request: Request,
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
        
        # Log user activity
        log_user_activity(
            user_id=current_user.id,
            username=current_user.username,
            action="event_create",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin" if current_user.is_admin else "member",
            details={
                "project_id": project_id,
                "map_id": map_id,
                "event_id": event.id,
                "event_title": event.title,
                "event_status": event.status,
                "event_state": event.state
            }
        )
        
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{event_id}", response_model=Event)
def update_event(
    event_id: int,
    event_update: EventUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update an event.
    Only admin users can close or reopen events.
    """
    # Check if event exists
    event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Check status permissions
    if event_update.status == "closed" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admin users can close events")
    
    # Don't allow non-admins to reopen closed events
    if event.status == "closed" and event_update.status != "closed" and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admin users can reopen closed events")
    
    # Update event
    try:
        updated_event = event_service.update_event(
            db, 
            event_id, 
            event_update,
            current_user_id=current_user.id
        )
        
        # Log user activity
        log_user_activity(
            user_id=current_user.id,
            username=current_user.username,
            action="event_update",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin" if current_user.is_admin else "member",
            details={
                "event_id": event_id,
                "project_id": event.project_id,
                "map_id": event.map_id,
                "event_title": updated_event.title,
                "event_status": updated_event.status,
                "event_state": updated_event.state,
                "status_changed": event.status != updated_event.status,
                "state_changed": event.state != updated_event.state
            }
        )
        
        return updated_event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Delete an event.
    """
    # Check if event exists
    event = db.query(EventModel).filter(EventModel.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user has access to project
    project = project_service.get_project(db, event.project_id)
    if not any(pu.user_id == current_user.id for pu in project.users):
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Log user activity before deletion
    log_user_activity(
        user_id=current_user.id,
        username=current_user.username,
        action="event_delete",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if current_user.is_admin else "member",
        details={
            "event_id": event_id,
            "project_id": event.project_id,
            "map_id": event.map_id,
            "event_title": event.title
        }
    )
    
    # Delete event (this will cascade delete comments too)
    result = event_service.delete_event(db, event_id)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to delete event")
        
    return None


# Add special admin route to fix active_maps
@router.get("/admin/fix-active-maps", response_model=dict)
def fix_all_events_active_maps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Fix all events with array active_maps values
    """
    # Get all events
    events = db.query(EventModel).all()
    
    fixed_count = 0
    for event in events:
        # Check if active_maps is an array or None
        if event.active_maps is None or isinstance(event._active_maps, list):
            print(f"Fixing event {event.id} - active_maps was {type(event._active_maps)}")
            event.active_maps = {}
            fixed_count += 1
    
    # Save changes if any were made
    if fixed_count > 0:
        db.commit()
    
    return {"message": f"Fixed {fixed_count} events with invalid active_maps values"} 