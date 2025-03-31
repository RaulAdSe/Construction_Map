from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user_activity import UserActivity
from app.schemas.user_activity import UserActivityCreate

# Set up logging
activity_logger = logging.getLogger("user_activity")
activity_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler("user_activity.log")
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
activity_logger.addHandler(file_handler)


def create_user_activity(
    db: Session,
    user_id: int,
    username: str,
    action: str,
    ip_address: str = "Unknown",
    user_type: str = "member", 
    details: Optional[Dict[str, Any]] = None
) -> UserActivity:
    """
    Create a new user activity entry in the database
    """
    activity_data = {
        "user_id": user_id,
        "username": username,
        "action": action,
        "ip_address": ip_address,
        "user_type": user_type,
        "details": details or {}
    }
    
    db_activity = UserActivity(**activity_data)
    db.add(db_activity)
    db.commit()
    db.refresh(db_activity)
    
    # Log to file as well
    activity_logger.info(f"User activity: {username} ({user_type}) - {action}")
    
    return db_activity


def get_user_activities(
    db: Session,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    user_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100
) -> List[UserActivity]:
    """
    Get user activities with optional filtering
    """
    query = db.query(UserActivity)
    
    if user_id:
        query = query.filter(UserActivity.user_id == user_id)
        
    if username:
        query = query.filter(UserActivity.username.ilike(f"%{username}%"))
        
    if action:
        query = query.filter(UserActivity.action.ilike(f"%{action}%"))
        
    if user_type:
        query = query.filter(UserActivity.user_type == user_type)
        
    if start_time:
        query = query.filter(UserActivity.timestamp >= start_time)
        
    if end_time:
        query = query.filter(UserActivity.timestamp <= end_time)
    
    # Order by timestamp (newest first)
    query = query.order_by(desc(UserActivity.timestamp))
    
    # Apply pagination
    activities = query.offset(skip).limit(limit).all()
    
    return activities


def get_activities_count(
    db: Session,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    user_type: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None
) -> int:
    """
    Get count of user activities with optional filtering
    """
    query = db.query(UserActivity)
    
    if user_id:
        query = query.filter(UserActivity.user_id == user_id)
        
    if username:
        query = query.filter(UserActivity.username.ilike(f"%{username}%"))
        
    if action:
        query = query.filter(UserActivity.action.ilike(f"%{action}%"))
        
    if user_type:
        query = query.filter(UserActivity.user_type == user_type)
        
    if start_time:
        query = query.filter(UserActivity.timestamp >= start_time)
        
    if end_time:
        query = query.filter(UserActivity.timestamp <= end_time)
    
    return query.count() 