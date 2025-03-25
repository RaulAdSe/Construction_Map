from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import List, Optional
from sqlalchemy.orm import Session

from .. import schemas, crud
from ..deps import get_db, get_current_user
from ..models import User

router = APIRouter()

# Add dedicated route for status updates
@router.put("/{event_id}/status", response_model=schemas.Event)
def update_event_status(
    event_id: int,
    status_update: schemas.EventStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update event status separately
    """
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Only update the status field
    return crud.update_event(db, event_id, {"status": status_update.status})

# Add dedicated route for state updates
@router.put("/{event_id}/state", response_model=schemas.Event)
def update_event_state(
    event_id: int,
    state_update: schemas.EventStateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update event state separately
    """
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Only update the state field
    return crud.update_event(db, event_id, {"state": state_update.state})

# General update endpoint
@router.put("/{event_id}", response_model=schemas.Event)
def update_event(
    event_id: int,
    event_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update event with proper active_maps handling
    """
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Handle active_maps - make sure it's always a dictionary
    if "active_maps" in event_data:
        if isinstance(event_data["active_maps"], list) or event_data["active_maps"] is None:
            event_data["active_maps"] = {}
    
    return crud.update_event(db, event_id, event_data) 