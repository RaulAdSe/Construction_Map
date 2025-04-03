from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.event_history import EventHistory
from app.models.event import Event
from app.models.user import User


def create_event_history(
    db: Session,
    event_id: int,
    user_id: int,
    action_type: str,
    previous_value: Optional[str] = None,
    new_value: Optional[str] = None,
    additional_data: Optional[Dict[str, Any]] = None
) -> EventHistory:
    """
    Create a new event history record.
    
    Parameters:
    - db: Database session
    - event_id: ID of the event
    - user_id: ID of the user who performed the action
    - action_type: Type of action ('create', 'status_change', 'type_change', 'comment', 'edit')
    - previous_value: Previous value (for changes)
    - new_value: New value (for changes)
    - additional_data: Any additional data as a JSON object
    
    Returns:
    - The created event history record
    """
    db_history = EventHistory(
        event_id=event_id,
        user_id=user_id,
        action_type=action_type,
        previous_value=previous_value,
        new_value=new_value,
        additional_data=additional_data
    )
    
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history


def get_event_history(
    db: Session,
    event_id: int,
    skip: int = 0,
    limit: int = 100,
    newest_first: bool = True
) -> List[Dict[str, Any]]:
    """
    Get history for a specific event, with user information.
    
    Parameters:
    - db: Database session
    - event_id: ID of the event
    - skip: Number of records to skip (for pagination)
    - limit: Maximum number of records to return
    - newest_first: If True, return newest records first
    
    Returns:
    - List of event history records with user information
    """
    try:
        # First check if the event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            return []
        
        # Check if there are any history records for this event
        history_count = db.query(EventHistory).filter(EventHistory.event_id == event_id).count()
        if history_count == 0:
            return []
        
        query = db.query(
            EventHistory,
            User.username,
            Event.title.label("event_title")
        ).join(
            User, EventHistory.user_id == User.id
        ).join(
            Event, EventHistory.event_id == Event.id
        ).filter(
            EventHistory.event_id == event_id
        )
        
        if newest_first:
            query = query.order_by(desc(EventHistory.created_at))
        else:
            query = query.order_by(asc(EventHistory.created_at))
        
        results = query.offset(skip).limit(limit).all()
        
        # Format the results
        formatted_results = []
        for history, username, event_title in results:
            history_dict = {
                "id": history.id,
                "event_id": history.event_id,
                "user_id": history.user_id,
                "username": username,
                "event_title": event_title,
                "action_type": history.action_type,
                "previous_value": history.previous_value,
                "new_value": history.new_value,
                "additional_data": history.additional_data,
                "created_at": history.created_at
            }
            formatted_results.append(history_dict)
        
        return formatted_results
    except Exception as e:
        # Log the error but return an empty list to avoid crashing the client
        print(f"Error retrieving event history for event {event_id}: {str(e)}")
        return []


def get_all_event_history(
    db: Session,
    project_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    newest_first: bool = True
) -> List[Dict[str, Any]]:
    """
    Get history for all events, optionally filtered by project.
    
    Parameters:
    - db: Database session
    - project_id: Optional ID of the project to filter by
    - skip: Number of records to skip (for pagination)
    - limit: Maximum number of records to return
    - newest_first: If True, return newest records first
    
    Returns:
    - List of event history records with user and event information
    """
    try:
        # If filtering by project, check if project exists and if there are any records
        if project_id is not None:
            # Check if project has any events with history
            history_count = db.query(EventHistory).join(
                Event, EventHistory.event_id == Event.id
            ).filter(
                Event.project_id == project_id
            ).count()
            
            if history_count == 0:
                return []
        
        query = db.query(
            EventHistory,
            User.username,
            Event.title.label("event_title"),
            Event.project_id
        ).join(
            User, EventHistory.user_id == User.id
        ).join(
            Event, EventHistory.event_id == Event.id
        )
        
        if project_id is not None:
            query = query.filter(Event.project_id == project_id)
        
        if newest_first:
            query = query.order_by(desc(EventHistory.created_at))
        else:
            query = query.order_by(asc(EventHistory.created_at))
        
        results = query.offset(skip).limit(limit).all()
        
        # Format the results
        formatted_results = []
        for history, username, event_title, project_id in results:
            history_dict = {
                "id": history.id,
                "event_id": history.event_id,
                "user_id": history.user_id,
                "username": username,
                "event_title": event_title,
                "project_id": project_id,
                "action_type": history.action_type,
                "previous_value": history.previous_value,
                "new_value": history.new_value,
                "additional_data": history.additional_data,
                "created_at": history.created_at
            }
            formatted_results.append(history_dict)
        
        return formatted_results
    except Exception as e:
        # Log the error but return an empty list to avoid crashing the client
        print(f"Error retrieving event history for project {project_id}: {str(e)}")
        return [] 