from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="regular")
    is_active = Column(Boolean, default=True)

    # Relationships
    projects = relationship("ProjectUser", back_populates="user")
    events = relationship("Event", back_populates="created_by_user")
    event_comments = relationship("EventComment", back_populates="user") 