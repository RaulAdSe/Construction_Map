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
    
    if not token:
        logger.warning("No token provided")
        if settings.DEBUG:
            # For development, try to find a valid user
            logger.debug("In debug mode, checking for default users")
            default_user = db.query(User).filter(User.username == "admin").first()
            if default_user:
                logger.debug(f"Using default admin user for debugging")
                return default_user
            first_user = db.query(User).first()
            if first_user:
                logger.debug(f"Using first available user for debugging: {first_user.username}")
                return first_user
        raise credentials_exception
        
    try:
        # Log the SECRET_KEY hash to check if it's consistent
        secret_key_hash = hash(settings.SECRET_KEY) 
        logger.debug(f"Using SECRET_KEY hash: {secret_key_hash}")
        
        # In development mode, use a generous leeway for token expiration (30 minutes)
        token_leeway = 1800 if settings.DEBUG else 0  # 30 minutes in dev mode
        
        # Decode token with options for development mode
        logger.debug(f"Using token leeway of {token_leeway} seconds")
        
        # Configure options for JWT decoding
        decode_options = {}
        if settings.DEBUG:
            # In debug mode, don't verify token expiration
            decode_options = {"verify_exp": False}
            
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[ALGORITHM],
            options=decode_options
        )
        
        username: str = payload.get("sub")
        if username is None:
            logger.warning("Token missing 'sub' claim")
            raise credentials_exception
            
        token_data = TokenData(username=username)
        logger.debug(f"Token validated for user: {username}")
        
    except JWTError as e:
        logger.error(f"JWT error: {str(e)}")
        
        # In development mode, allow expired tokens
        if settings.DEBUG and "expired" in str(e).lower():
            try:
                # Try to decode without verifying expiration
                logger.debug("In debug mode, trying to decode expired token")
                payload = jwt.decode(
                    token, 
                    settings.SECRET_KEY, 
                    algorithms=[ALGORITHM],
                    options={"verify_exp": False}
                )
                username = payload.get("sub")
                if username:
                    logger.debug(f"Using expired token for user: {username}")
                    user = db.query(User).filter(User.username == username).first()
                    if user:
                        logger.debug(f"Found user from expired token: {user.username}")
                        return user
            except Exception as inner_e:
                logger.error(f"Error while trying to use expired token: {inner_e}")
                
        raise credentials_exception
        
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        logger.warning(f"User not found: {token_data.username}")
        raise credentials_exception
        
    logger.debug(f"Successfully authenticated user: {user.username}")
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