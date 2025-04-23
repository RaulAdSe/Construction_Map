from typing import Generator, Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
import logging

from app.db.database import get_db
from app.models.user import User
from app.core.config import settings
from app.core.security import ALGORITHM
from app.schemas.user import TokenData

logger = logging.getLogger(__name__)

# Make token optional in development mode to allow API testing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=not settings.DEBUG)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db), 
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    # For debugging
    logger.debug(f"DEBUG mode: {settings.DEBUG}")
    logger.debug(f"Processing token: {token[:10] + '...' if token else None}")
    
    # In development mode, allow anonymous access if DEBUG is True and no token provided
    if settings.DEBUG and not token:
        # Look up an admin user for dev purposes
        admin_user = db.query(User).filter(User.is_admin == True).first()
        if admin_user:
            logger.debug(f"Running in DEBUG mode, using admin user: {admin_user.username}")
            return admin_user
        # Fallback to first user if no admin found
        first_user = db.query(User).first()
        if first_user:
            logger.debug(f"Running in DEBUG mode, using first user: {first_user.username}")
            return first_user
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    expired_token_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token has expired. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    try:
        # Log the SECRET_KEY hash to check if it's consistent
        secret_key_hash = hash(settings.SECRET_KEY) 
        logger.debug(f"Using SECRET_KEY hash: {secret_key_hash}")
        
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
        
        # Check if token has is_admin claim
        is_admin_in_token = payload.get("is_admin")
        logger.debug(f"Token has is_admin claim: {is_admin_in_token}")
        
    except JWTError as e:
        logger.error(f"JWT error: {str(e)}")
        
        # Check if it's specifically a token expiration error
        if "expired" in str(e).lower():
            logger.warning(f"Token expired for request: {request.url.path}")
            raise expired_token_exception
        
        raise credentials_exception
        
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
        
    # Update user admin status from token if available
    # This ensures the admin status is consistent with what was issued in the token
    if is_admin_in_token is not None and user.is_admin != is_admin_in_token:
        logger.warning(f"User {user.username} has different admin status in DB vs token")
        user.is_admin = is_admin_in_token
        # Note: we don't commit this change to the database
        
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_active_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user


def verify_project_access(db: Session, user_id: int, project_id: int = None, event_id: int = None):
    """
    Verify if a user has access to a project.
    This can be checked either directly with a project_id or indirectly with an event_id.
    Raises HTTPException if the user doesn't have access.
    """
    from app.models.event import Event
    from app.models.project import Project, ProjectUser
    
    # If we have an event_id but not a project_id, get the project_id from the event
    if event_id and not project_id:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        project_id = event.project_id
    
    # Check if the user has access to the project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if user is an admin
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_admin:
        return True
    
    # Check if user is a member of the project
    project_user = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id
    ).first()
    
    if not project_user:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return True 