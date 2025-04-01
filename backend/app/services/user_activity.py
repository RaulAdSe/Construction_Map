from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import os
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.models.user_activity import UserActivity
from app.schemas.user_activity import UserActivityCreate
from app.core.config import settings

# Set up logging
activity_logger = logging.getLogger("user_activity")
activity_logger.setLevel(logging.INFO)

# Create logs directory if it doesn't exist
os.makedirs(settings.monitoring.LOG_PATH, exist_ok=True)

# Create a file handler
log_path = os.path.join(settings.monitoring.LOG_PATH, "user_activity.log")
file_handler = logging.FileHandler(log_path)
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
activity_logger.addHandler(file_handler)

# Get retention settings from configuration
ACTIVITY_RETENTION_DAYS = settings.monitoring.ACTIVITY_RETENTION_DAYS
MAX_ACTIVITIES_PER_USER = settings.monitoring.MAX_ACTIVITIES_PER_USER


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
    
    # No more random cleanup - we'll let the scheduled tasks or manual cleanup handle this
    
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


def cleanup_old_activities(db: Session) -> int:
    """
    Clean up old user activity records based on retention policy
    Returns the number of deleted records
    """
    activity_logger.info("Starting user activity cleanup")
    
    # Calculate cutoff date based on retention period
    cutoff_date = datetime.now() - timedelta(days=ACTIVITY_RETENTION_DAYS)
    
    # Delete activities older than the retention period
    result = db.query(UserActivity).filter(UserActivity.timestamp < cutoff_date).delete()
    db.commit()
    
    # For each user, check if they have more than MAX_ACTIVITIES_PER_USER activities
    # If so, keep the newest ones and delete the oldest ones
    user_counts = db.query(
        UserActivity.user_id, 
        func.count(UserActivity.id).label('count')
    ).group_by(UserActivity.user_id).having(
        func.count(UserActivity.id) > MAX_ACTIVITIES_PER_USER
    ).all()
    
    additional_deletions = 0
    for user_id, count in user_counts:
        # Get IDs of oldest activities beyond the limit for this user
        to_delete = db.query(UserActivity.id).filter(
            UserActivity.user_id == user_id
        ).order_by(
            UserActivity.timestamp.desc()
        ).offset(MAX_ACTIVITIES_PER_USER).all()
        
        # Delete these activities
        if to_delete:
            id_list = [id[0] for id in to_delete]
            db.query(UserActivity).filter(UserActivity.id.in_(id_list)).delete()
            additional_deletions += len(id_list)
    
    if additional_deletions > 0:
        db.commit()
    
    total_deleted = result + additional_deletions
    activity_logger.info(f"User activity cleanup completed: {total_deleted} records deleted")
    return total_deleted


def get_storage_statistics(db: Session) -> Dict[str, Any]:
    """
    Get statistics about user activity storage
    """
    total_activities = db.query(func.count(UserActivity.id)).scalar()
    oldest_activity = db.query(func.min(UserActivity.timestamp)).scalar()
    newest_activity = db.query(func.max(UserActivity.timestamp)).scalar()
    
    user_counts = db.query(
        UserActivity.user_id,
        UserActivity.username,
        func.count(UserActivity.id).label('count')
    ).group_by(UserActivity.user_id, UserActivity.username).all()
    
    user_stats = [{"user_id": user_id, "username": username, "activity_count": count} 
                 for user_id, username, count in user_counts]
    
    return {
        "total_activities": total_activities,
        "oldest_activity": oldest_activity,
        "newest_activity": newest_activity,
        "retention_days": ACTIVITY_RETENTION_DAYS,
        "max_per_user": MAX_ACTIVITIES_PER_USER,
        "user_statistics": user_stats
    } 