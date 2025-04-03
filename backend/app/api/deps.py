from typing import Generator, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.core.config import settings
from app.core.security import ALGORITHM
from app.schemas.user import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise credentials_exception
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


def verify_project_access(
    db: Session,
    user_id: int,
    project_id: Optional[int] = None,
    event_id: Optional[int] = None
) -> bool:
    """
    Verify if a user has access to a project.
    
    Args:
        db: Database session
        user_id: ID of the user
        project_id: ID of the project (optional if event_id is provided)
        event_id: ID of the event (optional if project_id is provided)
        
    Returns:
        True if user has access, raises HTTPException otherwise
    
    Raises:
        HTTPException: If the user doesn't have access to the project
    """
    from app.models.project import ProjectUser
    from app.models.event import Event
    from app.models.user import User
    
    # First check if user is admin
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_admin:
        return True
    
    # Determine project_id if only event_id is provided
    if project_id is None and event_id is not None:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        project_id = event.project_id
    
    if project_id is None:
        raise HTTPException(status_code=400, detail="Either project_id or event_id must be provided")
    
    # Check if user has access to project
    project_user = db.query(ProjectUser).filter(
        ProjectUser.project_id == project_id,
        ProjectUser.user_id == user_id
    ).first()
    
    if not project_user:
        raise HTTPException(status_code=403, detail="Not enough permissions: User is not a member of this project")
    
    return True 