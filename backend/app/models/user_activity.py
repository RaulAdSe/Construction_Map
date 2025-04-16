from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserActivity(Base):
    """Model for storing user activity logs"""
    
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    ip_address = Column(String, nullable=True)
    user_type = Column(String, nullable=False, index=True)  # "admin" or "member"
    details = Column(JSON, nullable=True)  # Any additional context about the action
    
    # Relationship with User model
    user = relationship("User", back_populates="activities") 