from typing import List, Any

from fastapi import APIRouter, Depends, HTTPException, status, Body, Path, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import get_db, engine
from app.models.user import User
from app.models.user_preference import UserPreference
from app.api.deps import get_current_active_user, get_current_user
from app.schemas.user import User as UserSchema
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth import create_user
from app.services.user_preference import UserPreferenceService
import logging
from sqlalchemy import inspect
from app.services.email_service import EmailService

router = APIRouter()
logger = logging.getLogger(__name__)

# Check if user_preferences table exists, create it if not
def ensure_user_preferences_table_exists():
    try:
        inspector = inspect(engine)
        if not inspector.has_table("user_preferences"):
            logger.warning("user_preferences table doesn't exist, creating it now")
            UserPreference.__table__.create(engine)
            logger.info("Created user_preferences table")
    except Exception as e:
        logger.error(f"Error ensuring user_preferences table exists: {str(e)}")

# Call this at module import to ensure table exists
ensure_user_preferences_table_exists()

@router.get("/", response_model=List[UserSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve all users.
    Only accessible by admin users.
    """
    # Check if user is admin
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Get a specific user by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Users can only view their own information unless they're an admin
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return user


@router.get("/preferences/email-notifications", status_code=200)
async def get_email_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get email notification preferences for the current user
    """
    logger.debug(f"Getting email preferences for user: {current_user.id}")
    try:
        # Ensure table exists
        ensure_user_preferences_table_exists()
        
        # Use the UserPreferenceService to get or create preferences
        preferences = UserPreferenceService.get_or_create_user_preference(db, current_user.id)
        logger.debug(f"Retrieved preferences: {preferences.email_notifications}")
        return {"enabled": preferences.email_notifications}
    except ProgrammingError as e:
        logger.error(f"Database schema error: {str(e)}")
        # Return default preference if table doesn't exist
        return {"enabled": True, "note": "Using default preference"}
    except Exception as e:
        logger.error(f"Error getting email preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/preferences/email-notifications", status_code=200)
async def update_email_preferences(
    enabled: bool = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update email notification preferences for the current user
    """
    logger.debug(f"Updating email preferences for user: {current_user.id} to {enabled}")
    try:
        # Ensure table exists
        ensure_user_preferences_table_exists()
        
        # Use the UserPreferenceService to update preferences
        preferences = UserPreferenceService.get_or_create_user_preference(db, current_user.id)
        preferences.email_notifications = enabled
        db.commit()
        db.refresh(preferences)
        
        return {"enabled": preferences.email_notifications}
    except ProgrammingError as e:
        logger.error(f"Database schema error: {str(e)}")
        return {"enabled": enabled, "note": "Preference stored temporarily"}
    except Exception as e:
        logger.error(f"Error updating email preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/send-test-email/{username}", status_code=status.HTTP_200_OK)
def send_test_email(
    username: str = Path(..., description="Username of the recipient"),
    subject: str = Body("Test Notification", embed=True),
    message: str = Body("This is a test notification", embed=True),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Send a test email notification to a user
    Only admins can send emails to other users
    """
    # Check if user has permission to send test emails
    if not current_user.is_admin and current_user.username != username:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to send emails to other users"
        )
    
    # Get user by username
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {username} not found"
        )
    
    # Send email
    html_content = f"<h2>{subject}</h2><p>{message}</p><p>This is a test email from the Servitec Map application.</p>"
    success = EmailService.send_email(
        recipients=user.email,
        subject=subject,
        body_text=message,
        body_html=html_content
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send email"
        )
    
    return {"message": f"Test email sent to {username} ({user.email})"} 