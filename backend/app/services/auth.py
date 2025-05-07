from typing import Optional
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from jose import jwt

from app.core.config import settings
from app.models.user import User
from app.core.security import verify_password, get_password_hash
from app.services.email_service import EmailService
import logging

# Configure JWT
ALGORITHM = "HS256"

logger = logging.getLogger(__name__)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, username: str, email: str, password: str, is_admin: bool = False) -> User:
    hashed_password = get_password_hash(password)
    user = User(
        username=username,
        email=email,
        password_hash=hashed_password,
        is_admin=is_admin
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Send welcome email
    try:
        logger.info(f"Sending welcome email to new user: {email}")
        EmailService.send_welcome_email(email, username)
    except Exception as e:
        logger.error(f"Failed to send welcome email: {str(e)}")
        # Continue even if email fails - it's non-critical
    
    return user 