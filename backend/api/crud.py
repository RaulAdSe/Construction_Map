from sqlalchemy.orm import Session
from . import models, schemas
from typing import Dict, Any, Optional

def get_event(db: Session, event_id: int):
    """Get an event by ID"""
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    
    # Ensure active_maps is always a dictionary
    if event and (event.active_maps is None or isinstance(event.active_maps, list)):
        event.active_maps = {}
    
    return event

def update_event(db: Session, event_id: int, update_data: Dict[str, Any]):
    """Update an event with proper handling of active_maps"""
    event = get_event(db, event_id)
    if not event:
        return None
    
    # Handle fields that need special processing
    if "active_maps" in update_data:
        # Ensure active_maps is a dictionary
        if update_data["active_maps"] is None or isinstance(update_data["active_maps"], list):
            update_data["active_maps"] = {}
    
    # Update the event with the provided data
    for key, value in update_data.items():
        if hasattr(event, key):
            setattr(event, key, value)
    
    # Final check to ensure active_maps is a dictionary before saving
    if event.active_maps is None or isinstance(event.active_maps, list):
        event.active_maps = {}
    
    # Save changes
    db.commit()
    db.refresh(event)
    
    return event 