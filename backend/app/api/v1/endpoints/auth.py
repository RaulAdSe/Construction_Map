from datetime import timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.services.auth import authenticate_user, create_user, get_user_by_username
from app.schemas.user import User, UserCreate, Token
from app.api.v1.endpoints.monitoring import log_user_activity

router = APIRouter()


@router.post("/login")
def login_access_token(
    request: Request,
    db: Session = Depends(get_db), 
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Dict[str, Any]:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Log failed login attempt
        log_user_activity(
            user_id=None,
            username=form_data.username,
            action="login_failed",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="unknown",
            details={"reason": "Incorrect username or password"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        # Log inactive user attempt
        log_user_activity(
            user_id=user.id,
            username=user.username,
            action="login_failed",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="admin" if user.is_admin else "member",
            details={"reason": "Inactive user"}
        )
        
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Log successful login
    log_user_activity(
        user_id=user.id,
        username=user.username,
        action="login_success",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if user.is_admin else "member"
    )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Include user information in the response
    return {
        "access_token": create_access_token(
            user.username, 
            expires_delta=access_token_expires,
            user_id=user.id
        ),
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_active": user.is_active
        }
    }


@router.post("/register", response_model=User)
def register_user(
    request: Request,
    user_in: UserCreate, 
    db: Session = Depends(get_db)
) -> Any:
    """
    Register a new user
    """
    # Check if the username already exists
    if get_user_by_username(db, user_in.username):
        # Log registration attempt with existing username
        log_user_activity(
            user_id=None,
            username=user_in.username,
            action="register_failed",
            ip_address=request.client.host if request.client else "Unknown",
            user_type="unknown",
            details={"reason": "Username already registered"}
        )
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    
    user = create_user(
        db=db, 
        username=user_in.username, 
        email=user_in.email, 
        password=user_in.password, 
        is_admin=user_in.is_admin
    )
    
    # Log successful registration
    log_user_activity(
        user_id=user.id,
        username=user.username,
        action="register_success",
        ip_address=request.client.host if request.client else "Unknown",
        user_type="admin" if user.is_admin else "member"
    )
    
    return user 